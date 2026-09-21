-- Phase 1b: hospitals + hospital_modules
--
-- RLS is enabled on both tables immediately, with zero policies in
-- this migration. That means both tables deny ALL access to the
-- `authenticated` role until 20260922000002 adds SELECT policies
-- (which need helper functions that depend on `profiles`, created in
-- that same migration). A table with RLS enabled and no policies is
-- the safe failure mode; it is never "unprotected" at any point.
-- Writes to these tables only ever happen via the service-role client
-- (seed script now, provisioning module from Phase 1c), which bypasses
-- RLS by design and does not need a policy here.

create extension if not exists pgcrypto;

create type hospital_status as enum ('TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED');
create type module_type as enum ('GENERAL_OPD', 'USG');

create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  status hospital_status not null default 'TRIAL',
  -- Plan tier names are never enumerated in the product brief, so this
  -- stays a plain string rather than an invented enum.
  plan text not null default 'TRIAL',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hospitals is
  'One row per tenant centre (hospital or standalone USG centre).';

create table public.hospital_modules (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id) on delete cascade,
  module module_type not null,
  enabled_at timestamptz not null default now(),
  unique (hospital_id, module)
);

comment on table public.hospital_modules is
  'Which product modules (GENERAL_OPD, USG) a hospital has enabled.';

create index hospital_modules_hospital_id_idx on public.hospital_modules (hospital_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger hospitals_set_updated_at
  before update on public.hospitals
  for each row
  execute function public.set_updated_at();

alter table public.hospitals enable row level security;
alter table public.hospital_modules enable row level security;
