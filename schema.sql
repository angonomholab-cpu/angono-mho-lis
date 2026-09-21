-- ============================================================
-- ANGONO MHO LIS — SUPABASE SCHEMA
-- I-run ito sa Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================================

create extension if not exists pg_trgm;   -- para sa mabilis na "LIKE %text%" search
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- FACILITIES
-- ------------------------------------------------------------
create table facilities (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  address text,
  contact_person text,
  contact_number text
);

-- ------------------------------------------------------------
-- STAFF (mga signatory: Med Tech, Pathologist, atbp.)
-- ------------------------------------------------------------
create table staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text default 'Medical Technologist',
  license text,
  sig_url text
);

-- ------------------------------------------------------------
-- USER ACCOUNTS (staff logins: ADMIN, STAFF, ENCODER, VIEWER, atbp.)
-- ------------------------------------------------------------
create table app_users (
  username text primary key,
  password text not null,
  full_name text not null,
  role text not null,             -- ADMIN, STAFF, ENCODER, VIEWER, NTP_CHECKER, DOH_TB
  facility text default 'ALL',
  status text default 'PENDING'   -- PENDING, ACTIVE, REJECTED
);

-- ------------------------------------------------------------
-- PATIENTS (masterlist)
-- ------------------------------------------------------------
create table patients (
  id text primary key,            -- e.g. MHOA-20000101-JC12
  full_name text not null,
  bday date,
  sex text,
  age text,
  address text,
  contact text,
  email text unique,
  password text,
  facility text,
  created_at timestamptz default now()
);

-- Trigram index = mabilis na "type-to-search" kahit partial ang pangalan
create index idx_patients_name_trgm on patients using gin (full_name gin_trgm_ops);

-- ------------------------------------------------------------
-- LAB TESTS / ORDERS (isang row = isang test, PENDING o COMPLETED)
-- ------------------------------------------------------------
create table lab_tests (
  id text primary key,                    -- lab serial number / test id
  patient_id text references patients(id) on delete cascade,
  patient_name text,                      -- denormalized para mabilis ang display
  test_name text not null,                -- e.g. 'GeneXpert MTB/Rif Ultra'
  test_code text not null,                -- GXP, DSSM, GXVL, SERO, HEMA, CHEM, UA, FA, DENGUE, GRAM
  details jsonb default '{}'::jsonb,      -- lahat ng dynamic fields (results, demographics extras, atbp.)
  status text default 'PENDING',          -- PENDING, COMPLETED, FOR REPEAT
  facility text,
  encoder text,
  encoder_full_name text,
  date timestamptz default now(),
  date_encoded timestamptz
);

-- Ito ang mga indexes na gagawa sa searches/filters na kasing bilis ng click
create index idx_lab_tests_status on lab_tests (status);
create index idx_lab_tests_code on lab_tests (test_code);
create index idx_lab_tests_facility on lab_tests (facility);
create index idx_lab_tests_patient on lab_tests (patient_id);
create index idx_lab_tests_details_gin on lab_tests using gin (details);
create index idx_lab_tests_name_trgm on lab_tests using gin (patient_name gin_trgm_ops);
create index idx_lab_tests_date on lab_tests (date desc);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Paalala: hindi gumagamit ang app na ito ng Supabase Auth — sarili niyang
-- login system (username/password sa app_users at patients tables). Ibig
-- sabihin, kung buksan ang RLS nang mahigpit, kailangan mo ng Edge Functions
-- na may service_role key sa likod. Para sa unang bersyon/migration, buksan
-- muna nang "allow all" ang lahat — palitan mo ito paglaon kapag handa ka nang
-- ilipat ang sensitive operations papunta sa Edge Functions.

alter table facilities enable row level security;
alter table staff enable row level security;
alter table app_users enable row level security;
alter table patients enable row level security;
alter table lab_tests enable row level security;

create policy "allow all - facilities" on facilities for all using (true) with check (true);
create policy "allow all - staff" on staff for all using (true) with check (true);
create policy "allow all - app_users" on app_users for all using (true) with check (true);
create policy "allow all - patients" on patients for all using (true) with check (true);
create policy "allow all - lab_tests" on lab_tests for all using (true) with check (true);

-- ------------------------------------------------------------
-- OPTIONAL: unang admin account (para makapag-login ka agad)
-- I-uncomment at palitan ang username/password, tapos i-run
-- ------------------------------------------------------------
-- insert into app_users (username, password, full_name, role, facility, status)
-- values ('admin', 'PALITAN_MO_ITO', 'Administrator', 'ADMIN', 'ALL', 'ACTIVE');
