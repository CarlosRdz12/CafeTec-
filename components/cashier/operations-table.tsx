import Link from 'next/link'
import { formatDateTime, formatMoney, formatOrderNumber } from '@/lib/format'
import type { CashierOperation } from '@/lib/server/order-service'
import { CHARGE_LABELS, EVENT_LABELS, STATUS_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

function describe(op: CashierOperation) {
  if (op.type === 'estado' && op.toStatus) return `Marcado como ${STATUS_LABELS[op.toStatus].toLowerCase()}`
  if (op.payment) return `${EVENT_LABELS[op.type]} · ${CHARGE_LABELS[op.payment.method]}`
  if (op.type === 'qr_consultado') return `Consulta por ${op.note === 'QR' ? 'QR' : 'folio'}`
  return EVENT_LABELS[op.type]
}

export function OperationsTable({ operations, empty }: { operations: CashierOperation[]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Fecha</th>
            <th scope="col" className="px-4 py-3 font-medium">Folio</th>
            <th scope="col" className="px-4 py-3 font-medium">Operación</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody>
          {operations.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{empty}</td>
            </tr>
          )}
          {operations.map((op) => (
            <tr key={op.id} className="border-b last:border-0">
              <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(op.createdAt)}</td>
              <td className="px-4 py-2.5">
                <Link href={`/caja/pedido/${op.orderId}`} className="font-medium tabular-nums text-primary underline-offset-4 hover:underline">
                  {formatOrderNumber(op.orderNumber)}
                </Link>
              </td>
              <td className="px-4 py-2.5">
                <span className={cn(op.type === 'pago_fallido' && 'text-destructive', op.type === 'pago_exitoso' && 'text-success')}>{describe(op)}</span>
                {op.payment && (
                  <span className="block font-mono text-xs text-muted-foreground">
                    {op.payment.reference}
                    {op.payment.failureReason && ` · ${op.payment.failureReason}`}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{op.payment ? formatMoney(op.payment.amountCents) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
