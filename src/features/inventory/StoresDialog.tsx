import { useState } from 'react'
import { useRequests } from '../procurement/requestsContext'
import { MAIN_STORE_ID } from '../procurement/requestsModel'

/** Add, rename and remove stores. Only the owner and hotel admin open this. */
export default function StoresDialog({ onClose }: { onClose: () => void }) {
  const { stores, stock, addStore, renameStore, removeStore } = useRequests()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState('')

  const count = (id: string) => stock.filter((s) => (s.store ?? MAIN_STORE_ID) === id).length

  function add() {
    const problem = addStore(name)
    setError(problem ?? '')
    if (!problem) setName('')
  }

  function saveRename() {
    if (!editing) return
    const problem = renameStore(editing.id, editing.name)
    setError(problem ?? '')
    if (!problem) setEditing(null)
  }

  const field = 'rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4">
      <div className="my-10 w-full max-w-md space-y-4 rounded-xl bg-surface p-5">
        <div>
          <h2 className="text-lg font-bold">Stores</h2>
          <p className="text-sm text-ink/60">
            Each item lives in one store. To move an item, edit it and pick another store. The move is recorded in its history.
          </p>
        </div>

        <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 text-sm">
          {stores.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {editing?.id === s.id ? (
                <>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ id: s.id, name: e.target.value })}
                    className={`${field} min-w-40 flex-1`}
                  />
                  <button type="button" onClick={saveRename} className="text-sm font-semibold text-brand">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="text-sm text-ink/60">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="block text-xs text-ink/50">
                      {count(s.id)} item{count(s.id) === 1 ? '' : 's'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: s.id, name: s.name })}
                    className="text-sm font-semibold text-brand"
                  >
                    Rename
                  </button>
                  {s.id !== MAIN_STORE_ID && (
                    <button
                      type="button"
                      onClick={() => setError(removeStore(s.id) ?? '')}
                      className="text-sm font-semibold text-bad"
                    >
                      Remove
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New store, for example Kitchen store"
            className={`${field} flex-1`}
          />
          <button
            type="button"
            onClick={add}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Add
          </button>
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}