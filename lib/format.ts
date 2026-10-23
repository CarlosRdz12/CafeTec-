const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const dateTime = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
})

export function formatMoney(cents: number) {
  return currency.format(cents / 100)
}

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso))
}

export function formatOrderNumber(n: number) {
  return `#${String(n).padStart(4, '0')}`
}
