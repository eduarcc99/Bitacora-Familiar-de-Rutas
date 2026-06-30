const SUGGESTED_MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 20

export function validateImageFiles(fileList) {
  const files = [...(fileList ?? [])]
  const valid = []
  const errors = []
  const warnings = []

  if (files.length > MAX_FILES) {
    return {
      valid: [],
      errors: [`Máximo ${MAX_FILES} archivos por subida.`],
      warnings: [],
    }
  }

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      errors.push(`«${file.name}» no es una imagen válida.`)
      continue
    }
    if (file.size === 0) {
      errors.push(`«${file.name}» está vacío.`)
      continue
    }
    if (file.size > SUGGESTED_MAX_BYTES) {
      warnings.push(
        `«${file.name}» pesa más de 10 MB; se subirá igual, pero puede tardar más.`,
      )
    }
    valid.push(file)
  }

  return { valid, errors, warnings }
}
