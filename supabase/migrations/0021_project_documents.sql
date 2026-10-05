-- Files attached to a project, stored in the private project-documents bucket.

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size integer,
  uploaded_at timestamptz default now()
);

create index if not exists project_documents_project_id_idx on public.project_documents (project_id);

alter table public.project_documents enable row level security;
drop policy if exists "owner_all" on public.project_documents;
create policy "owner_all" on public.project_documents
  for all using (public.is_owner()) with check (public.is_owner());

insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

drop policy if exists "owner_full_access_project_documents" on storage.objects;
create policy "owner_full_access_project_documents" on storage.objects
  for all using (bucket_id = 'project-documents' and public.is_owner())
  with check (bucket_id = 'project-documents' and public.is_owner());
