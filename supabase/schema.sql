-- Lugares del rompecabezas (Perú demo)
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  parent_slug text,
  level text not null,
  sort_order int default 0
);

-- Fotos y estado visitado
create table if not exists place_entries (
  id uuid primary key default gen_random_uuid(),
  place_slug text not null references places(slug),
  photo_path text,
  visit_date date,
  note text,
  status text not null default 'pending',
  target_date text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Datos demo Perú
insert into places (slug, name, parent_slug, level, sort_order) values
  ('peru', 'Perú', null, 'country', 1),
  ('cusco', 'Cusco', 'peru', 'region', 1),
  ('machu-picchu', 'Machu Picchu', 'cusco', 'poi', 1),
  ('arequipa', 'Arequipa', 'peru', 'region', 2),
  ('colca', 'Cañón del Colca', 'arequipa', 'poi', 1),
  ('lima', 'Lima', 'peru', 'region', 3),
  ('lima-centro', 'Centro Histórico', 'lima', 'poi', 1),
  ('puno', 'Puno', 'peru', 'region', 4),
  ('titicaca', 'Lago Titicaca', 'puno', 'poi', 1),
  ('amazonas', 'Amazonas', 'peru', 'region', 5),
  ('chachapoyas', 'Chachapoyas', 'amazonas', 'poi', 1),
  ('bagua', 'Bagua', 'amazonas', 'poi', 2),
  ('jumbilla', 'Jumbilla (Bongará)', 'amazonas', 'poi', 3),
  ('nieva', 'Santa María de Nieva', 'amazonas', 'poi', 4),
  ('lamud', 'Lámud (Luya)', 'amazonas', 'poi', 5),
  ('mendoza-amazonas', 'Mendoza (Rodríguez de Mendoza)', 'amazonas', 'poi', 6),
  ('bagua-grande', 'Bagua Grande (Utcubamba)', 'amazonas', 'poi', 7),
  ('kuelap', 'Kuélap', 'chachapoyas', 'poi', 1),
  ('gocta', 'Catarata de Gocta', 'amazonas', 'poi', 8)
on conflict (slug) do nothing;

-- Row Level Security
alter table places enable row level security;
alter table place_entries enable row level security;

drop policy if exists "Todos pueden leer lugares" on places;
create policy "Todos pueden leer lugares"
  on places for select using (true);

drop policy if exists "Todos pueden leer entradas" on place_entries;
create policy "Todos pueden leer entradas"
  on place_entries for select using (true);

drop policy if exists "Solo logueados insertan" on place_entries;
create policy "Solo logueados insertan"
  on place_entries for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Solo logueados actualizan" on place_entries;
create policy "Solo logueados actualizan"
  on place_entries for update
  using (auth.role() = 'authenticated');

drop policy if exists "Solo logueados borran" on place_entries;
create policy "Solo logueados borran"
  on place_entries for delete
  using (auth.role() = 'authenticated');

-- Storage: crear bucket "photos" público desde el panel.
-- Políticas recomendadas en Storage > photos:
--   SELECT: public
--   INSERT/UPDATE/DELETE: authenticated
