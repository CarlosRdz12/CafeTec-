import { Cake, Coffee, CupSoda, EggFried, Sandwich, UtensilsCrossed } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import type { OrderView } from '@/lib/server/order-service'
import { CATEGORY_LABELS, type Category } from '@/lib/types'

// Products have no photos in CafeTEC, so each line shows its category icon instead.
const CATEGORY_ICONS: Record<Category, typeof Coffee> = {
  bebidas_calientes: Coffee,
  bebidas_frias: CupSoda,
  desayunos: EggFried,
  comidas: UtensilsCrossed,
  snacks: Sandwich,
  postres: Cake,
}

export function OrderItemsTable({ items, totalCents }: { items: OrderView['items']; totalCents: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">Producto</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium sm:px-4">Cant.</th>
            <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell sm:px-4">Precio unit.</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium sm:px-4">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const Icon = item.category ? CATEGORY_ICONS[item.category] : UtensilsCrossed
            return (
              <tr key={item.productId} className="border-b last:border-0">
                <td className="px-3 py-2.5 sm:px-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.category ? CATEGORY_LABELS[item.category] : 'Producto'}
                        <span className="sm:hidden"> · {formatMoney(item.unitPriceCents)} c/u</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-base font-semibold tabular-nums sm:px-4">{item.quantity}</td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell sm:px-4">
                  {formatMoney(item.unitPriceCents)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums sm:px-4">{formatMoney(item.subtotalCents)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/30">
            <th scope="row" colSpan={2} className="px-3 py-3 text-left font-semibold sm:hidden">Total</th>
            <th scope="row" colSpan={3} className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Total</th>
            <td className="px-3 py-3 text-right font-serif text-lg font-semibold tabular-nums text-primary sm:px-4">{formatMoney(totalCents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
