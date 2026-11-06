create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('weight', 'sleep', 'exercise')),
  value numeric not null,
  date date not null,
  activity text,
  created_at timestamptz not null default now()
);

create index if not exists entries_user_id_idx on entries (user_id);

alter table entries enable row level security;

drop policy if exists "cada pessoa vê os próprios registros" on entries;
create policy "cada pessoa vê os próprios registros" on entries
  for select using (auth.uid() = user_id);

drop policy if exists "cada pessoa insere os próprios registros" on entries;
create policy "cada pessoa insere os próprios registros" on entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "cada pessoa apaga os próprios registros" on entries;
create policy "cada pessoa apaga os próprios registros" on entries
  for delete using (auth.uid() = user_id);

alter table entries drop constraint if exists entries_value_range;
alter table entries add constraint entries_value_range check (
  (type = 'weight'   and value > 0  and value <= 500)  or
  (type = 'sleep'    and value >= 0 and value <= 24)   or
  (type = 'exercise' and value > 0  and value <= 1440)
) not valid;

alter table entries drop constraint if exists entries_activity_length;
alter table entries add constraint entries_activity_length check (
  activity is null or char_length(activity) <= 100
) not valid;

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  points integer not null default 10,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists goals_user_id_idx on goals (user_id);
alter table goals enable row level security;

drop policy if exists "cada pessoa vê as próprias metas" on goals;
create policy "cada pessoa vê as próprias metas" on goals
  for select using (auth.uid() = user_id);

drop policy if exists "cada pessoa cria as próprias metas" on goals;
create policy "cada pessoa cria as próprias metas" on goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "cada pessoa atualiza as próprias metas" on goals;
create policy "cada pessoa atualiza as próprias metas" on goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cada pessoa apaga as próprias metas" on goals;
create policy "cada pessoa apaga as próprias metas" on goals
  for delete using (auth.uid() = user_id);

alter table goals drop constraint if exists goals_points_fixed;
alter table goals add constraint goals_points_fixed check (points = 10) not valid;

alter table goals drop constraint if exists goals_label_length;
alter table goals add constraint goals_label_length check (char_length(label) between 1 and 200) not valid;

create or replace function seed_default_goals(labels text[])
returns void
language plpgsql
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'não autenticado';
  end if;

  perform pg_advisory_xact_lock(hashtext(me::text));

  if exists (select 1 from goals where user_id = me) then
    return;
  end if;

  insert into goals (label, points)
  select l, 10 from unnest(labels[1:20]) as l;
end;
$$;

revoke execute on function seed_default_goals(text[]) from public, anon;
grant execute on function seed_default_goals(text[]) to authenticated;

create table if not exists goal_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  date date not null,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (goal_id, date)
);
create index if not exists goal_completions_user_id_idx on goal_completions (user_id);
alter table goal_completions enable row level security;

drop policy if exists "cada pessoa vê as próprias conclusões" on goal_completions;
create policy "cada pessoa vê as próprias conclusões" on goal_completions
  for select using (auth.uid() = user_id);

drop policy if exists "cada pessoa insere as próprias conclusões" on goal_completions;
create policy "cada pessoa insere as próprias conclusões" on goal_completions
  for insert with check (auth.uid() = user_id);

drop policy if exists "cada pessoa apaga as próprias conclusões" on goal_completions;

create or replace function enforce_goal_completion()
returns trigger
language plpgsql
as $$
declare
  goal_points integer;
  today_utc date := (now() at time zone 'utc')::date;
  done_that_day integer;
begin
  select points into goal_points
  from goals
  where id = new.goal_id and user_id = auth.uid();

  if goal_points is null then
    raise exception 'meta inválida';
  end if;

  if new.date < today_utc - 1 or new.date > today_utc + 1 then
    raise exception 'data fora do intervalo permitido';
  end if;

  select count(*) into done_that_day
  from goal_completions
  where user_id = new.user_id and date = new.date;

  if done_that_day >= 20 then
    raise exception 'limite diário de metas atingido';
  end if;

  new.points := goal_points;
  return new;
end;
$$;

drop trigger if exists goal_completions_enforce on goal_completions;
create trigger goal_completions_enforce
  before insert on goal_completions
  for each row execute function enforce_goal_completion();

create table if not exists cosmetics (
  id text primary key,
  label text not null,
  cost integer not null
);

insert into cosmetics (id, label, cost) values
  ('branco', 'Branco', 0),
  ('preto', 'Preto', 0),
  ('areia', 'Areia', 20),
  ('ceu', 'Céu', 30),
  ('pessego', 'Pêssego', 40),
  ('lavanda', 'Lavanda', 50),
  ('menta', 'Menta', 60),
  ('grafite', 'Grafite', 80)
on conflict (id) do nothing;

alter table cosmetics enable row level security;

drop policy if exists "qualquer um vê o catálogo de cores" on cosmetics;
create policy "qualquer um vê o catálogo de cores" on cosmetics
  for select using (true);

create table if not exists cosmetic_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cosmetic_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, cosmetic_id)
);
alter table cosmetic_unlocks enable row level security;

alter table cosmetic_unlocks drop column if exists cost;

alter table cosmetic_unlocks drop constraint if exists cosmetic_unlocks_cosmetic_id_fkey;
alter table cosmetic_unlocks
  add constraint cosmetic_unlocks_cosmetic_id_fkey foreign key (cosmetic_id) references cosmetics(id);

drop policy if exists "cada pessoa vê os próprios desbloqueios" on cosmetic_unlocks;
create policy "cada pessoa vê os próprios desbloqueios" on cosmetic_unlocks
  for select using (auth.uid() = user_id);

drop policy if exists "cada pessoa insere os próprios desbloqueios" on cosmetic_unlocks;

drop policy if exists "só desbloqueia se tiver pontos suficientes" on cosmetic_unlocks;
create policy "só desbloqueia se tiver pontos suficientes" on cosmetic_unlocks
  for insert
  with check (
    auth.uid() = user_id
    and (select cost from cosmetics where id = cosmetic_id) <= (
      coalesce((select sum(points) from goal_completions where user_id = auth.uid()), 0)
      -
      coalesce(
        (select sum(c.cost) from cosmetic_unlocks u join cosmetics c on c.id = u.cosmetic_id where u.user_id = auth.uid()),
        0
      )
    )
  );

create table if not exists health_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  birth_date date not null check (birth_date >= date '1900-01-01'),
  sex text not null check (sex in ('female', 'male', 'other')),
  height_cm numeric not null check (height_cm between 100 and 250),
  lifestyle text not null check (lifestyle in ('sedentary', 'standing', 'active')),
  goal text not null check (goal in ('lose', 'maintain', 'gain', 'health')),
  meals_per_day integer not null default 4 check (meals_per_day between 2 and 8),
  cooking_time text not null default 'some' check (cooking_time in ('little', 'some', 'lots')),
  budget text not null default 'medium' check (budget in ('low', 'medium', 'high')),
  restrictions text[] not null default '{}'
    check (restrictions <@ array['vegetarian', 'vegan', 'lactose_free', 'gluten_free', 'nut_allergy', 'seafood_allergy']::text[]),
  conditions text[] not null default '{}'
    check (conditions <@ array['hypertension', 'diabetes', 'cholesterol', 'heart', 'kidney', 'pregnant', 'lactating', 'eating_disorder']::text[]),
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table health_profiles enable row level security;

drop policy if exists "cada pessoa vê o próprio perfil de saúde" on health_profiles;
create policy "cada pessoa vê o próprio perfil de saúde" on health_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "cada pessoa cria o próprio perfil de saúde" on health_profiles;
create policy "cada pessoa cria o próprio perfil de saúde" on health_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "cada pessoa atualiza o próprio perfil de saúde" on health_profiles;
create policy "cada pessoa atualiza o próprio perfil de saúde" on health_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cada pessoa apaga o próprio perfil de saúde" on health_profiles;
create policy "cada pessoa apaga o próprio perfil de saúde" on health_profiles
  for delete using (auth.uid() = user_id);
