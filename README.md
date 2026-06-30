# EYL — Mapa de recuerdos

Catálogo personal de fotos sobre un **globo MapLibre**: lugares en **gris** (por visitar) o **con tu foto** dentro del polígono (visitado). Demo inicial con Perú y Amazonas detallado.

## Requisitos

- Node.js 18+
- Cuenta [Supabase](https://supabase.com) (gratis)

## 1. Backend Supabase

1. Crea un proyecto en Supabase.
2. **SQL Editor** → ejecuta `supabase/schema.sql`.
3. **Storage** → bucket `photos` (público para lectura).
4. **Authentication** → crea usuarios (Auto Confirm ✅).
5. **Project Settings → API** → copia URL y clave **anon** (pestaña Legacy).

### Políticas del bucket `photos`

| Operación | Quién         |
| --------- | ------------- |
| SELECT    | Público       |
| INSERT    | Authenticated |

## 2. Variables de entorno

```powershell
copy .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

En **Netlify** → Environment variables (mismas dos claves) → redeploy.

## 3. Desarrollo local

```powershell
cd E:\WEBS\EYL
npm install
npm run dev
```

Abre http://localhost:3000

## 4. GitHub y Netlify

Ver commits en [Bitacora-Familiar-de-Rutas](https://github.com/eduarcc99/Bitacora-Familiar-de-Rutas).

- Build: `npm run build`
- Publish: `dist`

---

## Uso del mapa

| Acción       | Cómo                                                            |
| ------------ | --------------------------------------------------------------- |
| Navegar      | Scroll, pellizco o clic en polígonos                            |
| Editar       | Botón **Editar** (arriba) → login                               |
| Editar distrito | Acerca hasta ver distritos → pulsa **✎** en Levanto, Chachapoyas, etc. |
| Subir foto   | **✎** o clic en el distrito → **Visitado** → foto → **Guardar** |
| Collage      | Misma ficha **✎** → otra foto → **Guardar** otra vez (sin borrar la 1ª) |
| Alejar nivel | Botón **− Alejar**                                              |

---

## Preguntas frecuentes

### ¿Por qué no hay puntos verdes?

Las fotos **llenan el polígono** del mapa (distrito/provincia), no puntos sueltos. Esa es la idea del álbum geográfico.

### ¿Por qué Perú o Utcubamba se ponían verdes si solo subí foto en Chachapoyas?

Antes el color **subía al padre** (departamento/país). Ahora la foto solo aparece en el **polígono que corresponde** a ese lugar.

### ¿Dónde está el formulario de fotos?

1. Acerca el mapa hasta ver **distritos** (Amazonas → provincia → distritos).
2. Pulsa **✎** sobre el distrito (Levanto, Chachapoyas, Sonche…).
3. **Editar** (arriba) → login si hace falta.
4. Baja a **Editar lugar** → **Visitado (color)** → **Tu foto** → **Guardar**.

### ¿Varias fotos en un distrito (collage)?

Cada **Guardar** con una foto nueva crea otra entrada en **ese mismo distrito**. En el mapa se combinan en **collage** dentro del polígono (tantas fotos como subas).

Importante: la foto queda en el **distrito que editaste** (✎ en Levanto → solo polígono Levanto), no en toda la provincia.

### ¿Supabase ya existía antes de distritos editables?

Ejecuta una vez `supabase/migrate-districts.sql` en el SQL Editor.

### ¿Eliminar?

En **Editar lugar** → botón rojo **Eliminar** (solo si ya guardaste antes).

---

## Estructura

```
src/
  components/   GlobeMap, PlacePanel, MapInfoOverlay, UploadForm
  data/         Lugares + GeoJSON Perú
  lib/          Supabase, collage de fotos, patrones del mapa
supabase/
  schema.sql    Tablas y políticas RLS
```

## Próximas versiones

- Animación suave al aparecer la foto en el polígono
- Panel a pantalla completa en móvil
- Más departamentos con distritos detallados
