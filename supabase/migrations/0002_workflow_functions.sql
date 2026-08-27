-- Workflow engine: memo numbering, submit, actions. All SECURITY DEFINER,
-- but every function re-validates auth.uid() against row state — they do not
-- trust the caller. Called from server-side Next.js code via RPC.

-- ============ AUDIT HELPER ============

create or replace function log_audit(
  p_org_id uuid, p_actor uuid, p_event text,
  p_entity_type text, p_entity_id uuid, p_description text
) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (org_id, actor_id, event_type, entity_type, entity_id, description)
  values (p_org_id, p_actor, p_event, p_entity_type, p_entity_id, p_description)
$$;

-- ============ NOTIFY HELPER ============

create or replace function notify_user(
  p_org_id uuid, p_user uuid, p_type text, p_memo uuid, p_message text
) returns void
language sql security definer set search_path = public as $$
  insert into notifications (org_id, user_id, type, memo_id, message)
  values (p_org_id, p_user, p_type, p_memo, p_message)
$$;

-- ============ MEMO NUMBER ============

create or replace function next_memo_number(p_org_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
  v_ident text;
begin
  insert into org_memo_counters (org_id, next_number) values (p_org_id, 1)
    on conflict (org_id) do nothing;
  select next_number into v_n from org_memo_counters
    where org_id = p_org_id for update;
  update org_memo_counters set next_number = v_n + 1 where org_id = p_org_id;
  select identifier into v_ident from orgs where id = p_org_id;
  return upper(v_ident) || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_n::text, 5, '0');
end;
$$;

-- ============ SUBMIT MEMO ============
-- p_participants: ordered array of profile ids forming the workflow sequence.

create or replace function submit_memo(p_memo_id uuid, p_participants uuid[])
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_memo memos%rowtype;
  v_uid uuid := auth.uid();
  v_step_id uuid;
  v_first_step uuid;
  v_i int;
  v_pid uuid;
  v_is_resubmit boolean;
begin
  select * into v_memo from memos where id = p_memo_id for update;
  if not found then
    raise exception 'memo not found';
  end if;
  if v_memo.author_id <> v_uid then
    raise exception 'only the author can submit';
  end if;
  if v_memo.status not in ('Draft','Changes Requested') then
    raise exception 'memo cannot be submitted from status %', v_memo.status;
  end if;
  if v_memo.org_id <> (select org_id from profiles where id = v_uid) then
    raise exception 'cross-organization access denied';
  end if;

  v_is_resubmit := v_memo.status = 'Changes Requested';

  if v_is_resubmit then
    -- snapshot the revised content as a new version
    insert into memo_versions (memo_id, org_id, version_number, subject, body, edited_by, change_reason)
    values (p_memo_id, v_memo.org_id, v_memo.current_version + 1,
            v_memo.subject, v_memo.body, v_uid, 'Resubmission after changes requested');
    update memos set current_version = current_version + 1 where id = p_memo_id;
    -- reactivate existing sequence from the beginning of pending steps:
    -- reset all steps to Pending, then activate first
    update workflow_instance_steps
      set status = 'Pending', acted_at = null, comment = null
      where memo_id = p_memo_id;
  else
    if p_participants is null or array_length(p_participants, 1) is null then
      raise exception 'workflow requires at least one participant';
    end if;
    -- validate participants: same org, active
    foreach v_pid in array p_participants loop
      if not exists (select 1 from profiles
                     where id = v_pid and org_id = v_memo.org_id and status = 'active') then
        raise exception 'invalid workflow participant';
      end if;
    end loop;
    -- first submission: assign memo number + create steps + version 1 snapshot
    if v_memo.memo_number is null then
      update memos set memo_number = next_memo_number(v_memo.org_id) where id = p_memo_id;
    end if;
    insert into memo_versions (memo_id, org_id, version_number, subject, body, edited_by, change_reason)
    values (p_memo_id, v_memo.org_id, 1, v_memo.subject, v_memo.body, v_uid, 'Initial submission');
    v_i := 1;
    foreach v_pid in array p_participants loop
      insert into workflow_instance_steps (memo_id, org_id, step_order, assigned_user_id, status)
      values (p_memo_id, v_memo.org_id, v_i, v_pid, 'Pending');
      v_i := v_i + 1;
    end loop;
  end if;

  -- activate first step
  select id into v_first_step from workflow_instance_steps
    where memo_id = p_memo_id order by step_order limit 1;
  update workflow_instance_steps set status = 'Active' where id = v_first_step;

  update memos set
    status = 'Pending Approval',
    current_step_id = v_first_step,
    submitted_at = coalesce(submitted_at, now()),
    completed_at = null
    where id = p_memo_id;

  select assigned_user_id into v_pid from workflow_instance_steps where id = v_first_step;
  perform notify_user(v_memo.org_id, v_pid, 'action_required', p_memo_id,
    'Memo requires your action: ' || v_memo.subject);
  perform log_audit(v_memo.org_id, v_uid,
    case when v_is_resubmit then 'memo_resubmitted' else 'memo_submitted' end,
    'memo', p_memo_id, v_memo.subject);

  return json_build_object('ok', true, 'memo_id', p_memo_id);
end;
$$;

-- ============ WORKFLOW ACTION ============
-- p_action: 'approve' | 'reject' | 'request_changes' | 'comment'

create or replace function perform_workflow_action(
  p_memo_id uuid, p_action text, p_comment text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_memo memos%rowtype;
  v_uid uuid := auth.uid();
  v_step workflow_instance_steps%rowtype;
  v_next workflow_instance_steps%rowtype;
  v_actor uuid := auth.uid();
  v_on_behalf uuid := null;
  v_subject text;
begin
  select * into v_memo from memos where id = p_memo_id for update;
  if not found then
    raise exception 'memo not found';
  end if;
  if v_memo.org_id <> (select org_id from profiles where id = v_uid) then
    raise exception 'cross-organization access denied';
  end if;
  if v_memo.status not in ('Pending Approval','Pending Review','Submitted') then
    raise exception 'memo is not awaiting workflow action (status: %)', v_memo.status;
  end if;

  select * into v_step from workflow_instance_steps
    where id = v_memo.current_step_id for update;
  if not found or v_step.status <> 'Active' then
    raise exception 'no active workflow step';
  end if;

  -- turn check: assignee, or an active delegate of the assignee
  if v_step.assigned_user_id <> v_uid then
    if exists (select 1 from delegations d
               where d.delegator_id = v_step.assigned_user_id
                 and d.delegate_id = v_uid
                 and d.is_active
                 and current_date between d.start_date and d.end_date
                 and d.org_id = v_memo.org_id) then
      v_on_behalf := v_step.assigned_user_id;
    else
      raise exception 'it is not your turn to act on this memo';
    end if;
  end if;

  v_subject := v_memo.subject;

  if p_action = 'comment' then
    if p_comment is null or length(trim(p_comment)) = 0 then
      raise exception 'comment text required';
    end if;
    insert into comments (memo_id, org_id, author_id, body, comment_type, workflow_step_id, is_locked)
    values (p_memo_id, v_memo.org_id, v_uid, p_comment, 'general', v_step.id, false);
    perform notify_user(v_memo.org_id, v_memo.author_id, 'comment_added', p_memo_id,
      'New comment on memo: ' || v_subject);
    perform log_audit(v_memo.org_id, v_uid, 'comment', 'memo', p_memo_id, p_comment);
    return json_build_object('ok', true, 'action', 'comment');
  end if;

  if p_action = 'approve' then
    update workflow_instance_steps
      set status = 'Approved', acted_at = now(), comment = p_comment, acted_on_behalf_of = v_on_behalf
      where id = v_step.id;
    if p_comment is not null and length(trim(p_comment)) > 0 then
      insert into comments (memo_id, org_id, author_id, body, comment_type, workflow_step_id, is_locked)
      values (p_memo_id, v_memo.org_id, v_uid, p_comment, 'approval', v_step.id, true);
    end if;
    perform log_audit(v_memo.org_id, v_uid, 'approval', 'memo', p_memo_id,
      'Step ' || v_step.step_order || ' approved');

    select * into v_next from workflow_instance_steps
      where memo_id = p_memo_id and step_order > v_step.step_order and status = 'Pending'
      order by step_order limit 1;
    if found then
      update workflow_instance_steps set status = 'Active' where id = v_next.id;
      update memos set current_step_id = v_next.id where id = p_memo_id;
      perform notify_user(v_memo.org_id, v_next.assigned_user_id, 'action_required', p_memo_id,
        'Memo requires your action: ' || v_subject);
    else
      update memos set status = 'Approved', current_step_id = null, completed_at = now()
        where id = p_memo_id;
      perform notify_user(v_memo.org_id, v_memo.author_id, 'memo_approved', p_memo_id,
        'Your memo was approved: ' || v_subject);
      perform log_audit(v_memo.org_id, v_uid, 'workflow_completed', 'memo', p_memo_id, v_subject);
    end if;
    return json_build_object('ok', true, 'action', 'approve');
  end if;

  if p_action = 'reject' then
    if p_comment is null or length(trim(p_comment)) = 0 then
      raise exception 'a rejection reason is required';
    end if;
    update workflow_instance_steps
      set status = 'Rejected', acted_at = now(), comment = p_comment, acted_on_behalf_of = v_on_behalf
      where id = v_step.id;
    insert into comments (memo_id, org_id, author_id, body, comment_type, workflow_step_id, is_locked)
    values (p_memo_id, v_memo.org_id, v_uid, p_comment, 'rejection', v_step.id, true);
    update memos set status = 'Rejected', current_step_id = null, completed_at = now()
      where id = p_memo_id;
    perform notify_user(v_memo.org_id, v_memo.author_id, 'memo_rejected', p_memo_id,
      'Your memo was rejected: ' || v_subject);
    perform log_audit(v_memo.org_id, v_uid, 'rejection', 'memo', p_memo_id, p_comment);
    return json_build_object('ok', true, 'action', 'reject');
  end if;

  if p_action = 'request_changes' then
    if p_comment is null or length(trim(p_comment)) = 0 then
      raise exception 'a comment explaining the requested changes is required';
    end if;
    update workflow_instance_steps
      set status = 'ChangesRequested', acted_at = now(), comment = p_comment, acted_on_behalf_of = v_on_behalf
      where id = v_step.id;
    insert into comments (memo_id, org_id, author_id, body, comment_type, workflow_step_id, is_locked)
    values (p_memo_id, v_memo.org_id, v_uid, p_comment, 'change_request', v_step.id, true);
    update memos set status = 'Changes Requested', current_step_id = null
      where id = p_memo_id;
    perform notify_user(v_memo.org_id, v_memo.author_id, 'changes_requested', p_memo_id,
      'Changes requested on your memo: ' || v_subject);
    perform log_audit(v_memo.org_id, v_uid, 'change_request', 'memo', p_memo_id, p_comment);
    return json_build_object('ok', true, 'action', 'request_changes');
  end if;

  raise exception 'unknown action %', p_action;
end;
$$;

-- ============ CANCEL MEMO (author) ============

create or replace function cancel_memo(p_memo_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_memo memos%rowtype;
  v_uid uuid := auth.uid();
begin
  select * into v_memo from memos where id = p_memo_id for update;
  if not found then raise exception 'memo not found'; end if;
  if v_memo.author_id <> v_uid then raise exception 'only the author can cancel'; end if;
  if v_memo.status in ('Approved','Rejected','Cancelled') then
    raise exception 'memo already finalized';
  end if;
  update memos set status = 'Cancelled', current_step_id = null where id = p_memo_id;
  update workflow_instance_steps set status = 'Skipped'
    where memo_id = p_memo_id and status in ('Pending','Active');
  perform log_audit(v_memo.org_id, v_uid, 'memo_cancelled', 'memo', p_memo_id, v_memo.subject);
  return json_build_object('ok', true);
end;
$$;

-- ============ GENERAL COMMENT (outside workflow turn) ============
-- Workflow participants + author may comment on an accessible memo at any time.

create or replace function add_memo_comment(p_memo_id uuid, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_memo memos%rowtype;
  v_uid uuid := auth.uid();
begin
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'comment text required';
  end if;
  select * into v_memo from memos where id = p_memo_id;
  if not found then raise exception 'memo not found'; end if;
  if v_memo.org_id <> (select org_id from profiles where id = v_uid) then
    raise exception 'cross-organization access denied';
  end if;
  if v_memo.author_id <> v_uid
     and not exists (select 1 from workflow_instance_steps
                     where memo_id = p_memo_id and assigned_user_id = v_uid) then
    raise exception 'only workflow participants can comment';
  end if;
  insert into comments (memo_id, org_id, author_id, body, comment_type)
  values (p_memo_id, v_memo.org_id, v_uid, p_body, 'general');
  if v_memo.author_id <> v_uid then
    perform notify_user(v_memo.org_id, v_memo.author_id, 'comment_added', p_memo_id,
      'New comment on memo: ' || v_memo.subject);
  end if;
  perform log_audit(v_memo.org_id, v_uid, 'comment', 'memo', p_memo_id, p_body);
  return json_build_object('ok', true);
end;
$$;

-- ============ AUTH EVENT AUDIT (called from server code) ============

create or replace function log_auth_event(p_event text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select org_id into v_org from profiles where id = auth.uid();
  if v_org is not null then
    perform log_audit(v_org, auth.uid(), p_event, 'user', auth.uid(), null);
  end if;
end;
$$;
