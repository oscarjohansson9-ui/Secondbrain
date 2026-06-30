-- ============================================================
-- OnBrain — Databasinställning för Supabase
-- ============================================================
-- Klistra in HELA detta i: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Tabell 1: Installationer (för Servicehantering)
create table if not exists installations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  customer text not null,
  email text,
  type text not null,
  interval_months integer not null default 12,
  install_date date not null,
  next_service date not null,
  last_service date,
  address text,
  notes text,
  reminder_sent boolean default false,
  created_at timestamptz default now()
);

-- Tabell 2: Prislistor (för Offertgenerator)
create table if not exists pricelists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  filename text,
  updated_at timestamptz default now()
);

-- Tabell 3: Sparade analyser (för AI-flaskhalsanalys, historik)
create table if not exists analyses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  company text,
  industry text,
  bottleneck text not null,
  result text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — varje företag ser BARA sin egen data
-- ============================================================

alter table installations enable row level security;
alter table pricelists enable row level security;
alter table analyses enable row level security;

-- Installationer: man får bara se/ändra sina egna
create policy "Users can view own installations"
  on installations for select using (auth.uid() = user_id);
create policy "Users can insert own installations"
  on installations for insert with check (auth.uid() = user_id);
create policy "Users can update own installations"
  on installations for update using (auth.uid() = user_id);
create policy "Users can delete own installations"
  on installations for delete using (auth.uid() = user_id);

-- Prislistor: man får bara se/ändra sin egen
create policy "Users can view own pricelists"
  on pricelists for select using (auth.uid() = user_id);
create policy "Users can insert own pricelists"
  on pricelists for insert with check (auth.uid() = user_id);
create policy "Users can update own pricelists"
  on pricelists for update using (auth.uid() = user_id);

-- Analyser: man får bara se/skapa sina egna
create policy "Users can view own analyses"
  on analyses for select using (auth.uid() = user_id);
create policy "Users can insert own analyses"
  on analyses for insert with check (auth.uid() = user_id);

-- ============================================================
-- KLART! Du har nu tre skyddade tabeller där varje företags
-- data är helt separerad från alla andra företags data.
-- ============================================================
