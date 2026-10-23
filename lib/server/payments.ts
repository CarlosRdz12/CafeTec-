import 'server-only'

/**
 * Online payments stay disabled until a payment provider (recommended: Stripe)
 * is connected and STRIPE_SECRET_KEY is configured. See README, "Pagos en línea".
 */
export function isOnlinePaymentEnabled() {
  return false
}

/**
 * Demo-only card payment: never contacts a bank and never receives card data.
 * Enabled by default; set CAFETEC_SIMULATED_PAYMENTS=off to hide it.
 */
export function isSimulatedCardEnabled() {
  return process.env.CAFETEC_SIMULATED_PAYMENTS !== 'off'
}
