-- إشعارات الهاتف (Web Push) والتطبيق مغلق — مبنية على نفس تصميم Rasied، مكيّفة لجداول المشاريع.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  company_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  prefs jsonb not null default '{}'::jsonb,
  ua text,
  fail_count int not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create table public.push_log (
  user_id uuid not null references public.app_users(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.push_log enable row level security;

create table public.push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text,
  vapid_private text,
  subject text not null default 'mailto:support@projects.local',
  cron_secret text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
alter table public.push_config enable row level security;
insert into public.push_config(id) values (1) on conflict (id) do nothing;
revoke all on public.push_subscriptions, public.push_log, public.push_config from anon, authenticated;

create function public.push_public_key() returns text
language sql stable security definer set search_path = '' as $$
  select vapid_public from public.push_config where id = 1
$$;

create function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null, p_prefs jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active() then raise exception 'not allowed'; end if;
  if p_endpoint is null or length(p_endpoint) > 1000 or p_endpoint !~
     '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
  then raise exception 'unsupported push endpoint'; end if;
  if p_p256dh is null or p_auth is null or length(p_p256dh) > 200 or length(p_auth) > 100 then raise exception 'bad keys'; end if;
  insert into public.push_subscriptions(user_id, company_id, endpoint, p256dh, auth, ua, prefs)
  values (auth.uid(), private.my_company(), p_endpoint, p_p256dh, p_auth, left(p_ua, 300), coalesce(p_prefs, '{}'::jsonb))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, company_id = excluded.company_id, p256dh = excluded.p256dh, auth = excluded.auth,
        ua = excluded.ua, prefs = excluded.prefs, fail_count = 0, last_seen_at = now();
  delete from public.push_subscriptions
   where id in (select id from public.push_subscriptions where user_id = auth.uid() order by last_seen_at desc offset 10);
end $$;

create function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

revoke all on function public.push_public_key(), public.push_subscribe(text, text, text, text, jsonb), public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_public_key(), public.push_subscribe(text, text, text, text, jsonb), public.push_unsubscribe(text) to authenticated;

-- حساب تنبيهات مستخدم (للخادم فقط): مشاريع متأخرة · مخزون وصل للحد الأدنى · مستحقات على مشاريع منتهية
create function public.push_user_alerts(p_user uuid)
returns table (akey text, atype text, asev text, atitle text, abody text, ahref text)
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid; v_owner boolean; v_perms jsonb; v_prefs jsonb;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  c_late boolean; c_stock boolean; c_recv boolean;
begin
  select u.company_id, (u.role = 'owner'), coalesce(u.permissions, '[]'::jsonb) into v_company, v_owner, v_perms
    from public.app_users u join public.companies c on c.id = u.company_id
   where u.id = p_user and u.active and c.status = 'active';
  if v_company is null then return; end if;

  select s.prefs into v_prefs from public.push_subscriptions s where s.user_id = p_user order by s.last_seen_at desc limit 1;
  v_prefs := coalesce(v_prefs, '{}'::jsonb);
  if v_prefs->>'os' = 'false' then return; end if;

  c_late  := (v_owner or v_perms @> '"projects"'::jsonb) and coalesce(v_prefs->>'late', 'true')  <> 'false';
  c_stock := (v_owner or v_perms @> '"stock"'::jsonb)    and coalesce(v_prefs->>'stock', 'true') <> 'false';
  c_recv  := (v_owner or v_perms @> '"profits"'::jsonb)  and coalesce(v_prefs->>'recv', 'true')  <> 'false';

  return query
  with a as (
    select 'late:' || l.ids as akey, 'late'::text as atype, 'danger'::text as asev,
           l.n || ' مشروع متأخر' as atitle, l.names as abody, 'projects.html'::text as ahref
      from (select count(*) as n, string_agg(x.id, ',' order by x.id) as ids,
                   string_agg(x.name, '، ' order by x.rn) filter (where x.rn <= 3) as names
              from (select p.id, p.name, row_number() over (order by p.name) as rn
                      from public.projects p
                     where c_late and p.company_id = v_company and p.status in ('new','in_progress','paused')
                       and p.expected_end is not null and p.expected_end < v_today) x) l
     where l.n > 0
    union all
    select 'stock:' || s.n || ':' || s.z, 'stock'::text, (case when s.z > 0 then 'danger' else 'warn' end)::text,
           s.n || ' صنف وصل للحد الأدنى' || case when s.z > 0 then ' (' || s.z || ' نفد)' else '' end,
           s.names || case when s.n > 3 then ' وغيرها' else '' end, 'stock.html'::text
      from (select count(*) as n, count(*) filter (where x.q <= 0) as z,
                   string_agg(x.nm, '، ' order by x.rn) filter (where x.rn <= 3) as names
              from (select i.name as nm, b.q, row_number() over (order by i.name) as rn
                      from (select m.item_id,
                                   greatest(sum(case when m.type in ('purchase_in','return_from_project','transfer_in','adjust_plus') then m.qty
                                                     when m.type in ('issue_to_project','transfer_out','return_to_supplier','adjust_minus') then -m.qty
                                                     else 0 end), 0) as q
                              from public.stock_movements m where c_stock and m.company_id = v_company group by m.item_id) b
                      join public.items i on i.company_id = v_company and i.id = b.item_id
                     where i.reorder_level > 0 and b.q <= i.reorder_level) x) s
     where s.n > 0
    union all
    select 'recv:' || r.n || ':' || round(r.total), 'recv'::text, 'warn'::text,
           r.n || ' مشروع منتهي عليه مستحقات', r.names, 'profits.html'::text
      from (select count(*) as n, sum(x.rem) as total, string_agg(x.name, '، ' order by x.rn) filter (where x.rn <= 3) as names
              from (select pr.name, row_number() over (order by pr.name) as rn,
                           coalesce(inv.s, 0) - coalesce(rc.s, 0) as rem
                      from public.projects pr
                      left join lateral (select sum(amount) as s from public.project_invoices where company_id = v_company and project_id = pr.id) inv on true
                      left join lateral (select sum(amount) as s from public.customer_receipts where company_id = v_company and project_id = pr.id) rc on true
                     where c_recv and pr.company_id = v_company and pr.status in ('completed','delivered','closed')
                       and coalesce(inv.s, 0) - coalesce(rc.s, 0) > 0.5) x) r
     where r.n > 0
  )
  select a.akey, a.atype, a.asev, a.atitle, a.abody, a.ahref from a
   where not exists (select 1 from public.push_log l where l.user_id = p_user and l.key = a.akey and l.sent_at > now() - interval '6 days');
end $$;

create function public.push_mark_sent(p_user uuid, p_keys text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_log(user_id, key) select p_user, unnest(p_keys)
  on conflict (user_id, key) do update set sent_at = now();
  delete from public.push_log where sent_at < now() - interval '30 days';
end $$;

revoke all on function public.push_user_alerts(uuid), public.push_mark_sent(uuid, text[]) from public, anon, authenticated;
grant execute on function public.push_user_alerts(uuid), public.push_mark_sent(uuid, text[]) to service_role;

-- جدولة يومية 06:00 UTC (8 صباحاً بتوقيت القاهرة شتاءً) — السرّ يُقرأ وقت التنفيذ ولا يظهر في الجدولة
select cron.schedule('projects-push-morning', '0 6 * * *', $cron$
  select net.http_post(
    url := 'https://lcbqyifyvbvgsroxghzp.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select cron_secret from public.push_config where id = 1)),
    body := '{}'::jsonb)
$cron$);
