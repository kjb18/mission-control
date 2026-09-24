-- Delivery confirmation, manual PO receipt, and the Ledger's aging index.
--
-- Note on "PO lines": purchase_orders has no line-item table of its own
-- (only quotation_id/total_amount) and this session's manual PO receipt
-- form doesn't add one either (Task 4 only asks for PO number/date/
-- amount). "Items delivered pre-filled from the PO lines" is fulfilled by
-- tracing purchase_orders.quotation_id -> quotations.rfq_id -> rfq_lines,
-- which is the actual itemized list a PO traces back to.

alter table public.deliveries
  add column delivery_note_number text,
  add column photo_path text,
  add column items_delivered jsonb;

alter table public.purchase_orders
  add column po_document_path text;

create index invoices_due_date_idx on public.invoices (due_date);

-- Private buckets — the owner uploads/reads directly from the browser, so
-- (unlike the service-role-only `quotations` bucket from session 5) these
-- need real storage RLS policies rather than relying on an Edge Function.
insert into storage.buckets (id, name, public)
values ('deliveries', 'deliveries', false), ('purchase-orders', 'purchase-orders', false)
on conflict (id) do nothing;

create policy "owner_full_access_deliveries" on storage.objects
  for all using (bucket_id = 'deliveries' and public.is_owner())
  with check (bucket_id = 'deliveries' and public.is_owner());

create policy "owner_full_access_purchase_orders" on storage.objects
  for all using (bucket_id = 'purchase-orders' and public.is_owner())
  with check (bucket_id = 'purchase-orders' and public.is_owner());
