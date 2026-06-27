import { getBreadcrumb, getChildren, getPlaceBySlug } from '../data/places'
import { getPhotoPublicUrl } from '../lib/supabase'
import UploadForm from './UploadForm'

export default function PlacePanel({
  places,
  selectedSlug,
  entry,
  user,
  onClose,
  onSaved,
  onNavigate,
  onFocus,
}) {
  const place = getPlaceBySlug(places, selectedSlug)
  if (!place) return null

  const breadcrumb = getBreadcrumb(places, selectedSlug)
  const children = getChildren(places, selectedSlug)
  const visited = entry?.status === 'visited'
  const photoUrl = entry?.photo_path ? getPhotoPublicUrl(entry.photo_path) : null

  return (
    <aside className="place-panel" role="dialog" aria-label={`Lugar: ${place.name}`}>
      <header className="place-panel__header">
        <nav className="breadcrumb" aria-label="Ruta">
          {breadcrumb.map((item, i) => (
            <span key={item.slug}>
              {i > 0 && <span className="breadcrumb__sep"> › </span>}
              <button
                type="button"
                className="breadcrumb__link"
                onClick={() => {
                  onNavigate(item.slug)
                  onFocus(item)
                }}
              >
                {item.name}
              </button>
            </span>
          ))}
        </nav>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </header>

      <div className={`place-panel__hero ${visited ? 'place-panel__hero--visited' : 'place-panel__hero--pending'}`}>
        {photoUrl ? (
          <img src={photoUrl} alt={place.name} className="place-panel__photo" />
        ) : (
          <div className="place-panel__placeholder">
            <span className="place-panel__status-icon">{visited ? '★' : '○'}</span>
            <p>{visited ? 'Sin foto aún' : 'Por visitar'}</p>
            {!visited && entry?.target_date && (
              <p className="place-panel__target">Objetivo: {entry.target_date}</p>
            )}
            {!visited && !entry?.target_date && (
              <p className="place-panel__target">Añade una fecha objetivo al editar</p>
            )}
          </div>
        )}
      </div>

      <div className="place-panel__body">
        <h2>{place.name}</h2>
        <p className={`status-badge ${visited ? 'status-badge--visited' : 'status-badge--pending'}`}>
          {visited ? 'Visitado' : 'Pendiente — te espera'}
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
                    aria-label={`Información de ${child.name}`}
                    title={`Info — ${child.name}`}
                  >
                    i
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {user ? (
          <UploadForm
            place={place}
            entry={entry}
            user={user}
            onSaved={onSaved}
          />
        ) : (
          <p className="login-hint">Inicia sesión para subir fotos o marcar visitas.</p>
        )}
      </div>
    </aside>
  )
}
