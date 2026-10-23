import { AlertTriangle } from 'lucide-react'
import { SIMULATION_NOTICE } from '@/lib/domain/payments'
import { cn } from '@/lib/utils'

export function SimulationBanner({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-lg border-2 border-dashed border-warning bg-warning/20 px-3 py-2 text-warning-foreground',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-bold tracking-wide">{SIMULATION_NOTICE}</p>
        {!compact && (
          <p className="mt-0.5 text-xs">
            Pago de demostración: no se conecta a ningún banco y no se solicitan ni guardan datos de tarjetas reales.
          </p>
        )}
      </div>
    </div>
  )
}
