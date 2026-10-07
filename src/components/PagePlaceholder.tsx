type Props = { title: string; note?: string }

export default function PagePlaceholder({ title, note }: Props) {
  return (
    <section>
      <h1 className="text-2xl font-bold text-brand">{title}</h1>
      <p className="mt-2 text-ink/70">{note ?? 'This page is not built yet.'}</p>
    </section>
  )
}