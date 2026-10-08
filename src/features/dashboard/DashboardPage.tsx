const kpis = [
  {
    label: 'Occupancy',
    value: '78%',
    detail: '+4.2% from yesterday',
  },
  {
    label: 'Today’s Revenue',
    value: '$12,840',
    detail: '+8.6% from yesterday',
  },
  {
    label: 'Arrivals',
    value: '24',
    detail: '8 still expected',
  },
  {
    label: 'Departures',
    value: '18',
    detail: '3 pending checkout',
  },
]

const roomStatus = [
  { label: 'Occupied', value: 42 },
  { label: 'Available', value: 14 },
  { label: 'Cleaning', value: 6 },
  { label: 'Maintenance', value: 2 },
]

const arrivals = [
  {
    guest: 'Sarah Johnson',
    room: 'Deluxe 204',
    time: '12:30 PM',
    status: 'Confirmed',
  },
  {
    guest: 'Michael Okello',
    room: 'Suite 301',
    time: '1:00 PM',
    status: 'Confirmed',
  },
  {
    guest: 'Grace Nakato',
    room: 'Standard 108',
    time: '2:30 PM',
    status: 'Pending',
  },
  {
    guest: 'Daniel Smith',
    room: 'Deluxe 216',
    time: '4:00 PM',
    status: 'Confirmed',
  },
]

const alerts = [
  {
    title: '3 rooms require housekeeping attention',
    detail: 'Review the housekeeping board before peak check-in.',
  },
  {
    title: '2 inventory items are below reorder level',
    detail: 'Review stock levels and create purchase requests.',
  },
  {
    title: '1 approval requires your attention',
    detail: 'A financial adjustment is waiting for approval.',
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            Wednesday, 7 October 2026
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Overview of today’s hotel operations and business performance.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
          <span className="font-medium text-gray-900">Sample Hotel</span>
          <span className="mx-2 text-gray-300">•</span>
          Main Branch
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{kpi.label}</p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              {kpi.value}
            </p>

            <p className="mt-2 text-xs text-gray-500">{kpi.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Room status
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Current room availability across the branch.
              </p>
            </div>

            <span className="text-sm font-medium text-gray-500">
              64 rooms
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {roomStatus.map((room) => (
              <div
                key={room.label}
                className="rounded-lg bg-gray-50 p-4"
              >
                <p className="text-sm text-gray-500">{room.label}</p>

                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {room.value}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Operational alerts
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Items requiring attention.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.title}
                className="border-l-2 border-gray-300 pl-3"
              >
                <p className="text-sm font-medium text-gray-900">
                  {alert.title}
                </p>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {alert.detail}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Today’s arrivals
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Guests expected to arrive today.
              </p>
            </div>

            <span className="text-sm font-medium text-gray-500">
              {arrivals.length} shown
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-3 font-medium">Guest</th>
                  <th className="pb-3 font-medium">Room</th>
                  <th className="pb-3 font-medium">Arrival</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody>
                {arrivals.map((arrival) => (
                  <tr
                    key={`${arrival.guest}-${arrival.room}`}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-4 text-sm font-medium text-gray-900">
                      {arrival.guest}
                    </td>

                    <td className="py-4 text-sm text-gray-600">
                      {arrival.room}
                    </td>

                    <td className="py-4 text-sm text-gray-600">
                      {arrival.time}
                    </td>

                    <td className="py-4">
                      <span
                        className={
                          arrival.status === 'Confirmed'
                            ? 'rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700'
                            : 'rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700'
                        }
                      >
                        {arrival.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Quick actions
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Common operational tasks.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              New reservation
            </button>

            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Check in guest
            </button>

            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Open housekeeping
            </button>

            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              View approvals
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}