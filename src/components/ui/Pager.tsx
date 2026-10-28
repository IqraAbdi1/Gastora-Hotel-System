import Button from './Button'

// The footer under a long list: where you are, and the two buttons that move you.
// Hidden entirely when everything fits on one page.
export default function Pager({
  page,
  total,
  perPage,
  onPage,
  noun,
}: {
  page: number
  total: number
  perPage: number
  onPage: (page: number) => void
  /** Plural, as it reads in "of 63 rooms". */
  noun: string
}) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  if (pages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-2.5 text-sm">
      <span className="text-ink/60">
        Page {page + 1} of {pages} · {total} {noun}
      </span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="ghost" size="sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}
