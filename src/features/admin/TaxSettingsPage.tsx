import { useState } from 'react'
import Switch from '../../components/Switch'
import { Badge, Button, Card, Field, Input, PageHeader, Segmented, Select } from '../../components/ui'
import { ugx } from '../../lib/format'
import { CUSTOM_KIND_LABEL, LHT_BAND_LABEL, LHT_BAND_NOTE, stayTaxes } from '../../lib/tax'
import type { CustomTax, CustomTaxKind, EfrisSettings, EfrisStatus, LhtBand, VatMode } from '../../lib/tax'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

const num = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0

function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {note && <p className="text-xs text-ink/60">{note}</p>}
      </div>
      {children}
    </div>
  )
}

// The hotel's own tax rules and EFRIS choice. Only the hotel admin and owner change these.
// Gastora switches the Tax lines feature on; it does not decide the rates, because every hotel's position differs.
export default function TaxSettingsPage() {
  const { tenant, tax, setTax } = useFeatures()
  const { can } = useAuth()
  const [draft, setDraft] = useState<{ name: string; kind: CustomTaxKind; value: string }>({ name: '', kind: 'percent', value: '' })
  const [nights, setNights] = useState(2)
  const [rate, setRate] = useState(150000)

  if (!tax) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <PageHeader eyebrow="Admin" title="Taxes and EFRIS" description={tenant.name} />
        <p className="mt-4 rounded-lg bg-ink/5 px-4 py-3 text-sm text-ink/70">
          Tax lines are not on your plan. Contact Gastora to switch them on.
        </p>
      </div>
    )
  }

  const editable = can('changeSettings')
  const set = setTax
  const efris = tax.efris
  const setEfris = (patch: Partial<EfrisSettings>) => set({ efris: { ...efris, ...patch } })
  const preview = stayTaxes(tax, rate * nights, nights)
  const draftOk = draft.name.trim() !== '' && num(draft.value) > 0

  function addCustom() {
    if (!draftOk) return
    const c: CustomTax = { id: `X-${Date.now()}`, name: draft.name.trim(), kind: draft.kind, value: num(draft.value), on: true }
    set({ custom: [...tax!.custom, c] })
    setDraft({ name: '', kind: 'percent', value: '' })
  }
  const patchCustom = (id: string, patch: Partial<CustomTax>) =>
    set({ custom: tax.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  const efrisMissing = efris.status === 'registered' && (efris.tin.trim() === '' || efris.deviceNo.trim() === '')

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader
        eyebrow="Admin"
        title="Taxes and EFRIS"
        description={`${tenant.name}. Set what this hotel charges and how its invoices are fiscalised.`}
        meta={<Badge tone={editable ? 'good' : 'neutral'}>{editable ? 'You can edit' : 'View only'}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <fieldset disabled={!editable} className="min-w-0 space-y-5">
          <Card title="VAT" icon="money" padded description="Rule: 18% on accommodation. Switch off if the hotel is not VAT registered.">
            <div className="space-y-3">
              <Row title="Charge VAT">
                <Switch on={tax.vatOn} label="Charge VAT" onChange={(v) => set({ vatOn: v })} />
              </Row>
              {tax.vatOn && (
                <>
                  <Segmented<VatMode>
                    label="VAT mode"
                    value={tax.vatMode}
                    onChange={(m) => set({ vatMode: m })}
                    options={[
                      { key: 'included', label: 'Rates include VAT' },
                      { key: 'added', label: 'Add VAT on top' },
                    ]}
                  />
                  <div className="max-w-40">
                    <Field label="VAT rate %">
                      {(id) => (
                        <Input id={id} inputMode="decimal" value={String(Math.round(tax.vatRate * 10000) / 100)} onChange={(e) => set({ vatRate: Math.min(100, num(e.target.value)) / 100 })} />
                      )}
                    </Field>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card title="Local Hotel Tax" icon="list" padded description="Estimate: bands follow the KCCA guide. Confirm with your council.">
            <div className="space-y-3">
              <Row title="Charge Local Hotel Tax" note="Collected from the guest at check-in. Not part of the room rate.">
                <Switch on={tax.lhtOn} label="Charge Local Hotel Tax" onChange={(v) => set({ lhtOn: v })} />
              </Row>
              {tax.lhtOn && (
                <>
                  <Select aria-label="Local Hotel Tax band" value={tax.lhtBand} onChange={(e) => set({ lhtBand: e.target.value as LhtBand })}>
                    {(Object.keys(LHT_BAND_LABEL) as LhtBand[]).map((b) => (
                      <option key={b} value={b}>{LHT_BAND_LABEL[b]}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-ink/60">{LHT_BAND_NOTE[tax.lhtBand]}</p>
                  {tax.lhtBand === 'star45' && (
                    <div className="max-w-48">
                      <Field label="UGX per US$">
                        {(id) => <Input id={id} inputMode="numeric" value={String(tax.usdRate)} onChange={(e) => set({ usdRate: Math.max(1, num(e.target.value)) })} />}
                      </Field>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card title="Service charge" icon="sparkles" padded description="A percentage of the room charge. Leave at 0 if the hotel does not charge one.">
            <div className="max-w-40">
              <Field label="Service charge %">
                {(id) => <Input id={id} inputMode="decimal" value={String(tax.servicePercent)} onChange={(e) => set({ servicePercent: Math.min(25, num(e.target.value)) })} />}
              </Field>
            </div>
          </Card>

          <Card title="Other taxes and fees" icon="list" padded count={tax.custom.length} description="Add any tax or fee the hotel must collect, for example a city levy or a tourism fee. Each one is added on top at check-in.">
            <div className="space-y-3">
              {tax.custom.length === 0 && <p className="text-sm text-ink/55">None added yet.</p>}
              {tax.custom.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-surface p-2.5">
                  <Input aria-label="Tax name" className="min-w-0 flex-1" value={c.name} onChange={(e) => patchCustom(c.id, { name: e.target.value })} />
                  <Select aria-label="Tax type" className="w-auto" value={c.kind} onChange={(e) => patchCustom(c.id, { kind: e.target.value as CustomTaxKind })}>
                    {(Object.keys(CUSTOM_KIND_LABEL) as CustomTaxKind[]).map((k) => (
                      <option key={k} value={k}>{CUSTOM_KIND_LABEL[k]}</option>
                    ))}
                  </Select>
                  <Input aria-label="Tax amount" className="w-28" inputMode="decimal" value={String(c.value)} onChange={(e) => patchCustom(c.id, { value: num(e.target.value) })} />
                  <Switch on={c.on} label={`${c.name} on`} onChange={(v) => patchCustom(c.id, { on: v })} />
                  <Button variant="ghost" size="sm" onClick={() => set({ custom: tax.custom.filter((x) => x.id !== c.id) })}>Remove</Button>
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
                <div className="min-w-40 flex-1">
                  <Field label="New tax or fee">
                    {(id) => <Input id={id} placeholder="e.g. City levy" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
                  </Field>
                </div>
                <Select aria-label="New tax type" className="w-auto" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as CustomTaxKind })}>
                  {(Object.keys(CUSTOM_KIND_LABEL) as CustomTaxKind[]).map((k) => (
                    <option key={k} value={k}>{CUSTOM_KIND_LABEL[k]}</option>
                  ))}
                </Select>
                <Input aria-label="New tax amount" className="w-28" inputMode="decimal" placeholder="Amount" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
                <Button onClick={addCustom} disabled={!draftOk}>Add tax</Button>
              </div>
            </div>
          </Card>

          <Card title="URA EFRIS" icon="check" padded description="EFRIS is URA's system for fiscal invoices. A registered business sends each invoice to URA and gets back a fiscal document number and a verification code.">
            <div className="space-y-3">
              <Segmented<EfrisStatus>
                label="EFRIS status"
                value={efris.status}
                onChange={(s) => setEfris({ status: s })}
                options={[
                  { key: 'registered', label: 'Registered' },
                  { key: 'exempt', label: 'Exempt' },
                  { key: 'notSet', label: 'Not set up' },
                ]}
              />
              {efris.status === 'registered' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Seller TIN" required>
                    {(id) => <Input id={id} inputMode="numeric" value={efris.tin} onChange={(e) => setEfris({ tin: e.target.value.replace(/\D/g, '').slice(0, 10) })} />}
                  </Field>
                  <Field label="Legal name on invoices">
                    {(id) => <Input id={id} value={efris.legalName} onChange={(e) => setEfris({ legalName: e.target.value })} />}
                  </Field>
                  <Field label="EFRIS device number" required>
                    {(id) => <Input id={id} value={efris.deviceNo} onChange={(e) => setEfris({ deviceNo: e.target.value })} />}
                  </Field>
                </div>
              )}
              {efris.status === 'exempt' && (
                <Field label="Reason for exemption" hint="Printed on the hotel's invoices. Example: not VAT registered.">
                  {(id) => <Input id={id} value={efris.exemptReason} onChange={(e) => setEfris({ exemptReason: e.target.value })} />}
                </Field>
              )}
              {efrisMissing && <p className="text-xs font-medium text-warn">Add the TIN and device number before invoices can be fiscalised.</p>}
              {efris.status === 'notSet' && <p className="text-xs font-medium text-warn">Invoices will say "Not fiscalised" until you choose Registered or Exempt.</p>}
              <p className="rounded-lg bg-brand/[0.06] p-3 text-xs text-ink/65">
                AI (preview/sample): in this prototype the fiscal number and verification code are made up on screen. A real connection needs the hotel's EFRIS details from URA and a server that sends each invoice and stores URA's reply. The hotel admin or owner decides whether the hotel is registered or exempt.
              </p>
            </div>
          </Card>
        </fieldset>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Preview" icon="money" padded description="What a guest sees at check-in with these settings.">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nights">{(id) => <Input id={id} inputMode="numeric" value={String(nights)} onChange={(e) => setNights(Math.min(60, Math.max(1, num(e.target.value))))} />}</Field>
              <Field label="Rate per night">{(id) => <Input id={id} inputMode="numeric" value={String(rate)} onChange={(e) => setRate(num(e.target.value))} />}</Field>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink/60">Room charge</dt><dd className="tabular-nums">{ugx(rate * nights)}</dd></div>
              {preview.onTop.map((l, i) => (
                <div key={`${l.key}-${i}`} className="flex justify-between gap-3"><dt className="text-ink/60">{l.label}</dt><dd className="tabular-nums">{ugx(l.amount)}</dd></div>
              ))}
              <div className="flex justify-between gap-3 border-t border-ink/10 pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{ugx(rate * nights + preview.onTopTotal)}</dd></div>
              {preview.vatInside > 0 && <p className="text-xs text-ink/55">Includes VAT: {ugx(preview.vatInside)}</p>}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  )
}
