# EYL 2.0 — Documento de producto

> Bitácora familiar de rutas · Mapa de recuerdos sobre polígonos reales de Perú  
> Versión: 2.0 en curso · Agosto 2026  
> Estado: **funcionando en local** — visitante + editor separados; Perú completo en catálogo y carrusel

---

## 1. Visión en una frase

**Un globo terráqueo en el espacio, hecho de recuerdos familiares, donde Perú brilla con las fotos que ya existen y, al acercarse, cada distrito se encuadra entero en pantalla con las fotos tomando la forma del polígono.**

Referencia visual (boceto del producto):

```
┌─────────────────────────────────────────┐
│  ·  ·  ★  ·  ·  ·  ★  ·  ·  ·  ★  ·   │  ← universo / estrellas
│     ·   collage de fotos desvanecido   │  ← capa tenue, aleatoria
│          ┌───────────────┐             │
│          │   🌍 globo    │             │
│          │   Perú con    │             │  ← fotos visibles donde hay datos
│          │   fotos       │             │
│          └───────────────┘             │
│  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·   │
└─────────────────────────────────────────┘
         (sin textos ni instrucciones)
```

---

## 2. Usuarios y acceso

| Rol | Quién | Qué puede hacer | Ruta |
|-----|--------|-----------------|------|
| **Visitante** | Cualquiera con el **link** | Ver mapa y fotos (sin login) | `/` |
| **Familia (editor)** | Personas con cuenta Supabase | Subir, editar y borrar fotos por distrito | `/editar` |

- **Privacidad:** no es una red social abierta; es un mapa compartido por enlace.
- **Login:** solo en `/editar`. El visitante entra directo al mapa.
- **Acceso editor desde visitante:** icono tenue (cuadrícula) esquina inferior izquierda → `/editar`.
- **Volver al mapa desde editor:** icono globo en la barra → `/`.

---

## 3. Alcance geográfico

| Fase | Territorio | Estado |
|------|------------|--------|
| **2.0** | **Perú completo** | Departamentos → provincias → distritos |
| **Datos** | GeoJSON INEI | `peru-departments`, `peru-provinces`, `peru-districts`, `amazonas-districts` |
| **Amazonas** | Lógica 1.0 intacta | Slugs `chachapoyas`, `bagua`, … + GeoJSON detallado |
| **Resto del Perú** | Catálogo extendido | Provincias `prov-{IDPROV}` + distritos `dist-{UBIGEO}` (merge sin pisar Amazonas) |

---

## 4. Reglas de polígonos (innegociables)

1. **Una foto vive en un solo polígono** (distrito). Nunca en provincia/departamento padre.
2. **Varias fotos en el mismo distrito = collage** dentro del polígono.
3. **Sin foto = gris**; **con foto = recuerdo** en el contorno.
4. **Capas por nivel de zoom:** un nivel administrativo dominante.
5. **Las fotos siguen la forma del polígono** (fill-pattern), no un pin.

---

## 5. Experiencia visitante (`/` · `VisitorApp`)

### 5.1 Al abrir

1. Pantalla casi **100 % mapa**.
2. Fondo: **estrellas animadas** (espacio transparente del globo para verlas).
3. **Collage de 4 fotos** desvanecido (solo en vista globo / sin país).
4. **Globo** con Perú y fotos según Supabase.
5. Sin header, footer, breadcrumbs ni textos de ayuda.

### 5.2 Interacción (dos toques)

| Toque | Comportamiento |
|-------|----------------|
| **1.er toque** | Zoom encuadrado (país → depto → prov → distrito). |
| **2.º toque** (misma zona) | **Carrusel** de fotos (depto, provincia o distrito · todo Perú). |
| **Sin fotos** | Carrusel muestra “Sin fotos aún”. |

### 5.3 Controles de navegación

Aparecen al salir de la vista mundo:

| Control | Acción |
|---------|--------|
| **← / →** | Historial atrás / adelante |
| **🌐 Inicio del mundo** | Vuelve al globo (filtro vacío) |

Controles +/− del mapa: ocultos en visitante.

### 5.4 Acceso editor

- Icono de cuadrícula **casi invisible** abajo a la izquierda → gestión de fotos.

---

## 6. Experiencia editor (`/editar` · `EditorApp`)

**Sin mapa.** Solo catálogo de gestión.

### 6.1 Flujo

1. Login Supabase (pantalla de acceso).
2. Elegir lugar con **desplegable compacto**: departamento → provincia → **distrito**.
3. Un solo botón de subida: **Subir a {distrito}**.
4. Fotos visibles en el mapa visitante tras recargar `/`.

### 6.2 UI móvil (estado actual)

| Elemento | Comportamiento |
|----------|----------------|
| **Barra superior** | Logo EYL + “Gestión” + conteo; iconos **mapa** y **salir** (sin segundo botón Subir) |
| **Dónde subir** | Trigger compacto desplegable (no 4 dropdowns ni lista a pantalla completa) |
| **Al elegir distrito** | Se cierra solo; queda “Subir a …” |
| **Filtro tras subir** | **No se resetea** (ubicación estable) |
| **Subida** | Solo con **distrito** elegido (`place_slug` = ese distrito) |

### 6.3 Catálogo geográfico

- **Amazonas:** misma lógica / slugs de siempre (no modificada).
- **Otros departamentos** (San Martín, etc.): provincias y distritos INEI disponibles para filtrar y subir.

---

## 7. Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + Vite + Tailwind 4 |
| Mapa | MapLibre GL JS |
| Datos geo | GeoJSON INEI en `public/data/` y `src/data/` |
| Backend | Supabase (Auth, Postgres, Storage `photos`) |
| Hosting | [Netlify](https://bitacorafamilairderutas.netlify.app/) |

### Archivos clave 2.0

| Área | Archivos |
|------|----------|
| Rutas | `App.jsx` → `/` visitante, `/editar` editor |
| Visitante | `visitor/VisitorApp.jsx`, `StarfieldBackground.jsx`, `VisitorNavControls.jsx`, `VisitorPhotoCarousel.jsx` |
| Editor | `editor/EditorApp.jsx`, `gallery/GalleryEditor.jsx`, `gallery/EditorSidebar.jsx`, `gallery/EditorChrome.jsx` |
| Catálogo | `placeCatalog.js`, `provincePlaces.js`, `districtPlaces.js` (Amazonas + merge Perú) |
| Carrusel | `visitorCarousel.js` + `photoHierarchy.js` |
| Mapa | `GlobeMap.jsx`, `mapNavigation.js`, `mapScope.js` |

### Legacy

- `AppLegacy.jsx` ya **no** es la ruta `/editar` (queda en el repo; el flujo activo es `EditorApp`).

---

## 8. Plan de implementación — estado

### Paso 0 — Documentación ✅

### Paso 1 — Shell visitante ✅

- [x] `/` → `VisitorApp`
- [x] `/editar` → `EditorApp` (sin mapa)
- [x] Estrellas + collage + globo transparente
- [x] Acceso editor discreto
- [ ] Validar en Note 14 Pro (dispositivo real)

### Paso 2 — Globo + fotos ✅ (base)

- [x] Proyección globo al inicio
- [x] Collage de fondo aleatorio
- [x] Estrellas visibles (fog con espacio transparente en visitante)

### Paso 3 — Navegación por niveles ✅ (casi)

- [x] 1.er toque país / depto / provincia
- [x] 2.º toque → carrusel (todo Perú)
- [x] Botón inicio del mundo
- [ ] Pinch/alejar → nivel anterior (pendiente fino)

### Paso 4 — Gestos móvil 🚧

- Controles +/− ocultos
- Pinch / pan: mejorar límites por nivel

### Paso 5 — Editor separado ✅

- [x] Catálogo sin mapa
- [x] Distrito obligatorio al subir
- [x] Filtro estable tras subir (P3)
- [x] Perú completo en selector (Amazonas intacto)
- [x] UI móvil: desplegable + iconos de barra
- [x] Un solo CTA “Subir a …”

### Paso 6 — Pulido demo 🚧

- Rendimiento Note 14 Pro
- Carga progresiva de distritos
- PWA opcional

---

## 9. Criterios de éxito

| # | Criterio | Estado |
|---|----------|--------|
| 1 | Globo + estrellas al abrir (sin instrucciones) | ✅ local |
| 2 | Encuadre a distrito / niveles | ✅ local |
| 3 | Fotos en forma de polígono | ✅ (lógica 1.0) |
| 4 | Sin scroll de página en visitante | ✅ |
| 5 | Cero textos de ayuda en mapa | ✅ |
| 6 | Subir foto en editor → ver en visitante | ✅ local |
| 7 | Carrusel 2.º toque en todo Perú | ✅ local |
| 8 | Editor usable en móvil (desplegable) | ✅ local |
| — | Demo en Note 14 Pro / Netlify | ⏳ pendiente |

---

## 10. Decisiones cerradas

| # | Pregunta | Decisión |
|---|----------|----------|
| **A** | ¿Toque en zona? | 1.er = zoom · 2.º = carrusel |
| **B** | ¿Collage de fondo? | 4 fotos, aleatorias por carga |
| **C** | ¿Animación inicio? | Hacia zona con fotos (dinámico) |
| **D** | ¿Hosting? | Netlify |
| **E** | ¿Mapa en editor? | **No.** Solo visitante `/` |
| **F** | ¿Dónde vive la foto? | Solo **distrito** |
| **G** | ¿Amazonas? | No romper slugs/GeoJSON detallado; extender el resto por merge |
| **H** | ¿UI editor móvil? | Desplegable compacto + iconos; un botón Subir |

---

## 11. Pendientes

| ID | Tema | Notas |
|----|------|-------|
| **P1** | ~~Editor confuso en móvil~~ | ✅ Desplegable + iconos |
| **P2** | ~~Foto en lugar equivocado~~ | ✅ Distrito obligatorio |
| **P3** | ~~Filtro se perdía al subir~~ | ✅ Sin reset por `places` |
| **P4** | Fotos no migradas todas | Re-subida gradual |
| **P5** | ~~Editor en `/editar`~~ | ✅ `EditorApp` |
| **P6** | Pinch → nivel anterior | Gestos visitante |
| **P7** | Prueba Note 14 Pro + deploy | Validación demo familiar |

---

## 12. Glosario

| Término | Significado |
|---------|-------------|
| **Distrito** | Polígono INEI, slug `dist-XXXXXXXX` |
| **Provincia (resto Perú)** | Slug `prov-{IDPROV}` (ej. `prov-2208` Rioja) |
| **Provincia (Amazonas)** | Slugs de `places.js`: `chachapoyas`, `bagua`, … |
| **Collage** | Varias fotos en patrón dentro del polígono |
| **Encuadre** | Zoom/centro para ver el polígono entero |
| **Visitante** | `/` sin login |
| **Familia / Editor** | `/editar` con login |

---

## 13. Historial

| Fecha | Cambio |
|-------|--------|
| Mar 2026 | Creación doc 2.0 tras demo 1.0 |
| Mar 2026 | Decisiones: doble toque, 4 fotos fondo, animación, Netlify |
| Ago 2026 | Visitante + editor separados; estrellas; carrusel Perú; catálogo deptos; editor móvil desplegable |
| Ago 2026 | **Doc actualizada:** estado “funcionando en local”; P1–P3/P5 cerrados; pendientes P4/P6/P7 |
| Ago 2026 | Collage del mapa fijo **2×2** (mosaico legible a cualquier zoom; 1 foto se cicla en 4 celdas) |

---

*Documento vivo. Base 2.0 operativa en local. Siguiente foco: gestos pinch (P6) y demo en dispositivo / Netlify (P7).*
