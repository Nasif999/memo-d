-- Inter-Office Memo Management System — schema + RLS
-- All tenant-scoped tables carry org_id; RLS is the hard isolation backstop.

create extension if not exists pgcrypto;

-- ============ TABLES ============

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  identifier text not null unique,
  logo_url text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references orgs(id),
  full_name text not null,
  email text not null,
  designation text,
  department_id uuid references departments(id),
  role text not null default 'user' check (role in ('org_admin','user')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memo_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table workflow_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table workflow_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workflow_templates(id) on delete cascade,
  step_order int not null,
  position_label text not null,
  unique (template_id, step_order)
);

create table org_memo_counters (
  org_id uuid primary key references orgs(id),
  next_number int not null default 1
);

create table memos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  memo_number text,
  subject text not null,
  body text not null default '',
  author_id uuid not null references profiles(id),
  department_id uuid references departments(id),
  category_id uuid references memo_categories(id),
  priority text not null default 'Normal' check (priority in ('Normal','High','Urgent')),
  status text not null default 'Draft' check (status in
    ('Draft','Submitted','Pending Review','Pending Approval','Changes Requested','Rejected','Approved','Cancelled')),
  current_step_id uuid,
  workflow_template_id uuid references workflow_templates(id),
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  unique (org_id, memo_number)
);

create table memo_versions (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references memos(id) on delete cascade,
  org_id uuid not null references orgs(id),
  version_number int not null,
  subject text not null,
  body text not null,
  edited_by uuid not null references profiles(id),
  change_reason text,
  created_at timestamptz not null default now(),
  unique (memo_id, version_number)
);

create table workflow_instance_steps (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references memos(id) on delete cascade,
  org_id uuid not null references orgs(id),
  step_order int not null,
  assigned_user_id uuid not null references profiles(id),
  position_label text,
  status text not null default 'Pending' check (status in
    ('Pending','Active','Approved','Rejected','ChangesRequested','Skipped')),
  acted_at timestamptz,
  comment text,
  acted_on_behalf_of uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (memo_id, step_order)
);

alter table memos
  add constraint memos_current_step_fk
  foreign key (current_step_id) references workflow_instance_steps(id);

create table comments (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references memos(id) on delete cascade,
  org_id uuid not null references orgs(id),
  author_id uuid not null references profiles(id),
  body text not null,
  comment_type text not null default 'general' check (comment_type in
    ('general','approval','rejection','change_request')),
  workflow_step_id uuid references workflow_instance_steps(id),
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references memos(id) on delete cascade,
  org_id uuid not null references orgs(id),
  storage_path text not null,
  filename text not null,
  size_bytes bigint not null,
  mime_type text not null,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  memo_id uuid references memos(id) on delete set null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  actor_id uuid references profiles(id),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table delegations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  delegator_id uuid not null references profiles(id),
  delegate_id uuid not null references profiles(id),
  start_date date not null,
  end_date date not null,
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ INDEXES ============

create index idx_profiles_org on profiles(org_id);
create index idx_departments_org on departments(org_id);
create index idx_memos_org on memos(org_id);
create index idx_memos_author on memos(author_id);
create index idx_memos_status on memos(org_id, status);
create index idx_steps_memo on workflow_instance_steps(memo_id);
create index idx_steps_assignee on workflow_instance_steps(assigned_user_id, status);
create index idx_comments_memo on comments(memo_id);
create index idx_attachments_memo on attachments(memo_id);
create index idx_notifications_user on notifications(user_id, is_read);
create index idx_audit_org on audit_log(org_id, created_at desc);

-- ============ HELPER FUNCTIONS (used in policies) ============

create or replace function auth_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from profiles where id = auth.uid()), false)
$$;

-- ============ RLS ============

alter table orgs enable row level security;
alter table departments enable row level security;
alter table profiles enable row level security;
alter table memo_categories enable row level security;
alter table workflow_templates enable row level security;
alter table workflow_template_steps enable row level security;
alter table org_memo_counters enable row level security;
alter table memos enable row level security;
alter table memo_versions enable row level security;
alter table workflow_instance_steps enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;
alter table delegations enable row level security;

-- orgs: members can read own org; admins can update it
create policy orgs_select on orgs for select
  using (id = auth_org_id());
create policy orgs_update on orgs for update
  using (id = auth_org_id() and auth_role() = 'org_admin')
  with check (id = auth_org_id());

-- departments: org members read; admins write
create policy departments_select on departments for select
  using (org_id = auth_org_id());
create policy departments_admin_ins on departments for insert
  with check (org_id = auth_org_id() and auth_role() = 'org_admin');
create policy departments_admin_upd on departments for update
  using (org_id = auth_org_id() and auth_role() = 'org_admin')
  with check (org_id = auth_org_id());

-- profiles: org members read each other; self-update limited (role/org/status guarded by trigger below)
create policy profiles_select on profiles for select
  using (org_id = auth_org_id());
create policy profiles_self_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_admin_update on profiles for update
  using (org_id = auth_org_id() and auth_role() = 'org_admin')
  with check (org_id = auth_org_id());

-- Guard: non-admins cannot change their own role/org_id/status
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth_role() <> 'org_admin' then
    if new.role <> old.role or new.org_id <> old.org_id or new.status <> old.status then
      raise exception 'not allowed to change role, org, or status';
    end if;
  end if;
  if new.org_id <> old.org_id then
    raise exception 'org_id is immutable';
  end if;
  return new;
end;
$$;
create trigger trg_guard_profile_update
  before update on profiles
  for each row execute function guard_profile_update();

-- memo_categories: org read; admin write
create policy categories_select on memo_categories for select
  using (org_id = auth_org_id());
create policy categories_admin_ins on memo_categories for insert
  with check (org_id = auth_org_id() and auth_role() = 'org_admin');
create policy categories_admin_upd on memo_categories for update
  using (org_id = auth_org_id() and auth_role() = 'org_admin')
  with check (org_id = auth_org_id());

-- workflow templates: org read; admin write
create policy templates_select on workflow_templates for select
  using (org_id = auth_org_id());
create policy templates_admin_ins on workflow_templates for insert
  with check (org_id = auth_org_id() and auth_role() = 'org_admin');
create policy templates_admin_upd on workflow_templates for update
  using (org_id = auth_org_id() and auth_role() = 'org_admin')
  with check (org_id = auth_org_id());
create policy template_steps_select on workflow_template_steps for select
  using (exists (select 1 from workflow_templates t
                 where t.id = template_id and t.org_id = auth_org_id()));
create policy template_steps_admin_ins on workflow_template_steps for insert
  with check (auth_role() = 'org_admin' and exists
    (select 1 from workflow_templates t where t.id = template_id and t.org_id = auth_org_id()));
create policy template_steps_admin_del on workflow_template_steps for delete
  using (auth_role() = 'org_admin' and exists
    (select 1 from workflow_templates t where t.id = template_id and t.org_id = auth_org_id()));

-- memos: non-drafts visible org-wide (active users); drafts only to author
create policy memos_select on memos for select
  using (org_id = auth_org_id() and auth_is_active()
         and (status <> 'Draft' or author_id = auth.uid()));
create policy memos_insert on memos for insert
  with check (org_id = auth_org_id() and author_id = auth.uid() and auth_is_active());
-- author edits own draft / changes-requested memo; system transitions happen via security-definer fns
create policy memos_author_update on memos for update
  using (org_id = auth_org_id() and author_id = auth.uid()
         and status in ('Draft','Changes Requested'))
  with check (org_id = auth_org_id() and author_id = auth.uid());
create policy memos_author_delete_draft on memos for delete
  using (org_id = auth_org_id() and author_id = auth.uid() and status = 'Draft');

-- memo_versions: readable with memo; insert via functions only (no user policy needed but allow author insert)
create policy versions_select on memo_versions for select
  using (org_id = auth_org_id());
create policy versions_insert on memo_versions for insert
  with check (org_id = auth_org_id() and edited_by = auth.uid());

-- workflow steps: org members read; only current assignee may update their Active step (backstop; real logic in RPC)
create policy steps_select on workflow_instance_steps for select
  using (org_id = auth_org_id());
create policy steps_action on workflow_instance_steps for update
  using (org_id = auth_org_id() and assigned_user_id = auth.uid() and status = 'Active')
  with check (org_id = auth_org_id());

-- comments: org members read; insert own; NO update/delete for ordinary users (immutability)
create policy comments_select on comments for select
  using (org_id = auth_org_id());
create policy comments_insert on comments for insert
  with check (org_id = auth_org_id() and author_id = auth.uid() and auth_is_active());

-- attachments: metadata follows memo visibility; upload by org members
create policy attachments_select on attachments for select
  using (org_id = auth_org_id() and exists
    (select 1 from memos m where m.id = memo_id));  -- memos RLS applies in subquery via caller
create policy attachments_insert on attachments for insert
  with check (org_id = auth_org_id() and uploaded_by = auth.uid() and auth_is_active());
create policy attachments_delete on attachments for delete
  using (org_id = auth_org_id() and uploaded_by = auth.uid());

-- notifications: own only
create policy notifications_select on notifications for select
  using (user_id = auth.uid());
create policy notifications_update on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_log: admins read; nobody updates/deletes; inserts via security-definer functions
create policy audit_select_admin on audit_log for select
  using (org_id = auth_org_id() and auth_role() = 'org_admin');

-- delegations: own + admin visibility
create policy delegations_select on delegations for select
  using (org_id = auth_org_id() and
         (delegator_id = auth.uid() or delegate_id = auth.uid() or auth_role() = 'org_admin'));
create policy delegations_insert on delegations for insert
  with check (org_id = auth_org_id() and delegator_id = auth.uid());
create policy delegations_update on delegations for update
  using (org_id = auth_org_id() and delegator_id = auth.uid())
  with check (org_id = auth_org_id());

-- updated_at maintenance
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_touch_orgs before update on orgs
  for each row execute function touch_updated_at();
create trigger trg_touch_profiles before update on profiles
  for each row execute function touch_updated_at();
create trigger trg_touch_memos before update on memos
  for each row execute function touch_updated_at();
