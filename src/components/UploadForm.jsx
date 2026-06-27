import { useRef, useState } from 'react'
import {
  deletePlaceEntry,
  savePlaceEntry,
  uploadPhoto,
} from '../lib/supabase'

export default function UploadForm({ place, entry, user, onSaved }) {
  const fileRef = useRef(null)
  const [visitDate, setVisitDate] = useState(entry?.visit_date ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [targetDate, setTargetDate] = useState(entry?.target_date ?? '')
  const [status, setStatus] = useState(entry?.status ?? 'pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let photoPath = entry?.photo_path ?? null
      const file = fileRef.current?.files?.[0]

      if (file) {
        photoPath = await uploadPhoto(file, place.slug, user.id)
      }

      const finalStatus = status === 'visited' && photoPath ? 'visited' : status

      await savePlaceEntry({
        placeSlug: place.slug,
        photoPath,
        visitDate: finalStatus === 'visited' ? visitDate : null,
        note,
        status: finalStatus,
        targetDate: finalStatus === 'pending' ? targetDate : null,
        userId: user.id,
        existingId: entry?.id,
      })

      if (fileRef.current) fileRef.current.value = ''
      setPreview(null)
      onSaved()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!entry?.id) return
    if (!window.confirm('¿Eliminar esta entrada del lugar?')) return
    setLoading(true)
    try {
      await deletePlaceEntry(entry.id)
      onSaved()
    } catch (err) {
      setError(err.message || 'Error al eliminar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <h3>Editar lugar</h3>

      <fieldset className="status-toggle">
        <legend>Estado</legend>
        <label>
          <input
            type="radio"
            name="status"
            value="pending"
            checked={status === 'pending'}
            onChange={() => setStatus('pending')}
          />
          Por visitar (gris)
        </label>
        <label>
          <input
            type="radio"
            name="status"
            value="visited"
            checked={status === 'visited'}
            onChange={() => setStatus('visited')}
          />
          Visitado (color)
        </label>
      </fieldset>

      {status === 'pending' ? (
        <label>
          Fecha objetivo
          <input
            type="text"
            placeholder="ej. marzo 2026"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </label>
      ) : (
        <>
          <label>
            Fecha del viaje
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </label>
          <label>
            Tu foto
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
            />
          </label>
          {preview && (
            <img src={preview} alt="Vista previa" className="upload-preview" />
          )}
        </>
      )}

      <label>
        Detalle / nota
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Recuerdo de este lugar…"
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {entry?.id && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={handleDelete}
            disabled={loading}
          >
            Eliminar
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
