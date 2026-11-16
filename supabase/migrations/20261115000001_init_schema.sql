-- نظام إدارة المشاريع والتشطيبات — المخطط الأساسي
-- المعرّفات نصية (text) لتتوافق مع الواجهة (PRJ-0001 / UUID مولّد من المتصفح)

-- ============ جداول الأساس ============
create table public.company (
  id text primary key,
  name text not null,
  phone text,
  currency text default 'ج.م',
  address text,
  inventory_method text default 'moving_weighted_avg',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.engineers (
  id text primary key,
  code text unique,
  name text not null,
  phone text,
  address text,
  status text not null default 'active' check (status in ('active','inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id text primary key,
  code text unique,
  name text not null,
  engineer_id text references public.engineers(id),
  address text,
  area text,
  description text,
  start_date date,
  expected_end date,
  actual_end date,
  status text not null default 'new' check (status in ('new','in_progress','paused','completed','delivered','closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id text primary key,
  code text unique,
  name text not null,
  phone text,
  address text,
  activity text,
  opening_balance numeric(14,2) not null default 0,
  notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id text primary key,
  code text unique,
  name text not null,
  category text,
  unit text,
  default_purchase_price numeric(14,2) not null default 0,
  reorder_level numeric(14,3) not null default 0,
  preferred_supplier_id text references public.suppliers(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.warehouses (
  id text primary key,
  code text unique,
  name text not null,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cashboxes (
  id text primary key,
  code text unique,
  name text not null,
  opening_balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_types (
  id text primary key,
  code text unique,
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ المشتريات والمخزون ============
create table public.purchase_invoices (
  id text primary key,
  code text unique,
  date date not null default current_date,
  supplier_id text references public.suppliers(id),
  payment_terms text,
  paid_at_purchase numeric(14,2) not null default 0,
  cashbox_id text references public.cashboxes(id),
  total numeric(14,2) not null default 0,
  balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_details (
  id text primary key,
  invoice_id text not null references public.purchase_invoices(id) on delete cascade,
  item_id text references public.items(id),
  warehouse_id text references public.warehouses(id),
  project_id text references public.projects(id),
  qty numeric(14,3) not null default 0,
  unit_price numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  net numeric(14,2) not null default 0,
  destination text not null default 'warehouse' check (destination in ('warehouse','project')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_movements (
  id text primary key,
  date date not null default current_date,
  type text not null check (type in ('purchase_in','issue_to_project','return_from_project','purchase_direct','transfer_in','transfer_out','return_to_supplier','adjust_plus','adjust_minus')),
  ref text,
  item_id text not null references public.items(id),
  warehouse_id text references public.warehouses(id),
  project_id text references public.projects(id),
  engineer_id text references public.engineers(id),
  qty numeric(14,3) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  value numeric(14,2) not null default 0,
  original_issue_id text references public.stock_movements(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ المالية ============
create table public.supplier_payments (
  id text primary key,
  code text unique,
  date date not null default current_date,
  supplier_id text not null references public.suppliers(id),
  amount numeric(14,2) not null default 0,
  method text,
  cashbox_id text references public.cashboxes(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_invoices (
  id text primary key,
  code text unique,
  date date not null default current_date,
  project_id text not null references public.projects(id),
  engineer_id text references public.engineers(id),
  amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_receipts (
  id text primary key,
  code text unique,
  date date not null default current_date,
  project_id text not null references public.projects(id),
  engineer_id text references public.engineers(id),
  amount numeric(14,2) not null default 0,
  method text,
  cashbox_id text references public.cashboxes(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_expenses (
  id text primary key,
  code text unique,
  date date not null default current_date,
  project_id text not null references public.projects(id),
  engineer_id text references public.engineers(id),
  expense_type_id text references public.expense_types(id),
  description text,
  amount numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  method text,
  cashbox_id text references public.cashboxes(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.labor (
  id text primary key,
  date date not null default current_date,
  project_id text not null references public.projects(id),
  engineer_id text references public.engineers(id),
  worker_name text,
  work_type text,
  days numeric(10,2) not null default 0,
  hours numeric(10,2) not null default 0,
  day_rate numeric(14,2) not null default 0,
  hour_rate numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  cashbox_id text references public.cashboxes(id),
  payment_status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transports (
  id text primary key,
  code text unique,
  date date not null default current_date,
  project_id text not null references public.projects(id),
  engineer_id text references public.engineers(id),
  carrier text,
  type text,
  amount numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  cashbox_id text references public.cashboxes(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.storages (
  id text primary key,
  code text unique,
  date date not null default current_date,
  project_id text not null references public.projects(id),
  engineer_id text references public.engineers(id),
  place text,
  duration numeric(10,2) not null default 0,
  duration_unit text,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  cashbox_id text references public.cashboxes(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cash_movements (
  id text primary key,
  date date not null default current_date,
  cashbox_id text not null references public.cashboxes(id),
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null default 0,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ المستخدمون والصلاحيات ============
create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  role text not null default 'staff' check (role in ('admin','staff','viewer')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- دور المستخدم الحالي (null إن لم يكن مفعّلاً)
create or replace function private.app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.app_users where id = (select auth.uid()) and active
$$;
revoke all on function private.app_role() from public, anon;
grant execute on function private.app_role() to authenticated;

-- أول مستخدم يُنشأ = مدير مفعّل، والباقي بانتظار التفعيل
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.app_users) then
    insert into public.app_users (id, name, role, active)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'admin', true);
  else
    insert into public.app_users (id, name, role, active)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'staff', false);
  end if;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- مستخدمون موجودون مسبقاً (إن وُجدوا)
insert into public.app_users (id, name, role, active)
select u.id, split_part(u.email, '@', 1),
       case when row_number() over (order by u.created_at) = 1 then 'admin' else 'staff' end,
       row_number() over (order by u.created_at) = 1
from auth.users u
on conflict (id) do nothing;

-- ============ updated_at ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ RLS + Triggers ============
do $$
declare t text;
begin
  foreach t in array array[
    'company','settings','engineers','projects','suppliers','items','warehouses','cashboxes',
    'expense_types','purchase_invoices','purchase_details','stock_movements','supplier_payments',
    'project_invoices','customer_receipts','project_expenses','labor','transports','storages','cash_movements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger trg_%s_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using ((select private.app_role()) is not null)', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check ((select private.app_role()) in (''admin'',''staff''))', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using ((select private.app_role()) in (''admin'',''staff'')) with check ((select private.app_role()) in (''admin'',''staff''))', t, t);
    execute format('create policy "%s_delete" on public.%I for delete to authenticated using ((select private.app_role()) = ''admin'')', t, t);
  end loop;
end $$;

alter table public.app_users enable row level security;
create policy "app_users_select" on public.app_users for select to authenticated
  using (id = (select auth.uid()) or (select private.app_role()) = 'admin');
create policy "app_users_insert" on public.app_users for insert to authenticated
  with check ((select private.app_role()) = 'admin');
create policy "app_users_update" on public.app_users for update to authenticated
  using ((select private.app_role()) = 'admin') with check ((select private.app_role()) = 'admin');
create policy "app_users_delete" on public.app_users for delete to authenticated
  using ((select private.app_role()) = 'admin');

-- ============ فهارس المفاتيح الأجنبية ============
do $$
declare p text;
begin
  foreach p in array array[
    'projects.engineer_id','items.preferred_supplier_id',
    'purchase_invoices.supplier_id','purchase_invoices.cashbox_id',
    'purchase_details.invoice_id','purchase_details.item_id','purchase_details.warehouse_id','purchase_details.project_id',
    'stock_movements.item_id','stock_movements.warehouse_id','stock_movements.project_id','stock_movements.engineer_id','stock_movements.original_issue_id','stock_movements.date',
    'supplier_payments.supplier_id','supplier_payments.cashbox_id',
    'project_invoices.project_id','project_invoices.engineer_id',
    'customer_receipts.project_id','customer_receipts.engineer_id','customer_receipts.cashbox_id',
    'project_expenses.project_id','project_expenses.engineer_id','project_expenses.expense_type_id','project_expenses.cashbox_id',
    'labor.project_id','labor.engineer_id','labor.cashbox_id',
    'transports.project_id','transports.engineer_id','transports.cashbox_id',
    'storages.project_id','storages.engineer_id','storages.cashbox_id',
    'cash_movements.cashbox_id'
  ] loop
    execute format('create index if not exists idx_%s_%s on public.%I (%I)',
      split_part(p,'.',1), split_part(p,'.',2), split_part(p,'.',1), split_part(p,'.',2));
  end loop;
end $$;

-- ============ بيانات مرجعية أساسية (بدون بيانات تجريبية) ============
insert into public.company (id, name, phone, currency, address, inventory_method)
values ('comp-1', 'شركة التشطيبات', '', 'ج.م', '', 'moving_weighted_avg');

insert into public.settings (id, data) values ('main', '{
  "project_statuses": ["جديد","جاري التنفيذ","متوقف","مكتمل","تم التسليم","مغلق"],
  "payment_methods": ["نقدي","تحويل","شيك","آجل","أخرى"],
  "payment_terms": ["نقدي","آجل","تحويل","أخرى"],
  "item_categories": ["خامات","أدوات","مستلزمات","كهرباء","سباكة","تشطيبات","دهانات","أخشاب","أخرى"],
  "units": ["قطعة","كجم","متر","متر مربع","متر مكعب","لتر","طن","ساعة","يوم","عبوة"],
  "stock_types": [
    {"key":"purchase_in","label":"شراء للمخزن"},
    {"key":"issue_to_project","label":"صرف للمشروع"},
    {"key":"return_from_project","label":"مرتجع من المشروع"},
    {"key":"purchase_direct","label":"شراء مباشر للمشروع"},
    {"key":"transfer_in","label":"تحويل وارد"},
    {"key":"transfer_out","label":"تحويل صادر"},
    {"key":"return_to_supplier","label":"مرتجع للمورد"},
    {"key":"adjust_plus","label":"تسوية زيادة"},
    {"key":"adjust_minus","label":"تسوية عجز"}
  ]
}'::jsonb);

insert into public.expense_types (id, code, name, category) values
  ('EXT-001','EXT-001','مصروفات أخرى','تشغيل'),
  ('EXT-002','EXT-002','تركيب','تنفيذ'),
  ('EXT-003','EXT-003','صيانة','تشغيل'),
  ('EXT-004','EXT-004','أدوات','مواد'),
  ('EXT-005','EXT-005','نقل مخلفات','تشغيل'),
  ('EXT-006','EXT-006','تحميل وتنزيل','تشغيل'),
  ('EXT-007','EXT-007','إيجار معدات','تشغيل');
