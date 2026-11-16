-- إدارة المستخدمين: صلاحيات صفحات + قيود (منع حذف/تعديل) + تتبّع الدخول والاستخدام

alter table public.app_users
  add column if not exists permissions jsonb not null default '[]'::jsonb,
  add column if not exists status_note text,
  add column if not exists login_count integer not null default 0,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists created_by uuid;

alter table public.app_users
  add constraint app_users_permissions_is_array check (jsonb_typeof(permissions) = 'array');
create unique index if not exists app_users_phone_key on public.app_users (phone) where phone is not null;

create table public.activity_days (
  user_id uuid not null references public.app_users(id) on delete cascade,
  day date not null,
  hits integer not null default 1,
  primary key (user_id, day)
);
create table public.login_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  at timestamptz not null default now(),
  user_agent text
);
create index idx_login_events_user on public.login_events (user_id, at desc);

alter table public.activity_days enable row level security;
alter table public.login_events enable row level security;
create policy "activity_select" on public.activity_days for select to authenticated
  using (user_id = (select auth.uid()) or (select private.app_role()) = 'admin');
create policy "logins_select" on public.login_events for select to authenticated
  using (user_id = (select auth.uid()) or (select private.app_role()) = 'admin');

-- هل يستطيع المستخدم الحالي تنفيذ "edit" أو "delete"؟
--   admin: دائماً · staff: إلا لو عنده deny:<kind> · viewer: أبداً
create or replace function private.can(kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case role
             when 'admin' then true
             when 'staff' then not (permissions ? ('deny:' || kind))
             else false
           end
    from public.app_users
    where id = (select auth.uid()) and active
  ), false)
$$;
revoke all on function private.can(text) from public, anon;
grant execute on function private.can(text) to authenticated;

-- سياسات التعديل والحذف على جداول التشغيل تحترم القيود الفردية
do $$
declare t text;
begin
  foreach t in array array[
    'engineers','projects','suppliers','items','warehouses','cashboxes',
    'expense_types','purchase_invoices','purchase_details','stock_movements','supplier_payments',
    'project_invoices','customer_receipts','project_expenses','labor','transports','storages','cash_movements'
  ] loop
    execute format('drop policy "%s_update" on public.%I', t, t);
    execute format('drop policy "%s_delete" on public.%I', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using ((select private.can(''edit''))) with check ((select private.can(''edit'')))', t, t);
    execute format('create policy "%s_delete" on public.%I for delete to authenticated using ((select private.can(''delete'')))', t, t);
  end loop;
  -- بيانات الشركة والإعدادات: للمدير فقط
  foreach t in array array['company','settings'] loop
    execute format('drop policy "%s_insert" on public.%I', t, t);
    execute format('drop policy "%s_update" on public.%I', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check ((select private.app_role()) = ''admin'')', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using ((select private.app_role()) = ''admin'') with check ((select private.app_role()) = ''admin'')', t, t);
  end loop;
end $$;

-- تسجيل الدخول وآخر ظهور (بتوقيت القاهرة)
create or replace function public.record_login(p_ua text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.app_users where id = auth.uid()) then return; end if;
  insert into public.login_events(user_id, user_agent) values (auth.uid(), left(p_ua, 300));
  update public.app_users
     set login_count = login_count + 1, last_login_at = now(), last_seen_at = now()
   where id = auth.uid();
  insert into public.activity_days(user_id, day)
  values (auth.uid(), (now() at time zone 'Africa/Cairo')::date)
  on conflict (user_id, day) do update set hits = public.activity_days.hits + 1;
end $$;

create or replace function public.heartbeat()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.app_users where id = auth.uid()) then return; end if;
  update public.app_users set last_seen_at = now() where id = auth.uid();
  insert into public.activity_days(user_id, day)
  values (auth.uid(), (now() at time zone 'Africa/Cairo')::date)
  on conflict (user_id, day) do update set hits = public.activity_days.hits + 1;
end $$;

revoke all on function public.record_login(text), public.heartbeat() from public, anon;
grant execute on function public.record_login(text), public.heartbeat() to authenticated;
