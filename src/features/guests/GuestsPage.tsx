import { useState } from 'react'
import { useHotel } from '../../lib/hotelContext'

export default function GuestsPage() {
  const { guests } = useHotel()
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const shown = guests.filter(
    (g) => q === '' || g.name.toLowerCase().includes(q) || g.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Guests</h1>
        <p className="text-sm text-ink/60">{guests.length} guests in total</p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone"
        className="w-full max-w-sm rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />

      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nationality</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {shown.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-3 font-semibold">{g.name}</td>
                <td className="px-4 py-3">{g.phone}</td>
                <td className="px-4 py-3">{g.email ?? '-'}</td>
                <td className="px-4 py-3">{g.nationality ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-4 text-sm text-ink/60">No guests match.</p>}
      </div>
    </div>
  )
}