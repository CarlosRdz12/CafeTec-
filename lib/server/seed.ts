import { randomUUID } from 'node:crypto'
import type { Category, Product } from '@/lib/types'

const SEED: [string, string, Category, number, number][] = [
  ['Café americano', 'Café de grano recién preparado, 12 oz.', 'bebidas_calientes', 2500, 80],
  ['Capuchino', 'Espresso con leche vaporizada y espuma.', 'bebidas_calientes', 3800, 60],
  ['Chocolate caliente', 'Chocolate de mesa con leche.', 'bebidas_calientes', 3200, 40],
  ['Agua fresca del día', 'Vaso de 16 oz. Sabor según temporada.', 'bebidas_frias', 2000, 50],
  ['Frappé de café', 'Café helado batido con leche.', 'bebidas_frias', 4500, 30],
  ['Chilaquiles verdes', 'Con pollo, crema y queso fresco.', 'desayunos', 6500, 25],
  ['Molletes', 'Dos piezas con frijol, queso y pico de gallo.', 'desayunos', 4800, 25],
  ['Torta de milanesa', 'Pan telera, milanesa de res, aguacate y jitomate.', 'comidas', 7000, 20],
  ['Ensalada de pollo', 'Lechuga, pollo a la plancha, verduras y aderezo.', 'comidas', 6800, 15],
  ['Sándwich de jamón', 'Pan integral, jamón, queso y verduras.', 'snacks', 4200, 30],
  ['Fruta picada', 'Vaso con fruta de temporada, limón y chile.', 'snacks', 3000, 20],
  ['Galleta de avena', 'Galleta horneada en casa.', 'postres', 1500, 40],
  ['Pastel de chocolate', 'Rebanada individual.', 'postres', 3500, 12],
]

export function seedProducts(): Product[] {
  const now = new Date().toISOString()
  return SEED.map(([name, description, category, priceCents, stock]) => ({
    id: randomUUID(),
    name,
    description,
    category,
    priceCents,
    stock,
    lowStockThreshold: 5,
    available: true,
    createdAt: now,
    updatedAt: now,
  }))
}
