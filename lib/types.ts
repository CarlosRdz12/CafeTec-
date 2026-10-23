export const ROLES = ['cliente', 'personal', 'cajero', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const CATEGORIES = ['bebidas_calientes', 'bebidas_frias', 'desayunos', 'comidas', 'snacks', 'postres'] as const
export type Category = (typeof CATEGORIES)[number]

export const ORDER_STATUSES = ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** How the buyer chose to pay when placing the order. */
export const PAYMENT_METHODS = ['caja', 'en_linea', 'tarjeta_simulada'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export type PaymentStatus = 'pendiente' | 'pagado' | 'reembolsado'

/** Instrument actually used to settle an order (recorded in each payment). */
export const CHARGE_METHODS = ['efectivo', 'tarjeta_simulada'] as const
export type ChargeMethod = (typeof CHARGE_METHODS)[number]

export type PaymentResult = 'exitoso' | 'fallido'

export type MovementReason = 'venta' | 'cancelacion' | 'ajuste' | 'reabastecimiento'

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
  role: Role
  active: boolean
  createdAt: string
}

export type PublicUser = Omit<User, 'passwordHash'>

export interface Product {
  id: string
  name: string
  description: string
  category: Category
  priceCents: number
  stock: number
  lowStockThreshold: number
  available: boolean
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  productId: string
  name: string
  unitPriceCents: number
  quantity: number
}

export interface Order {
  id: string
  number: number
  userId: string
  customerName: string
  items: OrderItem[]
  totalCents: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  notes: string
  createdAt: string
  updatedAt: string
  /** Opaque random token encoded in the order QR. Never contains order data. */
  qrToken: string
  paidMethod?: ChargeMethod
  paidAt?: string
  /** Successful payment that settled the order. */
  paymentId?: string
  /** Staff member who charged the order at the counter. */
  chargedBy?: string
  /** Staff member who handed the order over. */
  deliveredBy?: string
}

/** Payment attempt. At most one `exitoso` payment may exist per order. */
export interface Payment {
  id: string
  /** Short human-readable reference shown on receipts, e.g. SIM-7F3A9C21. */
  reference: string
  orderId: string
  amountCents: number
  method: ChargeMethod
  result: PaymentResult
  failureReason?: string
  /** True for demo transactions: no real money moves. */
  simulated: boolean
  channel: 'comprador' | 'caja'
  idempotencyKey: string
  userId: string
  createdAt: string
}

export type OrderEventType = 'creado' | 'estado' | 'pago_exitoso' | 'pago_fallido' | 'reembolso' | 'qr_consultado'

/** Append-only history of relevant order operations. */
export interface OrderEvent {
  id: string
  orderId: string
  type: OrderEventType
  fromStatus?: OrderStatus
  toStatus?: OrderStatus
  paymentId?: string
  userId: string
  role: Role
  note: string
  createdAt: string
}

export interface InventoryMovement {
  id: string
  productId: string
  delta: number
  reason: MovementReason
  note: string
  userId: string
  orderId?: string
  createdAt: string
}

export interface Database {
  version: 2
  users: User[]
  products: Product[]
  orders: Order[]
  movements: InventoryMovement[]
  payments: Payment[]
  orderEvents: OrderEvent[]
  nextOrderNumber: number
}

export const CATEGORY_LABELS: Record<Category, string> = {
  bebidas_calientes: 'Bebidas calientes',
  bebidas_frias: 'Bebidas frías',
  desayunos: 'Desayunos',
  comidas: 'Comidas',
  snacks: 'Snacks',
  postres: 'Postres',
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  preparando: 'En preparación',
  listo: 'Listo para recoger',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const ROLE_LABELS: Record<Role, string> = {
  cliente: 'Cliente / estudiante',
  personal: 'Personal',
  cajero: 'Cajero',
  admin: 'Administrador',
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  caja: 'Pago en caja',
  en_linea: 'Pago en línea',
  tarjeta_simulada: 'Tarjeta (simulado)',
}

export const CHARGE_LABELS: Record<ChargeMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta_simulada: 'Tarjeta (simulado)',
}

export const EVENT_LABELS: Record<OrderEventType, string> = {
  creado: 'Pedido creado',
  estado: 'Cambio de estado',
  pago_exitoso: 'Pago registrado',
  pago_fallido: 'Pago rechazado',
  reembolso: 'Reembolso pendiente',
  qr_consultado: 'Pedido consultado',
}
