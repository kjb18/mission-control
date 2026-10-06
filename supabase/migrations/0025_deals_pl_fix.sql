-- COGS and shipping now come only from deal_expenses / project_expenses rows;
-- the frontend no longer reads deals.cogs / deals.shipping_cost. The generated
-- profit columns were built from those, so they become plain columns kept
-- for existing data only.
alter table deals drop column if exists gross_profit;
alter table deals drop column if exists gross_margin_percent;
alter table deals add column if not exists gross_profit numeric default 0;
alter table deals add column if not exists gross_margin_percent numeric default 0;
