import { useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Money } from '#/components/accounts/money'
import { NativeSelect } from '#/components/register/native-select'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { parseCsv } from '#/lib/import/csv'
import { DATE_FORMATS, guessMapping, mapCsvRows } from '#/lib/import/map'
import type { CsvMapping, ImportRow } from '#/lib/import/map'
import { looksLikeOfx, parseOfx } from '#/lib/import/ofx'
import { MAX_IMPORT_ROWS, csvMappingSchema } from '#/lib/import/schemas'
import type { ImportResult } from '#/lib/import/schemas'
import { importTransactions } from '#/server/import'

type Step =
  | { kind: 'file' }
  | { kind: 'map'; table: Array<Array<string>>; mapping: CsvMapping }
  | {
      kind: 'preview'
      rows: Array<ImportRow>
      errors: Array<string>
      mapping: CsvMapping | null
    }

const DEFAULT_MAPPING: CsvMapping = {
  hasHeader: true,
  dateColumn: 0,
  dateFormat: 'MM/DD/YYYY',
  payeeColumn: 1,
  memoColumn: null,
  amountMode: 'single',
  amountColumn: 2,
  outflowColumn: null,
  inflowColumn: null,
  invertSign: false,
}

/** Import a CSV, OFX or QFX file. The file is parsed in the browser; only parsed rows are sent. */
export function ImportDialog({
  budgetId,
  accountId,
  savedMapping,
  currency,
}: {
  budgetId: string
  accountId: string
  /** The CSV mapping remembered for this account (unvalidated JSON from the database). */
  savedMapping: unknown
  currency: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadIcon /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl">
        <ImportWizard
          budgetId={budgetId}
          accountId={accountId}
          savedMapping={savedMapping}
          currency={currency}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ImportWizard({
  budgetId,
  accountId,
  savedMapping,
  currency,
  onDone,
}: {
  budgetId: string
  accountId: string
  savedMapping: unknown
  currency: string
  onDone: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>({ kind: 'file' })
  const [error, setError] = useState<string | null>(null)
  const [dry, setDry] = useState<ImportResult | null>(null)
  const [pending, startTransition] = useTransition()

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (file.size > 5_000_000) {
      setError('That file is too large (5 MB limit).')
      return
    }
    const text = await file.text()
    if (looksLikeOfx(text)) {
      const { transactions, errors } = parseOfx(text)
      goToPreview(
        transactions.map((t) => ({
          date: t.date,
          payee: t.payee,
          memo: t.memo,
          amount: t.amount,
          fitId: t.fitId,
        })),
        errors,
        null,
      )
      return
    }
    const table = parseCsv(text)
    if (table.length < 2) {
      setError('That does not look like a CSV with transactions.')
      return
    }
    const saved = csvMappingSchema.safeParse(savedMapping)
    const guessed = guessMapping(table[0] ?? [])
    setStep({
      kind: 'map',
      table,
      mapping: saved.success
        ? saved.data
        : { ...DEFAULT_MAPPING, ...stripNulls(guessed) },
    })
  }

  function goToPreview(
    rows: Array<ImportRow>,
    errors: Array<string>,
    mapping: CsvMapping | null,
  ) {
    if (rows.length === 0) {
      setError(errors[0] ?? 'No transactions found in that file.')
      return
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      setError(`Too many transactions (limit ${MAX_IMPORT_ROWS} per import).`)
      return
    }
    setError(null)
    setDry(null)
    setStep({ kind: 'preview', rows, errors, mapping })
    startTransition(async () => {
      try {
        setDry(
          await importTransactions({
            data: {
              budgetId,
              accountId,
              rows,
              dryRun: true,
              saveMapping: null,
            },
          }),
        )
      } catch {
        setError('Could not check the file against your transactions.')
      }
    })
  }

  function runImport(rows: Array<ImportRow>, mapping: CsvMapping | null) {
    startTransition(async () => {
      try {
        const result = await importTransactions({
          data: {
            budgetId,
            accountId,
            rows,
            dryRun: false,
            saveMapping: mapping,
          },
        })
        await router.invalidate()
        toast.success(
          `Imported ${result.created}, matched ${result.matched}, skipped ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'}`,
        )
        onDone()
      } catch {
        setError('Could not import that file.')
      }
    })
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Import transactions</DialogTitle>
        <DialogDescription>
          CSV, OFX or QFX from your bank. New transactions arrive as cleared and
          need your approval.
        </DialogDescription>
      </DialogHeader>

      {step.kind === 'file' ? (
        <div className="grid gap-2">
          <Label htmlFor="import-file">Choose a file</Label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.ofx,.qfx,.txt,text/csv"
            onChange={(e) => void onFile(e)}
            className="w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
      ) : null}

      {step.kind === 'map' ? (
        <MappingStep
          table={step.table}
          mapping={step.mapping}
          onChange={(mapping) => setStep({ ...step, mapping })}
          onNext={() => {
            const { rows, errors } = mapCsvRows(step.table, step.mapping)
            goToPreview(
              rows,
              errors.map((e) => `Row ${e.line}: ${e.message}`),
              step.mapping,
            )
          }}
        />
      ) : null}

      {step.kind === 'preview' ? (
        <div className="grid gap-3">
          <p className="text-sm" data-testid="import-summary">
            {step.rows.length} transaction{step.rows.length === 1 ? '' : 's'}{' '}
            found
            {step.errors.length > 0
              ? `, ${step.errors.length} row${step.errors.length === 1 ? '' : 's'} skipped`
              : ''}
            .{' '}
            {dry
              ? `${dry.created} new, ${dry.matched} will match existing transactions, ${dry.duplicates} already imported.`
              : 'Checking…'}
          </p>
          <div className="max-h-56 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="px-2 py-1 font-medium">Date</th>
                  <th className="px-2 py-1 font-medium">Payee</th>
                  <th className="px-2 py-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {step.rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 tabular-nums">{r.date}</td>
                    <td className="px-2 py-1">{r.payee || '—'}</td>
                    <td className="px-2 py-1 text-right">
                      <Money value={r.amount} currency={currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {step.rows.length > 10 ? (
            <p className="text-muted-foreground text-xs">
              Showing the first 10 of {step.rows.length}.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {step.kind === 'preview' ? (
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setStep({ kind: 'file' })}>
            Back
          </Button>
          <Button
            disabled={
              pending || dry === null || dry.created + dry.matched === 0
            }
            onClick={() => runImport(step.rows, step.mapping)}
          >
            {pending && dry !== null ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      ) : null}
    </div>
  )
}

function stripNulls<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>
}

function MappingStep({
  table,
  mapping,
  onChange,
  onNext,
}: {
  table: Array<Array<string>>
  mapping: CsvMapping
  onChange: (mapping: CsvMapping) => void
  onNext: () => void
}) {
  const width = Math.max(...table.slice(0, 20).map((r) => r.length))
  const header = mapping.hasHeader ? (table[0] ?? []) : []
  const label = (i: number) =>
    mapping.hasHeader && header[i] ? header[i] : `Column ${i + 1}`
  const columns = Array.from({ length: width }, (_, i) => i)
  const set = (patch: Partial<CsvMapping>) => onChange({ ...mapping, ...patch })

  const columnSelect = (
    id: string,
    text: string,
    value: number | null,
    key: keyof CsvMapping,
    optional: boolean,
  ) => (
    <div className="grid gap-1">
      <Label htmlFor={id}>{text}</Label>
      <NativeSelect
        id={id}
        value={value === null ? '' : String(value)}
        onChange={(e) =>
          set({ [key]: e.target.value === '' ? null : Number(e.target.value) })
        }
      >
        {optional ? <option value="">(none)</option> : null}
        {columns.map((i) => (
          <option key={i} value={i}>
            {label(i)}
          </option>
        ))}
      </NativeSelect>
    </div>
  )

  return (
    <div className="grid gap-4">
      <div className="max-h-40 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <tbody>
            {table.slice(0, 5).map((r, i) => (
              <tr
                key={i}
                className={
                  i === 0 && mapping.hasHeader
                    ? 'bg-muted/50 font-medium'
                    : 'border-t'
                }
              >
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1 whitespace-nowrap">
                    {r[c] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={mapping.hasHeader}
          onChange={(e) => set({ hasHeader: e.target.checked })}
        />
        First row is a header
      </label>

      <div className="grid grid-cols-2 gap-3">
        {columnSelect(
          'map-date',
          'Date column',
          mapping.dateColumn,
          'dateColumn',
          false,
        )}
        <div className="grid gap-1">
          <Label htmlFor="map-date-format">Date format</Label>
          <NativeSelect
            id="map-date-format"
            value={mapping.dateFormat}
            onChange={(e) =>
              set({ dateFormat: e.target.value as CsvMapping['dateFormat'] })
            }
          >
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </NativeSelect>
        </div>
        {columnSelect(
          'map-payee',
          'Payee column',
          mapping.payeeColumn,
          'payeeColumn',
          true,
        )}
        {columnSelect(
          'map-memo',
          'Memo column',
          mapping.memoColumn,
          'memoColumn',
          true,
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="map-amount-mode">Amounts</Label>
        <NativeSelect
          id="map-amount-mode"
          value={mapping.amountMode}
          onChange={(e) =>
            set({ amountMode: e.target.value as CsvMapping['amountMode'] })
          }
        >
          <option value="single">One column (negative = money out)</option>
          <option value="split">Separate outflow and inflow columns</option>
        </NativeSelect>
      </div>

      {mapping.amountMode === 'single' ? (
        <div className="grid grid-cols-2 gap-3">
          {columnSelect(
            'map-amount',
            'Amount column',
            mapping.amountColumn,
            'amountColumn',
            false,
          )}
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={mapping.invertSign}
              onChange={(e) => set({ invertSign: e.target.checked })}
            />
            Charges are positive (flip the sign)
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {columnSelect(
            'map-outflow',
            'Outflow column',
            mapping.outflowColumn,
            'outflowColumn',
            false,
          )}
          {columnSelect(
            'map-inflow',
            'Inflow column',
            mapping.inflowColumn,
            'inflowColumn',
            false,
          )}
        </div>
      )}

      <DialogFooter>
        <Button onClick={onNext}>Next</Button>
      </DialogFooter>
    </div>
  )
}
