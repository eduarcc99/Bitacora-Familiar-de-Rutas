# EYL — Mapa de recuerdos

Catálogo personal de fotos sobre un **globo MapLibre**: lugares en **gris** (por visitar) o **verde** (visitado). Demo inicial con Perú.

## Requisitos

- Node.js 18+
- Cuenta [Supabase](https://supabase.com) (gratis)

## 1. Backend Supabase

1. Crea un proyecto en Supabase.
2. **SQL Editor** → ejecuta `supabase/schema.sql`.
3. **Storage** → bucket `photos` (público para lectura).
4. **Authentication** → crea 2 usuarios (tú y tu pareja).
5. **Project Settings → API** → copia URL y `anon` key.

### Políticas del bucket `photos`

| Operación | Quién |
|-----------|--------|
| SELECT | Público |
| INSERT / UPDATE / DELETE | Authenticated |

## 2. Variables de entorno

```powershell
copy .env.example .env
```

Edita `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

## 3. Desarrollo local

```powershell
cd E:\WEBS\EYL
npm install
npm run dev
```

Abre http://localhost:5173

Sin `.env` configurado, el mapa funciona en **modo demo local** (sin login ni subida).

## 4. Subir a GitHub

```powershell
git init
git add .
git commit -m "Primer demo EYL"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/EYL.git
git push -u origin main
```

## 5. Desplegar en Netlify

1. [app.netlify.com](https://app.netlify.com) → Import from GitHub → repo `EYL`.
2. Build: `npm run build` · Publish: `dist`
3. **Environment variables** (mismas que `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy → comparte la URL con tu pareja.

## Uso

| Acción | Cómo |
|--------|------|
| Navegar | Gira el globo, zoom con rueda o pellizco |
| Ver lugar | Clic en punto gris o verde |
| Editar | Botón **Editar** → login Supabase |
| Marcar pendiente | Estado "Por visitar" + fecha objetivo |
| Marcar visitado | Estado "Visitado" + subir foto + fecha |

## Estructura

```
src/
  components/   GlobeMap, PlacePanel, LoginModal, UploadForm
  data/         Lugares Perú + GeoJSON
  lib/          Cliente Supabase
supabase/
  schema.sql    Tablas y políticas RLS
```

## Próximas versiones

- Universo con fotos al 50 % de fondo
- Animación gris → color estilo Universal
- Más países y fronteras reales
- Doble factor de autenticación
