-- =============================================
-- GOLF SCORECARD - Supabase Schema
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- Campos de golf (guardados para reutilizar)
create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  club text,
  holes_count int not null default 18,
  created_at timestamptz default now()
);

-- Hoyos del campo
create table holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  hole_number int not null,
  par int not null,
  handicap int not null,
  constraint unique_hole unique(course_id, hole_number)
);

-- Partidas
create table rounds (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id),
  mode text not null check (mode in ('stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck')),
  holes_played int not null default 18,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Jugadores de una partida
create table round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  name text not null,
  handicap int not null default 0,
  team int,  -- 1 o 2 para match play dobles, null para otros
  position int not null  -- orden 1-4
);

-- Scores por hoyo por jugador
create table scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  player_id uuid references round_players(id) on delete cascade,
  hole_number int not null,
  strokes int,
  constraint unique_score unique(round_id, player_id, hole_number)
);

-- Índices para performance
create index on holes(course_id);
create index on round_players(round_id);
create index on scores(round_id);
create index on scores(player_id);

-- RLS (Row Level Security) - para uso personal, permitir todo
alter table courses enable row level security;
alter table holes enable row level security;
alter table rounds enable row level security;
alter table round_players enable row level security;
alter table scores enable row level security;

create policy "Allow all" on courses for all using (true) with check (true);
create policy "Allow all" on holes for all using (true) with check (true);
create policy "Allow all" on rounds for all using (true) with check (true);
create policy "Allow all" on round_players for all using (true) with check (true);
create policy "Allow all" on scores for all using (true) with check (true);
