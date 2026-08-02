export default function VisitorNavControls({
  canBack,
  canForward,
  canHome,
  onBack,
  onForward,
  onHome,
}) {
  return (
    <div className="visitor-nav" role="navigation" aria-label="Navegación del mapa">
      <button
        type="button"
        className="visitor-nav__btn"
        disabled={!canBack}
        onClick={onBack}
        aria-label="Atrás"
        title="Atrás"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        className="visitor-nav__btn"
        disabled={!canForward}
        onClick={onForward}
        aria-label="Adelante"
        title="Adelante"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        className="visitor-nav__btn visitor-nav__btn--home"
        disabled={!canHome}
        onClick={onHome}
        aria-label="Inicio del mundo"
        title="Inicio del mundo"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
        </svg>
      </button>
    </div>
  )
}
