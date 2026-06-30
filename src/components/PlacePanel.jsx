import { getBreadcrumb, getChildren, resolvePlace } from "../data/places";
import { getDistrictPlace } from "../data/districtPlaces";
import { getPhotoPublicUrl } from "../lib/supabase";

export default function PlacePanel({
  places,
  selectedSlug,
  entry,
  allEntries = [],
  user,
  onClose,
  onNavigate,
  onFocus,
  onOpenGallery,
}) {
  const place =
    resolvePlace(places, selectedSlug) || getDistrictPlace(selectedSlug);
  if (!place) return null;

  const breadcrumb = getBreadcrumb(places, selectedSlug, getDistrictPlace);
  const children = getChildren(places, selectedSlug);
  const visited = entry?.status === "visited";
  const photoEntries = allEntries.filter((e) => e.photo_path);
  const photoUrl = photoEntries[0]
    ? getPhotoPublicUrl(photoEntries[0].photo_path)
    : null;
  const extraPhotos = photoEntries.slice(1);

  return (
    <aside
      className="place-panel"
      role="dialog"
      aria-label={`Lugar: ${place.name}`}
    >
      <header className="place-panel__header">
        <nav className="breadcrumb" aria-label="Ruta">
          {breadcrumb.map((item, i) => (
            <span key={item.slug}>
              {i > 0 && <span className="breadcrumb__sep"> › </span>}
              <button
                type="button"
                className="breadcrumb__link"
                onClick={() => {
                  onNavigate(item.slug);
                  onFocus(item);
                }}
              >
                {item.name}
              </button>
            </span>
          ))}
        </nav>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </header>

      <div
        className={`place-panel__hero ${visited ? "place-panel__hero--visited" : "place-panel__hero--pending"}`}
      >
        {photoUrl ? (
          <>
            <img
              src={photoUrl}
              alt={place.name}
              className="place-panel__photo"
            />
            {extraPhotos.length > 0 && (
              <div className="place-panel__collage-hint">
                +{extraPhotos.length} foto{extraPhotos.length > 1 ? "s" : ""} en
                collage del mapa
              </div>
            )}
          </>
        ) : (
          <div className="place-panel__placeholder">
            <span className="place-panel__status-icon">
              {visited ? "★" : "○"}
            </span>
            <p>{visited ? "Sin foto aún" : "Por visitar"}</p>
            {!visited && entry?.target_date && (
              <p className="place-panel__target">
                Objetivo: {entry.target_date}
              </p>
            )}
            {!visited && !entry?.target_date && (
              <p className="place-panel__target">
                Añade una fecha objetivo al editar
              </p>
            )}
          </div>
        )}
      </div>

      <div className="place-panel__body">
        <h2>{place.name}</h2>
        <p
          className={`status-badge ${visited ? "status-badge--visited" : "status-badge--pending"}`}
        >
          {visited ? "Visitado" : "Pendiente — te espera"}
        </p>

        {entry?.visit_date && (
          <p className="meta-line">
            <strong>Fecha:</strong> {entry.visit_date}
          </p>
        )}
        {entry?.note && (
          <p className="meta-line place-panel__note">{entry.note}</p>
        )}

        {children.length > 0 && (
          <section className="children-list">
            <h3>Explorar dentro</h3>
            <ul>
              {children.map((child) => (
                <li key={child.slug} className="child-link-row">
                  <button
                    type="button"
                    className="child-link"
                    onClick={() => onFocus(child)}
                  >
                    {child.name}
                  </button>
                  <button
                    type="button"
                    className="map-info-btn map-info-btn--inline"
                    onClick={() => onNavigate(child.slug)}
                    aria-label={`Editar ${child.name}`}
                    title={`Editar — ${child.name}`}
                  >
                    ✎
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {user ? (
          <p className="place-panel__session">
            Edita fotos en <strong>Mi galería</strong>
            {onOpenGallery && (
              <>
                {" "}
                —{" "}
                <button
                  type="button"
                  className="breadcrumb__link"
                  onClick={() => onOpenGallery(selectedSlug)}
                >
                  Abrir galería de {place.name}
                </button>
              </>
            )}
          </p>
        ) : (
          <p className="login-hint">
            Pulsa <strong>Editar</strong> arriba e inicia sesión para subir
            fotos desde la galería
          </p>
        )}
      </div>
    </aside>
  );
}
