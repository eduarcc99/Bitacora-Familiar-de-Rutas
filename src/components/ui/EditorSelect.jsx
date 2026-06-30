import { cn } from '../../lib/cn'

export default function EditorSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
  className,
}) {
  const selected = options.find((o) => o.slug === value)

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </label>
      <div className="relative">
        <select
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border border-white/10 bg-zinc-900/80',
            'px-3 pr-9 text-sm text-zinc-100 transition-colors',
            'hover:border-white/15 hover:bg-zinc-900',
            'focus:border-amber-400/40 focus:outline-none focus:ring-2 focus:ring-amber-400/20',
            'disabled:cursor-not-allowed disabled:opacity-40',
            !selected && 'text-zinc-500',
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.slug} value={opt.slug} className="bg-zinc-900 text-zinc-100">
              {opt.name}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  )
}
