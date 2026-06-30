import { cn } from '../../lib/cn'

const variants = {
  primary:
    'bg-amber-400 text-zinc-950 hover:bg-amber-300 active:bg-amber-500 font-semibold shadow-[var(--shadow-editor-sm)]',
  secondary:
    'bg-zinc-800 text-zinc-100 ring-1 ring-white/10 hover:bg-zinc-700 hover:ring-white/15',
  ghost:
    'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
  danger:
    'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20',
  outline:
    'bg-transparent text-zinc-300 ring-1 ring-white/10 hover:bg-white/5 hover:text-white',
}

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-10 px-5 text-sm rounded-xl gap-2',
  icon: 'size-9 rounded-lg p-0',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
