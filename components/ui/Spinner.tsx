export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600 ${className}`}
    />
  )
}
