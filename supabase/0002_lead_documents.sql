-- ────────────────────────────────────────────────────────────────────────────
-- lead-documents bucket
--
-- Private storage for paperwork customers attach to a lead (RefundAuto's
-- purchase-contract upload, and anything similar on the other sites).
--
-- Object layout:  {site}/{leadId | clientRef}/{timestamp}-{filename}
--   e.g.          refundauto.com/9f3c…/1786483667723-retail-contract.pdf
--
-- The funnel's upload step runs BEFORE the lead exists, so files land under a
-- client-generated `clientRef` UUID and the lead's meta.documents array carries
-- the resulting paths. See src/lib/storage.ts and src/app/api/leads/upload.
--
-- Access model: the bucket is private and has NO public policies. Every read
-- and write goes through the service_role key on the server, which bypasses
-- RLS. Nothing here should ever be reachable from a browser without a signed
-- URL minted by src/lib/storage.ts.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-documents',
  'lead-documents',
  false,
  20971520, -- 20MB, matches MAX_FILE_BYTES in src/lib/storage.ts
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Belt and braces: make sure no anon/authenticated policy grants access to this
-- bucket. RLS is on for storage.objects by default; we simply add no policy.
-- If you ever need a customer-facing "download my file again" flow, do it with
-- a signed URL from the server, not a policy.

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and qual like '%lead-documents%'
  ) then
    raise warning 'A policy on storage.objects references lead-documents — review it; this bucket is meant to be server-only.';
  end if;
end $$;
