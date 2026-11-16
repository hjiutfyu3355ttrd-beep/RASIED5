-- نظام الشركات المتعددة: كل شركة (حساب مسجَّل) بياناتها معزولة بالكامل عبر RLS.
-- أول حساب يُسجَّل في المنصة = مدير المنصة (platform_role = admin).
-- يستبدل الهيكل السابق (شركة واحدة) — نُفِّذ على قاعدة فارغة.

drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.activity_days, public.login_events, public.app_users, public.company, public.settings,
  public.cash_movements, public.storages, public.transports, public.labor, public.project_expenses,
  public.customer_receipts, public.project_invoices, public.supplier_payments, public.stock_movements,
  public.purchase_details, public.purchase_invoices, public.expense_types, public.cashboxes, public.warehouses,
  public.items, public.suppliers, public.projects, public.engineers cascade;
drop function if exists private.handle_new_user(), private.app_role(), private.can(text),
  public.record_login(text), public.heartbeat(), public.set_updated_at();

-- ============ الشركات والمستخدمون ============
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  currency text not null default 'ج.م',
  address text,
  inventory_method text not null default 'moving_weighted_avg',
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  phone text not null unique,
  name text not null,
  platform_role text not null default 'user' check (platform_role in ('admin','user')),
  role text not null default 'owner' check (role in ('owner','staff','viewer')),
  active boolean not null default true,
  status_note text,
  permissions jsonb not null default '[]'::jsonb check (jsonb_typeof(permissions) = 'array'),
  login_count integer not null default 0,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index idx_app_users_company on public.app_users (company_id);

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

-- ============ دوال الصلاحيات (schema خاص غير مكشوف) ============
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.my_company() returns uuid
language sql stable security definer set search_path = '' as $$
  select company_id from public.app_users where id = (select auth.uid())
$$;
create function private.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select u.active and c.status = 'active' from public.app_users u
                   join public.companies c on c.id = u.company_id where u.id = (select auth.uid())), false)
$$;
create function private.app_role() returns text
language sql stable security definer set search_path = '' as $$
  select u.role from public.app_users u join public.companies c on c.id = u.company_id
   where u.id = (select auth.uid()) and u.active and c.status = 'active'
$$;
create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select platform_role = 'admin' and active from public.app_users where id = (select auth.uid())), false)
$$;
-- owner: كل شيء · staff: إلا لو عنده deny:<kind> · viewer: أبداً
create function private.can(kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select case u.role when 'owner' then true when 'staff' then not (u.permissions ? ('deny:' || kind)) else false end
                     from public.app_users u join public.companies c on c.id = u.company_id
                    where u.id = (select auth.uid()) and u.active and c.status = 'active'), false)
$$;
revoke all on function private.my_company(), private.is_active(), private.app_role(), private.is_platform_admin(), private.can(text) from public, anon;
grant execute on function private.my_company(), private.is_active(), private.app_role(), private.is_platform_admin(), private.can(text) to authenticated;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_companies_updated before update on public.companies for each row execute function public.set_updated_at();

-- ============ جداول التشغيل (company_id + مفتاح مركّب + مفاتيح أجنبية داخل الشركة) ============
do $do$
declare
  spec jsonb := $j$[
   {"t":"engineers","code":true,"fk":[],"c":"name text not null, phone text, address text, status text not null default 'active' check (status in ('active','inactive')), notes text"},
   {"t":"projects","code":true,"fk":["engineer_id:engineers"],"c":"name text not null, engineer_id text, address text, area text, description text, start_date date, expected_end date, actual_end date, status text not null default 'new' check (status in ('new','in_progress','paused','completed','delivered','closed')), notes text"},
   {"t":"suppliers","code":true,"fk":[],"c":"name text not null, phone text, address text, activity text, opening_balance numeric(14,2) not null default 0, notes text, status text not null default 'active' check (status in ('active','inactive'))"},
   {"t":"items","code":true,"fk":["preferred_supplier_id:suppliers"],"c":"name text not null, category text, unit text, default_purchase_price numeric(14,2) not null default 0, reorder_level numeric(14,3) not null default 0, preferred_supplier_id text, notes text"},
   {"t":"warehouses","code":true,"fk":[],"c":"name text not null, location text, notes text"},
   {"t":"cashboxes","code":true,"fk":[],"c":"name text not null, opening_balance numeric(14,2) not null default 0, notes text"},
   {"t":"expense_types","code":true,"fk":[],"c":"name text not null, category text"},
   {"t":"purchase_invoices","code":true,"fk":["supplier_id:suppliers","cashbox_id:cashboxes"],"c":"date date not null default current_date, supplier_id text, payment_terms text, paid_at_purchase numeric(14,2) not null default 0, cashbox_id text, total numeric(14,2) not null default 0, balance numeric(14,2) not null default 0, notes text"},
   {"t":"purchase_details","code":false,"fk":["invoice_id:purchase_invoices:cascade","item_id:items","warehouse_id:warehouses","project_id:projects"],"c":"invoice_id text not null, item_id text, warehouse_id text, project_id text, qty numeric(14,3) not null default 0, unit_price numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0, net numeric(14,2) not null default 0, destination text not null default 'warehouse' check (destination in ('warehouse','project'))"},
   {"t":"stock_movements","code":false,"fk":["item_id:items","warehouse_id:warehouses","project_id:projects","engineer_id:engineers","original_issue_id:stock_movements"],"c":"date date not null default current_date, type text not null check (type in ('purchase_in','issue_to_project','return_from_project','purchase_direct','transfer_in','transfer_out','return_to_supplier','adjust_plus','adjust_minus')), ref text, item_id text not null, warehouse_id text, project_id text, engineer_id text, qty numeric(14,3) not null default 0, unit_cost numeric(14,4) not null default 0, value numeric(14,2) not null default 0, original_issue_id text, notes text"},
   {"t":"supplier_payments","code":true,"fk":["supplier_id:suppliers","cashbox_id:cashboxes"],"c":"date date not null default current_date, supplier_id text not null, amount numeric(14,2) not null default 0, method text, cashbox_id text, notes text"},
   {"t":"project_invoices","code":true,"fk":["project_id:projects","engineer_id:engineers"],"c":"date date not null default current_date, project_id text not null, engineer_id text, amount numeric(14,2) not null default 0, notes text"},
   {"t":"customer_receipts","code":true,"fk":["project_id:projects","engineer_id:engineers","cashbox_id:cashboxes"],"c":"date date not null default current_date, project_id text not null, engineer_id text, amount numeric(14,2) not null default 0, method text, cashbox_id text, notes text"},
   {"t":"project_expenses","code":true,"fk":["project_id:projects","engineer_id:engineers","expense_type_id:expense_types","cashbox_id:cashboxes"],"c":"date date not null default current_date, project_id text not null, engineer_id text, expense_type_id text, description text, amount numeric(14,2) not null default 0, paid numeric(14,2) not null default 0, method text, cashbox_id text, notes text"},
   {"t":"labor","code":false,"fk":["project_id:projects","engineer_id:engineers","cashbox_id:cashboxes"],"c":"date date not null default current_date, project_id text not null, engineer_id text, worker_name text, work_type text, days numeric(10,2) not null default 0, hours numeric(10,2) not null default 0, day_rate numeric(14,2) not null default 0, hour_rate numeric(14,2) not null default 0, total numeric(14,2) not null default 0, paid numeric(14,2) not null default 0, cashbox_id text, payment_status text, notes text"},
   {"t":"transports","code":true,"fk":["project_id:projects","engineer_id:engineers","cashbox_id:cashboxes"],"c":"date date not null default current_date, project_id text not null, engineer_id text, carrier text, type text, amount numeric(14,2) not null default 0, paid numeric(14,2) not null default 0, cashbox_id text, notes text"},
   {"t":"storages","code":true,"fk":["project_id:projects","engineer_id:engineers","cashbox_id:cashboxes"],"c":"date date not null default current_date, project_id text not null, engineer_id text, place text, duration numeric(10,2) not null default 0, duration_unit text, unit_price numeric(14,2) not null default 0, total numeric(14,2) not null default 0, paid numeric(14,2) not null default 0, cashbox_id text, notes text"},
   {"t":"cash_movements","code":false,"fk":["cashbox_id:cashboxes"],"c":"date date not null default current_date, cashbox_id text not null, direction text not null check (direction in ('in','out')), amount numeric(14,2) not null default 0, description text, notes text"}
  ]$j$::jsonb;
  s jsonb; t text; f text; parts text[]; fksql text; cod text;
begin
  for s in select * from jsonb_array_elements(spec) loop
    t := s->>'t';
    fksql := '';
    for f in select jsonb_array_elements_text(s->'fk') loop
      parts := string_to_array(f, ':');
      fksql := fksql || format(', foreign key (company_id, %I) references public.%I (company_id, id)%s',
                 parts[1], parts[2], case when parts[3] = 'cascade' then ' on delete cascade' else '' end);
    end loop;
    cod := case when (s->>'code')::boolean then ', code text, unique (company_id, code)' else '' end;
    execute format('create table public.%I (company_id uuid not null references public.companies(id) on delete cascade, id text not null%s, %s, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (company_id, id)%s)',
                   t, cod, s->>'c', fksql);
    execute format('create trigger trg_%s_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
    for f in select jsonb_array_elements_text(s->'fk') loop
      parts := string_to_array(f, ':');
      execute format('create index idx_%s_%s on public.%I (company_id, %I)', t, parts[1], t, parts[1]);
    end loop;
    -- RLS: عزل كامل بين الشركات + المستخدم الموقوف لا يصل لشيء
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (company_id = (select private.my_company()) and (select private.is_active()))', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (company_id = (select private.my_company()) and (select private.app_role()) in (''owner'',''staff''))', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using (company_id = (select private.my_company()) and (select private.can(''edit''))) with check (company_id = (select private.my_company()) and (select private.can(''edit'')))', t, t);
    execute format('create policy "%s_delete" on public.%I for delete to authenticated using (company_id = (select private.my_company()) and (select private.can(''delete'')))', t, t);
  end loop;
end $do$;
create index idx_stock_movements_date on public.stock_movements (company_id, date);

-- ============ RLS للشركات والمستخدمين ============
alter table public.companies enable row level security;
alter table public.app_users enable row level security;
alter table public.activity_days enable row level security;
alter table public.login_events enable row level security;

create policy companies_select on public.companies for select to authenticated using (id = (select private.my_company()));
create policy companies_update on public.companies for update to authenticated
  using (id = (select private.my_company()) and (select private.app_role()) = 'owner')
  with check (id = (select private.my_company()));
revoke update on public.companies from authenticated;
grant update (name, phone, currency, address, inventory_method, settings) on public.companies to authenticated;
revoke insert, delete on public.companies from authenticated;

create policy app_users_self on public.app_users for select to authenticated using (id = (select auth.uid()));
revoke insert, update, delete on public.app_users from authenticated;
create policy activity_select on public.activity_days for select to authenticated using (user_id = (select auth.uid()));
create policy logins_select on public.login_events for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.companies, public.app_users, public.activity_days, public.login_events from anon;

-- ============ إنشاء الحسابات (تستدعيها Edge Functions بمفتاح الخدمة فقط) ============
create function public.create_account(p_uid uuid, p_phone text, p_name text, p_company text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_pr text;
begin
  perform pg_advisory_xact_lock(7001);   -- يمنع سباق «أول مسجّل»
  v_pr := case when exists (select 1 from public.app_users) then 'user' else 'admin' end;
  insert into public.companies(name, phone, settings) values (p_company, p_phone, '{
    "project_statuses": ["جديد","جاري التنفيذ","متوقف","مكتمل","تم التسليم","مغلق"],
    "payment_methods": ["نقدي","تحويل","شيك","آجل","أخرى"],
    "payment_terms": ["نقدي","آجل","تحويل","أخرى"],
    "item_categories": ["خامات","أدوات","مستلزمات","كهرباء","سباكة","تشطيبات","دهانات","أخشاب","أخرى"],
    "units": ["قطعة","كجم","متر","متر مربع","متر مكعب","لتر","طن","ساعة","يوم","عبوة"]
  }'::jsonb) returning id into v_company;
  insert into public.app_users(id, company_id, phone, name, platform_role, role) values (p_uid, v_company, p_phone, p_name, v_pr, 'owner');
  insert into public.expense_types(company_id, id, code, name, category) values
    (v_company,'EXT-001','EXT-001','مصروفات أخرى','تشغيل'), (v_company,'EXT-002','EXT-002','تركيب','تنفيذ'),
    (v_company,'EXT-003','EXT-003','صيانة','تشغيل'), (v_company,'EXT-004','EXT-004','أدوات','مواد'),
    (v_company,'EXT-005','EXT-005','نقل مخلفات','تشغيل'), (v_company,'EXT-006','EXT-006','تحميل وتنزيل','تشغيل'),
    (v_company,'EXT-007','EXT-007','إيجار معدات','تشغيل');
  insert into public.warehouses(company_id, id, code, name) values (v_company, 'WH-0001', 'WH-0001', 'المخزن الرئيسي');
  insert into public.cashboxes(company_id, id, code, name, opening_balance) values (v_company, 'CB-0001', 'CB-0001', 'الخزينة الرئيسية', 0);
  return v_pr;
end $$;

create function public.create_staff(p_uid uuid, p_company uuid, p_phone text, p_name text, p_role text, p_perms jsonb, p_by uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_users(id, company_id, phone, name, platform_role, role, permissions, created_by)
  values (p_uid, p_company, p_phone, p_name, 'user', p_role, coalesce(p_perms, '[]'::jsonb), p_by);
end $$;
revoke all on function public.create_account(uuid, text, text, text), public.create_staff(uuid, uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_account(uuid, text, text, text), public.create_staff(uuid, uuid, text, text, text, jsonb, uuid) to service_role;

-- ============ تسجيل الدخول والنشاط (بتوقيت القاهرة) ============
create function public.record_login(p_ua text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.app_users where id = auth.uid()) then return; end if;
  insert into public.login_events(user_id, user_agent) values (auth.uid(), left(p_ua, 300));
  update public.app_users set login_count = login_count + 1, last_login_at = now(), last_seen_at = now() where id = auth.uid();
  insert into public.activity_days(user_id, day) values (auth.uid(), (now() at time zone 'Africa/Cairo')::date)
  on conflict (user_id, day) do update set hits = public.activity_days.hits + 1;
end $$;
create function public.heartbeat() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.app_users where id = auth.uid()) then return; end if;
  update public.app_users set last_seen_at = now() where id = auth.uid();
  insert into public.activity_days(user_id, day) values (auth.uid(), (now() at time zone 'Africa/Cairo')::date)
  on conflict (user_id, day) do update set hits = public.activity_days.hits + 1;
end $$;

-- ============ إدارة المنصة (مدير المنصة فقط) ============
create function private.company_rows(p_company uuid) returns table (tbl text, n bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare t text;
begin
  foreach t in array array['engineers','projects','suppliers','items','warehouses','cashboxes','expense_types','purchase_invoices',
    'purchase_details','stock_movements','supplier_payments','project_invoices','customer_receipts','project_expenses','labor',
    'transports','storages','cash_movements'] loop
    return query execute format('select %L::text, count(*), max(created_at) from public.%I where company_id = $1', t, t) using p_company;
  end loop;
end $$;
revoke all on function private.company_rows(uuid) from public, anon, authenticated;

create function public.admin_users() returns table (
  id uuid, phone text, full_name text, role text, platform_role text, active boolean, status_note text, created_at timestamptz,
  company_id uuid, company_name text, login_count integer, last_login_at timestamptz, last_seen_at timestamptz,
  days_used bigint, records_count bigint, last_record_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select u.id, u.phone, u.name, u.role, u.platform_role, u.active, u.status_note, u.created_at, u.company_id, c.name,
         u.login_count, u.last_login_at, u.last_seen_at,
         (select count(*) from public.activity_days a where a.user_id = u.id),
         (select coalesce(sum(r.n), 0)::bigint from private.company_rows(u.company_id) r),
         (select max(r.last_at) from private.company_rows(u.company_id) r)
    from public.app_users u join public.companies c on c.id = u.company_id
   order by u.created_at desc;
end $$;

create function public.admin_company_tables(p_company uuid) returns table (tbl text, n bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select r.tbl, r.n, r.last_at from private.company_rows(p_company) r where r.n > 0 order by r.tbl;
end $$;

create function public.admin_set_status(p_user uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_role text; v_company uuid;
begin
  if not private.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('active','suspended') then raise exception 'bad status'; end if;
  if p_user = auth.uid() then raise exception 'cannot change your own status'; end if;
  update public.app_users set active = (p_status = 'active'), status_note = case when p_status = 'active' then null else nullif(left(p_note, 200), '') end
   where id = p_user returning role, company_id into v_role, v_company;
  if v_role = 'owner' then
    update public.companies set status = p_status where id = v_company;   -- إيقاف المالك يوقف الشركة كلها
  end if;
end $$;

revoke all on function public.record_login(text), public.heartbeat(), public.admin_users(), public.admin_company_tables(uuid), public.admin_set_status(uuid, text, text) from public, anon;
grant execute on function public.record_login(text), public.heartbeat(), public.admin_users(), public.admin_company_tables(uuid), public.admin_set_status(uuid, text, text) to authenticated;
