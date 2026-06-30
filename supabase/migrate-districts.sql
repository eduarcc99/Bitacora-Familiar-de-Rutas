-- Ejecutar una vez en proyectos Supabase ya creados (SQL Editor)
-- Permite guardar fotos por distrito (dist-UBIGEO) sin error de FK

alter table place_entries
  drop constraint if exists place_entries_place_slug_fkey;

drop policy if exists "Auth inserta lugares" on places;
create policy "Auth inserta lugares"
  on places for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Auth actualiza lugares" on places;
create policy "Auth actualiza lugares"
  on places for update
  using (auth.role() = 'authenticated');
