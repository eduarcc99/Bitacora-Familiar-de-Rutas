/** Une clases de Tailwind omitiendo valores falsy */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
