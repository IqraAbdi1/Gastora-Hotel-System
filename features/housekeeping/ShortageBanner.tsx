import { useHousekeeping } from './hkContext'
import { useShortages } from './useShortages'

// Warns when arrivals today outnumber the rooms that are ready, and offers the quickest fix.
export default function ShortageBanner() {
  const shortages = useShortages()
  const { rushRoom } = useHousekeeping()
  if (shortages.length === 0) return null

  return (
    <div className="space-y-2">
      {shortages.map((s) => (
        <div
          key={s.type}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/10 p-4"
        >
          <div>
            <p className="font-semibold text-warn">
              {s.type}: {s.arriving} arriving today, {s.ready} room{s.ready === 1 ? '' : 's'} ready
            </p>
            <p className="text-sm text-ink/70">
              {s.cleaning + s.dirty === 0
                ? `No ${s.type} room is being cleaned. Rooms may be out of service. See Issues.`
                : `${s.cleaning} being cleaned, ${s.dirty} dirty. First room likely ready about ${s.firstReady}.`}
            </p>
            <p className="text-xs text-ink/50">Estimate, based on average clean times.</p>
          </div>
          {s.candidate ? (
            <button
              type="button"
              onClick={() => s.candidate && rushRoom(s.candidate.room, '')}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Rush room {s.candidate.room}
            </button>
          ) : (
            s.alreadyRushed && (
              <p className="text-sm font-semibold text-good">Rush sent for room {s.alreadyRushed.room}</p>
            )
          )}
        </div>
      ))}
    </div>
  )
}