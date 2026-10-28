// A service error, shown above the buttons of the form that caused it.
export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg bg-bad/8 px-3 py-2 text-sm font-medium text-bad">
      {error}
    </p>
  )
}
