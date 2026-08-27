-- Private attachments bucket + demo seed data (2 orgs for isolation demo).

-- ============ STORAGE ============

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760,
        array['application/pdf','image/png','image/jpeg','image/gif',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain'])
on conflict (id) do nothing;

-- Storage RLS: path convention org_id/memo_id/filename — first folder must match caller's org.
create policy attachments_storage_read on storage.objects for select
  using (bucket_id = 'attachments'
         and (storage.foldername(name))[1] = auth_org_id()::text);
create policy attachments_storage_insert on storage.objects for insert
  with check (bucket_id = 'attachments'
              and (storage.foldername(name))[1] = auth_org_id()::text);

-- ============ SEED HELPERS ============

create or replace function seed_demo_user(
  p_email text, p_password text, p_org uuid, p_name text,
  p_designation text, p_dept uuid, p_role text
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now()
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text,
    json_build_object('sub', v_uid::text, 'email', p_email),
    'email', now(), now(), now()
  );
  insert into profiles (id, org_id, full_name, email, designation, department_id, role)
  values (v_uid, p_org, p_name, p_email, p_designation, p_dept, p_role);
  return v_uid;
end;
$$;

-- ============ SEED DATA ============

do $$
declare
  org_a uuid; org_b uuid;
  dept_a1 uuid; dept_a2 uuid; dept_a3 uuid;
  dept_b1 uuid; dept_b2 uuid;
begin
  insert into orgs (name, identifier, contact_email)
  values ('Acme Corporation', 'ACME', 'info@acme.example')
  returning id into org_a;
  insert into orgs (name, identifier, contact_email)
  values ('Globex Industries', 'GLOBEX', 'info@globex.example')
  returning id into org_b;

  insert into departments (org_id, name, description) values (org_a, 'Administration', 'Admin dept') returning id into dept_a1;
  insert into departments (org_id, name, description) values (org_a, 'Finance', 'Finance dept') returning id into dept_a2;
  insert into departments (org_id, name, description) values (org_a, 'Engineering', 'Engineering dept') returning id into dept_a3;
  insert into departments (org_id, name, description) values (org_b, 'Operations', 'Ops dept') returning id into dept_b1;
  insert into departments (org_id, name, description) values (org_b, 'HR', 'HR dept') returning id into dept_b2;

  insert into memo_categories (org_id, name) values
    (org_a, 'Administrative'), (org_a, 'Financial'), (org_a, 'Procurement'),
    (org_a, 'HR'), (org_a, 'Technical'), (org_a, 'General'),
    (org_b, 'Administrative'), (org_b, 'Financial'), (org_b, 'General');

  -- Acme users (demo password: Passw0rd! for all)
  perform seed_demo_user('admin@acme.example',   'Passw0rd!', org_a, 'Alice Admin',    'Administrator',    dept_a1, 'org_admin');
  perform seed_demo_user('bob@acme.example',     'Passw0rd!', org_a, 'Bob Employee',   'Engineer',         dept_a3, 'user');
  perform seed_demo_user('carol@acme.example',   'Passw0rd!', org_a, 'Carol Head',     'Department Head',  dept_a3, 'user');
  perform seed_demo_user('dave@acme.example',    'Passw0rd!', org_a, 'Dave Finance',   'Finance Manager',  dept_a2, 'user');
  perform seed_demo_user('erin@acme.example',    'Passw0rd!', org_a, 'Erin Director',  'Director',         dept_a1, 'user');

  -- Globex users
  perform seed_demo_user('admin@globex.example', 'Passw0rd!', org_b, 'Grace Admin',    'Administrator',    dept_b1, 'org_admin');
  perform seed_demo_user('henry@globex.example', 'Passw0rd!', org_b, 'Henry Ops',      'Operations Lead',  dept_b1, 'user');
end;
$$;
