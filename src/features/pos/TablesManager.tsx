import { useState } from 'react'
import { Card } from '../../components/ui'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { DEFAULT_TABLES } from './posSeed'
import { POS_STORAGE_KEYS } from './posTypes'
import type { HeldOrder } from './posTypes'

// The simple table list: name the tables, see which have an open order, start or resume one.
export default function TablesManager({
  heldOrders,
  currentTable,
  onCurrentTableChange,
  onStart,
  onResume,
  onNotice,
}: {
  heldOrders: HeldOrder[]
  currentTable: string
  onCurrentTableChange: (name: string) => void
  onStart: (tableId: string) => void
  onResume: (order: HeldOrder) => void
  onNotice: (text: string) => void
}) {
  const [tables, setTables] = useBrowserSyncedState<string[]>(POS_STORAGE_KEYS.tables, DEFAULT_TABLES)
  const [newTableName, setNewTableName] = useState('')
  const [editingTable, setEditingTable] = useState<string | null>(null)
  const [editedTableName, setEditedTableName] = useState('')
  const occupiedTables = new Set(heldOrders.filter((order) => order.orderType === 'Dine-in' && order.table).map((order) => order.table))

  return (
    <div className="space-y-5">
      <Card title="Tables" description={`${tables.length} tables · ${occupiedTables.size} occupied`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((tableId) => {
            const held = heldOrders.find((order) => order.orderType === 'Dine-in' && order.table === tableId)
            return (
              <button key={tableId} onClick={() => (held ? onResume(held) : onStart(tableId))} className={`rounded-xl border p-4 text-left transition hover:border-brand ${held ? 'border-amber-300 bg-amber-50' : 'border-black/10 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold">{tableId}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${held ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{held ? 'Occupied' : 'Available'}</span>
                </div>
                <p className="mt-3 text-sm text-ink/60">{held ? `${held.items.reduce((sum, item) => sum + item.qty, 0)} item(s) · Resume` : 'Start order'}</p>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Add a table">
          <div className="flex gap-2">
            <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="T13, Patio 1, VIP-1" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
            <button onClick={() => {
              const name = newTableName.trim()
              if (!name) return onNotice('Enter a table name.')
              if (tables.some((t) => t.toLowerCase() === name.toLowerCase())) return onNotice('A table with that name already exists.')
              setTables((old) => [...old, name])
              setNewTableName('')
              onNotice(`${name} added.`)
            }} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">Add table</button>
          </div>
        </Card>
        <Card title="Edit or remove tables">
          <div className="max-h-48 space-y-2 overflow-auto">
            {tables.map((tableId) => (
              <div key={tableId} className="flex items-center gap-2 rounded-lg border border-black/5 bg-white p-2">
                {editingTable === tableId ? (
                  <>
                    <input value={editedTableName} onChange={(e) => setEditedTableName(e.target.value)} className="min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1 text-sm" />
                    <button onClick={() => {
                      const name = editedTableName.trim()
                      if (!name || (name.toLowerCase() !== tableId.toLowerCase() && tables.some((t) => t.toLowerCase() === name.toLowerCase()))) return onNotice('Enter a unique table name.')
                      if (occupiedTables.has(tableId)) return onNotice('Resume or cancel the active order before renaming this table.')
                      setTables((old) => old.map((t) => (t === tableId ? name : t)))
                      if (currentTable === tableId) onCurrentTableChange(name)
                      setEditingTable(null)
                      onNotice(`Table renamed to ${name}.`)
                    }} className="text-xs font-semibold text-brand">Save</button>
                    <button onClick={() => setEditingTable(null)} className="text-xs">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{tableId}{occupiedTables.has(tableId) ? ' · Occupied' : ''}</span>
                    <button onClick={() => { setEditingTable(tableId); setEditedTableName(tableId) }} className="rounded-md border border-black/10 px-2 py-1 text-xs">Edit</button>
                    <button onClick={() => {
                      if (occupiedTables.has(tableId)) return onNotice('Cannot remove a table with an active order. Resume or cancel that order first.')
                      setTables((old) => old.filter((t) => t !== tableId))
                      if (currentTable === tableId) onCurrentTableChange('')
                      onNotice(`${tableId} removed.`)
                    }} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700">Remove</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
