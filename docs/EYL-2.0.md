# EYL 2.0 — Documento de producto

> Bitácora familiar de rutas · Mapa de recuerdos sobre polígonos reales de Perú  
> Versión: borrador · Marzo 2026  
> Estado: planificación (reinicio de interfaz, conservando lógica de polígonos)

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

| Rol | Quién | Qué puede hacer |
|-----|--------|-----------------|
| **Familia (editor)** | Personas con cuenta Supabase | Subir, editar y borrar fotos por distrito |
| **Visitante** | Cualquiera con el **link** | Solo ver el mapa y las fotos (sin login) |

- **Privacidad:** no es una red social abierta; es un mapa compartido por enlace (estilo álbum familiar privado por URL).
- **Login:** solo para editar. El visitante entra directo al mapa.

---

## 3. Alcance geográfico

| Fase | Territorio | Objetivo |
|------|------------|----------|
| **2.0 MVP** | **Perú completo** | Departamentos → provincias → distritos con la misma lógica de polígonos |
| **Datos** | GeoJSON INEI (ya en el repo) | `peru-departments`, `peru-provinces-detailed`, `peru-districts` |
| **Contenido inicial** | Donde ya hay fotos (ej. Amazonas / Chachapoyas) | Esas zonas “brillan” primero en el globo |

No volver a encerrar el producto solo en Chachapoyas: el 2.0 apunta a **perfeccionar Perú entero**, empezando por donde ya hay recuerdos cargados.

---

## 4. Reglas de polígonos (innegociables — heredadas de 1.0)

Estas reglas **no se renegocian** en el rediseño:

1. **Una foto vive en un solo polígono:** si se sube en Levanto, solo rellena Levanto — nunca la provincia, el departamento ni el padre.
2. **Varias fotos en el mismo distrito = collage** dentro de ese polígono (no una sola foto tapando las demás).
3. **Sin foto = gris** (por visitar); **con foto = recuerdo visible** dentro del contorno del distrito.
4. **Capas por nivel de zoom:** en cada escala solo un nivel administrativo dominante (evitar líneas superpuestas confusas).
5. **Las fotos siguen la forma del polígono** (fill-pattern / collage), no un pin flotante.

---

## 5. Experiencia visitante (prioridad: móvil)

### 5.1 Dispositivo de referencia

- **Samsung Galaxy Note 14 Pro** (pantalla principal de diseño y pruebas de demo).
- Diseño **mobile-first**; desktop es secundario.

### 5.2 Al abrir la app (visitante con link)

1. Pantalla casi **100 % mapa**.
2. Fondo: **espacio / estrellas**.
3. Sobre el fondo: **collage de fotos desvanecido** (opacidad baja), mezclando universo y recuerdos.
4. Centro: **globo terráqueo** con países en contorno tenue.
5. **Perú (u otras zonas con fotos) resaltado** en el globo según datos reales en Supabase — no hardcodeado a un país.
6. **Sin** leyendas largas, breadcrumbs, textos de ayuda ni instrucciones en pantalla.

### 5.3 Collage de fondo (capa decorativa)

- Usa **4 fotos** por carga (selección aleatoria).
- Origen: las mismas fotos que ya están en el mapa (Supabase Storage).
- En **cada recarga** puede cambiar la selección.
- Efecto: **desvanecido** (fade), mezclado con estrellas/universo.
- No es interactivo; es ambiente visual.

### 5.4 Interacción principal (dos toques)

| Toque | Comportamiento |
|-------|----------------|
| **1.er toque** en zona / polígono | **Solo zoom encuadrado** al nivel correspondiente (depto → prov → distrito). Sin panel, sin carrusel. |
| **2.º toque** (misma zona, ya encuadrada) | **Carrusel de fotos** de ese lugar (hoja inferior o overlay mínimo). |
| **Alejar con gesto** | Volver al nivel anterior hasta el globo. |

Reglas de encuadre:

- En **distrito**: un zoom que muestre **todo el polígono** según pantalla (referencia: Note 14 Pro).
- Las fotos **siguen la forma** del polígono en el mapa; el carrusel es lectura ampliada al segundo toque.

### 5.5 Animación de inicio (globo → zona con fotos)

- **Sí**, hay animación suave al abrir (`flyTo` / `easeTo`).
- **No está fija en Perú:** el destino es la **región del mundo donde ya hay fotos**.
  - Hoy: probablemente Perú / Amazonas (donde existen entradas).
  - Si mañana hay fotos en Brasil: la animación iría hacia **Brasil**.
  - Lógica: calcular bounds de todos los polígonos con `has_photo` y centrar ahí.
- Si no hay fotos en ningún sitio: queda en vista globo sin animación agresiva.

### 5.6 Lo que NO debe aparecer (lecciones de la demo 1.0)

- Header con tagline largo (“Gris = por visitar · Foto = recuerdo · Editar…”).
- Breadcrumb `Perú › Amazonas › Chachapoyas › …` fijo en pantalla.
- Dropdown de distritos siempre visible.
- Botón **Editar** prominente en la vista visitante.
- Texto de ayuda en el footer (“Pellizca o usa +/−…”).
- Múltiples capas de UI superpuestas (panel + mapa + barra + header).

**Principio UI:** *Si no es mapa o foto, no está en pantalla.*

---

## 6. Experiencia editor (familia)

- **Pantalla separada** del mapa visitante (no mezclar modos en la misma vista).
- Acceso: botón discreto o URL `/editar` + login Supabase.
- Flujo mínimo:
  1. Iniciar sesión
  2. Elegir departamento → provincia → **distrito**
  3. Subir foto(s)
  4. Guardar → visible en el mapa público al recargar

Campos por entrada (heredado): foto, fecha opcional, nota opcional, estado visitado.

---

## 7. Stack técnico (se mantiene)

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + Vite |
| Mapa | MapLibre GL JS |
| Datos geo | GeoJSON INEI en `public/data/` |
| Backend | Supabase (Auth, Postgres, Storage `photos`) |
| Hosting | [Netlify — bitacorafamilairderutas.netlify.app](https://bitacorafamilairderutas.netlify.app/) |
| Repo | Bitácora-Familiar-de-Rutas |

### Qué se reutiliza del código 1.0

- `photoCollage.js`, `mapPhotoPatterns.js` — collage dentro del polígono
- `districtPlaces.js`, `regions.js` — slugs UBIGEO, enriquecimiento GeoJSON
- `supabase/` — schema y migraciones
- GeoJSON de Perú

### Qué se reescribe en 2.0

- `App.jsx` — layout visitante vs editor
- Componentes de UI visitante (`ChachapoyasFilterBar`, `PlacePanel`, header actual)
- Flujo de navegación / encuadre (`GlobeMap.jsx` → módulos más pequeños)
- Estilos móvil (`App.css` → sistema más limpio, posible Tailwind en visitante)
- Vista globo + capa espacio/collage (nueva)

---

## 8. Plan de implementación paso a paso

### Paso 0 — Documentación ✅ (este archivo)
Producto, reglas, UI, alcance. Ajustar según feedback familiar.

### Paso 1 — Shell visitante móvil 🚧 (en progreso)

- [x] Ruta `/` → visitante 2.0 (`VisitorApp`) — solo mapa
- [x] Ruta `/editar` → catálogo 2.0 (`EditorApp`) — sin mapa
- [x] Pantalla completa mapa + estrellas + 4 fotos desvanecidas
- [x] Sin header, footer ni filtros en visitante
- [x] Globo con fondo transparente (estrellas visibles)
- [x] Acceso editor discreto (icono tenue → gestión de fotos)
- [ ] Probar en Note 14 Pro

### Paso 2 — Globo + Perú con fotos existentes
- Proyección globo al inicio
- Capa departamentos/perú con fill-pattern donde `has_photo`
- Collage de fondo aleatorio desde entradas con foto
- Perú visualmente destacado respecto al resto del mundo

### Paso 3 — Navegación por niveles (Perú completo) 🚧
- [x] **1.er toque país** → encuadre animado, borde doble, tinte, departamentos visibles
- [x] **1.er toque departamento** → encuadre, borde resaltado, provincias visibles
- [x] **1.er toque provincia** → encuadre, distritos al acercar
- [x] **2.º toque** → carrusel de fotos (depto / provincia / distrito · todo Perú)
- [ ] Pinch/alejar → volver al nivel anterior
- Zoom: globo → departamento → provincia → distrito
- Encuadre automático (`fitBounds` / `cameraForBounds`) **por nivel**
- En distrito: **siempre** se ve el polígono entero en pantalla
- Reglas de capas (un nivel visible por zoom)

### Paso 4 — Gestos móvil
- Pinch zoom in/out dentro del nivel permitido
- Pan limitado al área activa
- Sin botones +/− obligatorios (opcional ocultos)

### Paso 5 — Editor separado 🚧
- [x] Ruta `/editar` → catálogo 2.0 (`EditorApp`) — **sin mapa**
- [x] Login → gestión de fotos (distrito obligatorio al subir)
- [x] «Ver mapa» vuelve a visitante `/`
- [x] Catálogo distritos: Amazonas intacto + resto de departamentos Perú
- [ ] Pulido móvil del catálogo

### Paso 6 — Pulido demo
- Rendimiento collage + globo en Note 14 Pro
- Carga progresiva de distritos (no cargar 1800+ distritos de golpe en zoom bajo)
- PWA opcional (instalar en el celular)

---

## 9. Criterios de éxito (próxima demo)

La demo 2.0 es **exitosa** si en un **Note 14 Pro**, con el link público:

1. Al abrir, se ve el **globo con Perú iluminado** por fotos reales (sin leer instrucciones).
2. Al acercar a un distrito con fotos, el **polígono entero encuadra** la pantalla.
3. Las **fotos siguen la forma** del distrito.
4. **No hay que hacer scroll** de página ni arrastrar el mapa para “buscar” los límites.
5. La interfaz tiene **cero textos de ayuda** visibles en la vista principal.
6. Un familiar puede **subir una foto** desde el editor y verla en el mapa visitante tras recargar.

---

## 10. Decisiones cerradas (Mar 2026)

| # | Pregunta | Decisión |
|---|----------|----------|
| **A** | ¿Toque en distrito? | **1.er toque = solo zoom encuadrado.** **2.º toque = carrusel de fotos.** |
| **B** | ¿Fotos en collage de fondo? | **4 fotos**, aleatorias en cada carga. |
| **C** | ¿Animación al inicio? | **Sí**, hacia la zona con fotos (dinámico: Perú hoy; Brasil u otro si hubiera fotos ahí). |
| **D** | ¿Dominio? | **Netlify:** https://bitacorafamilairderutas.netlify.app/ |
| **E** | ¿Fotos migradas? | **No todas.** Subida parcial; editor 1.0 poco intuitivo → ver §13 pendientes. |

---

## 11. Pendientes (fuera del MVP visitante 2.0)

Cosas que **no bloquean** el Paso 1–4 del mapa visitante, pero hay que arreglar después:

| ID | Problema (demo 1.0) | Notas |
|----|---------------------|-------|
| **P1** | Editor poco intuitivo en móvil | Flujo confuso para familia |
| **P2** | Foto subida a **Levanto** apareció en **Chachapoyas** | ✅ Editor exige distrito; `place_slug` = distrito elegido |
| **P3** | Tras subir, la página **recargaba sola** y perdía el lugar | ✅ Filtro del editor ya no se resetea al refrescar datos |
| **P4** | No están todas las fotos en Supabase nuevo | Migración / re-subida gradual |
| **P5** | Refactor editor en pantalla separada (`/editar`) | Paso 5 del plan |

**Regla:** el visitante 2.0 se construye aunque P1–P4 sigan pendientes; el editor se aborda en Paso 5 con flujo nuevo.

---

## 12. Glosario

| Término | Significado |
|---------|-------------|
| **Distrito** | Polígono INEI (UBIGEO), slug `dist-XXXXXXXX` |
| **Collage** | Varias fotos combinadas en un patrón dentro de un polígono |
| **Encuadre** | Ajustar zoom y centro para que el polígono quepa entero en pantalla |
| **Visitante** | Quien abre el link sin login |
| **Familia** | Quien tiene cuenta y sube fotos |

---

## 13. Historial

| Fecha | Cambio |
|-------|--------|
| Mar 2026 | Creación doc 2.0 tras demo 1.0; feedback móvil; visión globo + universo + Perú completo |
| Mar 2026 | Decisiones §10 cerradas: doble toque, 4 fotos fondo, animación dinámica, Netlify; pendientes editor §11 |

---

*Documento vivo. **Listo para Paso 1** (shell visitante móvil). Editor y bugs P1–P4 en Paso 5.*
