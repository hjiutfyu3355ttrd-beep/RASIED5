-- (مطبَّق على Supabase) مرتجعات الموردين + إعادة حساب المتوسط المرجح + حفظ فاتورة المشتريات كمعاملة واحدة
alter table public.stock_movements add column if not exists supplier_id text;
alter table public.stock_movements
  add constraint stock_movements_company_id_supplier_id_fkey
  foreign key (company_id, supplier_id) references public.suppliers (company_id, id);
create index if not exists stock_movements_supplier_idx on public.stock_movements (company_id, supplier_id);
create index if not exists stock_movements_project_idx on public.stock_movements (company_id, project_id);
create index if not exists stock_movements_item_idx on public.stock_movements (company_id, item_id, warehouse_id, date);
create index if not exists purchase_details_invoice_idx on public.purchase_details (company_id, invoice_id);

create or replace function public.recalc_stock()
returns void language plpgsql security invoker set search_path = public as $$
declare
  cid uuid := (select private.my_company());
  r record; k text; q numeric; v numeric; a numeric; c numeric; ov numeric;
  st jsonb := '{}'::jsonb; costs jsonb := '{}'::jsonb;
begin
  if cid is null then return; end if;
  for r in select id, type, item_id, warehouse_id, qty, unit_cost, value, ref, original_issue_id
           from public.stock_movements where company_id = cid order by date, created_at, id
  loop
    k := r.item_id || '|' || coalesce(r.warehouse_id, '');
    q := coalesce((st -> k ->> 'q')::numeric, 0); v := coalesce((st -> k ->> 'v')::numeric, 0);
    if r.type in ('purchase_in', 'return_from_project', 'transfer_in', 'adjust_plus') then
      c := r.unit_cost;
      if r.type = 'return_from_project' and r.original_issue_id is not null and costs ? r.original_issue_id then c := (costs ->> r.original_issue_id)::numeric;
      elsif r.type = 'transfer_in' and r.ref is not null and costs ? r.ref then c := (costs ->> r.ref)::numeric; end if;
      ov := case when r.type in ('return_from_project', 'transfer_in') and c is not null and c <> r.unit_cost then round(r.qty * c, 2)
                 when r.value <> 0 then r.value else round(r.qty * c, 2) end;
      if abs(coalesce(c,0) - r.unit_cost) > 0.004 or abs(ov - r.value) > 0.004 then
        update public.stock_movements set unit_cost = coalesce(c, unit_cost), value = ov where company_id = cid and id = r.id;
      end if;
      q := q + r.qty; v := v + ov;
    elsif r.type in ('issue_to_project', 'transfer_out', 'return_to_supplier', 'adjust_minus') then
      a := round(case when q > 0 then v / q else r.unit_cost end, 2);
      ov := round(r.qty * a, 2);
      if abs(r.unit_cost - a) > 0.004 or abs(r.value - ov) > 0.004 then
        update public.stock_movements set unit_cost = a, value = ov where company_id = cid and id = r.id;
      end if;
      costs := jsonb_set(costs, array[r.id], to_jsonb(a));
      q := q - r.qty; v := v - ov;
      if q <= 0.0001 then q := 0; v := 0; end if;
    end if;
    st := jsonb_set(st, array[k], jsonb_build_object('q', q, 'v', v));
  end loop;
end; $$;

create or replace function public.save_purchase_invoice(p_invoice jsonb, p_lines jsonb)
returns text language plpgsql security invoker set search_path = public as $$
declare
  cid uuid := (select private.my_company()); inv_id text := p_invoice ->> 'id';
  l jsonb; total numeric := 0; net numeric; did text; n int := 0; eng text;
  paid numeric := coalesce((p_invoice ->> 'paid_at_purchase')::numeric, 0);
begin
  if cid is null then raise exception 'no company'; end if;
  if inv_id is null or inv_id = '' then raise exception 'invoice id required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'الفاتورة بلا أصناف'; end if;
  delete from public.stock_movements where company_id = cid and type in ('purchase_in', 'purchase_direct')
     and ref in (select id from public.purchase_details where company_id = cid and invoice_id = inv_id);
  delete from public.purchase_details where company_id = cid and invoice_id = inv_id;
  for l in select * from jsonb_array_elements(p_lines) loop
    total := total + round(coalesce((l ->> 'qty')::numeric, 0) * coalesce((l ->> 'unit_price')::numeric, 0)
                 - coalesce((l ->> 'discount')::numeric, 0) + coalesce((l ->> 'tax')::numeric, 0), 2);
  end loop;
  insert into public.purchase_invoices (company_id, id, code, date, supplier_id, payment_terms, paid_at_purchase, cashbox_id, total, balance, notes)
  values (cid, inv_id, coalesce(nullif(p_invoice ->> 'code', ''), inv_id), coalesce(nullif(p_invoice ->> 'date', '')::date, current_date),
          nullif(p_invoice ->> 'supplier_id', ''), nullif(p_invoice ->> 'payment_terms', ''), paid, nullif(p_invoice ->> 'cashbox_id', ''), total, total - paid, nullif(p_invoice ->> 'notes', ''))
  on conflict (company_id, id) do update set code = excluded.code, date = excluded.date, supplier_id = excluded.supplier_id,
    payment_terms = excluded.payment_terms, paid_at_purchase = excluded.paid_at_purchase, cashbox_id = excluded.cashbox_id,
    total = excluded.total, balance = excluded.balance, notes = excluded.notes, updated_at = now();
  for l in select * from jsonb_array_elements(p_lines) loop
    n := n + 1;
    did := coalesce(nullif(l ->> 'id', ''), inv_id || '-' || lpad(n::text, 2, '0'));
    net := round(coalesce((l ->> 'qty')::numeric, 0) * coalesce((l ->> 'unit_price')::numeric, 0)
                 - coalesce((l ->> 'discount')::numeric, 0) + coalesce((l ->> 'tax')::numeric, 0), 2);
    insert into public.purchase_details (company_id, id, invoice_id, item_id, warehouse_id, project_id, qty, unit_price, discount, tax, net, destination)
    values (cid, did, inv_id, nullif(l ->> 'item_id', ''),
            case when l ->> 'destination' = 'project' then null else nullif(l ->> 'warehouse_id', '') end,
            case when l ->> 'destination' = 'project' then nullif(l ->> 'project_id', '') else null end,
            coalesce((l ->> 'qty')::numeric, 0), coalesce((l ->> 'unit_price')::numeric, 0), coalesce((l ->> 'discount')::numeric, 0),
            coalesce((l ->> 'tax')::numeric, 0), net, coalesce(nullif(l ->> 'destination', ''), 'warehouse'));
    if l ->> 'destination' = 'project' then
      select engineer_id into eng from public.projects where company_id = cid and id = nullif(l ->> 'project_id', '');
      insert into public.stock_movements (company_id, id, date, type, ref, item_id, warehouse_id, project_id, engineer_id, qty, unit_cost, value)
      values (cid, 'SM-' || did, coalesce(nullif(p_invoice ->> 'date', '')::date, current_date), 'purchase_direct', did, l ->> 'item_id', null,
              nullif(l ->> 'project_id', ''), eng, (l ->> 'qty')::numeric, case when (l ->> 'qty')::numeric > 0 then round(net / (l ->> 'qty')::numeric, 2) else 0 end, net);
    else
      insert into public.stock_movements (company_id, id, date, type, ref, item_id, warehouse_id, qty, unit_cost, value)
      values (cid, 'SM-' || did, coalesce(nullif(p_invoice ->> 'date', '')::date, current_date), 'purchase_in', did, l ->> 'item_id', nullif(l ->> 'warehouse_id', ''),
              (l ->> 'qty')::numeric, case when (l ->> 'qty')::numeric > 0 then round(net / (l ->> 'qty')::numeric, 2) else 0 end, net);
    end if;
  end loop;
  perform public.recalc_stock();
  return inv_id;
end; $$;

create or replace function public.delete_purchase_invoice(p_id text)
returns void language plpgsql security invoker set search_path = public as $$
declare cid uuid := (select private.my_company());
begin
  if cid is null then raise exception 'no company'; end if;
  delete from public.stock_movements where company_id = cid and type in ('purchase_in', 'purchase_direct')
     and ref in (select id from public.purchase_details where company_id = cid and invoice_id = p_id);
  delete from public.purchase_details where company_id = cid and invoice_id = p_id;
  delete from public.purchase_invoices where company_id = cid and id = p_id;
  perform public.recalc_stock();
end; $$;

revoke all on function public.recalc_stock() from public, anon;
revoke all on function public.save_purchase_invoice(jsonb, jsonb) from public, anon;
revoke all on function public.delete_purchase_invoice(text) from public, anon;
grant execute on function public.recalc_stock() to authenticated;
grant execute on function public.save_purchase_invoice(jsonb, jsonb) to authenticated;
grant execute on function public.delete_purchase_invoice(text) to authenticated;
