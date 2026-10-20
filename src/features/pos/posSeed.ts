import type { Product, Recipes } from './posTypes'

// The original Restaurant and Bar menu, used when the browser has no saved menu yet.
export const BASE_PRODUCTS: Product[] = [
  { id: 'm1', name: 'Chicken & chips', category: 'Main dishes', outlet: 'Restaurant', price: 22000, unit: 'plate', emoji: '🍗' },
  { id: 'm2', name: 'Beef burger', category: 'Main dishes', outlet: 'Restaurant', price: 18000, unit: 'plate', emoji: '🍔' },
  { id: 'm3', name: 'Fish fillet', category: 'Main dishes', outlet: 'Restaurant', price: 28000, unit: 'plate', emoji: '🐟' },
  { id: 'm4', name: 'Vegetable rice', category: 'Main dishes', outlet: 'Restaurant', price: 14000, unit: 'plate', emoji: '🍚' },
  { id: 'm5', name: 'Garden salad', category: 'Starters', outlet: 'Restaurant', price: 10000, unit: 'bowl', emoji: '🥗' },
  { id: 'd1', name: 'Fresh juice', category: 'Soft drinks', outlet: 'Restaurant', price: 7000, unit: 'glass', emoji: '🧃' },
  { id: 'd2', name: 'Soda', category: 'Soft drinks', outlet: 'Bar', price: 4000, unit: 'bottle', emoji: '🥤' },
  { id: 'd3', name: 'Mineral water', category: 'Soft drinks', outlet: 'Bar', price: 3000, unit: 'bottle', emoji: '💧' },
  { id: 'd4', name: 'House mocktail', category: 'Mocktails', outlet: 'Bar', price: 12000, unit: 'glass', emoji: '🍹' },
  { id: 'd5', name: 'Espresso', category: 'Hot drinks', outlet: 'Restaurant', price: 8000, unit: 'cup', emoji: '☕' },
  { id: 'd6', name: 'House beer', category: 'Beer', outlet: 'Bar', price: 9000, unit: 'bottle', emoji: '🍺' },
  { id: 'd7', name: 'House wine (glass)', category: 'Wine', outlet: 'Bar', price: 15000, unit: 'glass', emoji: '🍷' },
]

// Menu items for the outlets added after Restaurant and Bar. Migration adds only ids that are missing,
// so a hotel's own edits are never overwritten.
export const EXTRA_PRODUCTS: Product[] = [
  { id: 'rs1', name: 'Club sandwich', category: 'All day', outlet: 'Room service', price: 24000, unit: 'plate', emoji: '🥪' },
  { id: 'rs2', name: 'Full breakfast tray', category: 'Breakfast', outlet: 'Room service', price: 35000, unit: 'tray', emoji: '🍳' },
  { id: 'rs3', name: 'Pot of African tea', category: 'Hot drinks', outlet: 'Room service', price: 6000, unit: 'pot', emoji: '🫖', trackStock: false },
  { id: 'mb1', name: 'Minibar water', category: 'Minibar', outlet: 'Minibar', price: 5000, unit: 'bottle', emoji: '💧' },
  { id: 'mb2', name: 'Minibar soda', category: 'Minibar', outlet: 'Minibar', price: 6000, unit: 'bottle', emoji: '🥤' },
  { id: 'mb3', name: 'Minibar beer', category: 'Minibar', outlet: 'Minibar', price: 12000, unit: 'bottle', emoji: '🍺' },
  { id: 'mb4', name: 'Roasted cashews', category: 'Snacks', outlet: 'Minibar', price: 8000, unit: 'pack', emoji: '🥜', trackStock: false },
  { id: 'mb5', name: 'Chocolate bar', category: 'Snacks', outlet: 'Minibar', price: 7000, unit: 'bar', emoji: '🍫', trackStock: false },
  { id: 'pb1', name: 'Passion smoothie', category: 'Smoothies', outlet: 'Pool bar', price: 14000, unit: 'glass', emoji: '🥤' },
  { id: 'pb2', name: 'Fruit platter', category: 'Snacks', outlet: 'Pool bar', price: 16000, unit: 'plate', emoji: '🍉' },
  { id: 'pb3', name: 'Poolside beer', category: 'Beer', outlet: 'Pool bar', price: 10000, unit: 'bottle', emoji: '🍺' },
  { id: 'gs1', name: 'Sunscreen SPF 50', category: 'Toiletries', outlet: 'Gift shop', price: 45000, unit: 'tube', emoji: '🧴', trackStock: false },
  { id: 'gs2', name: 'Postcard set', category: 'Souvenirs', outlet: 'Gift shop', price: 10000, unit: 'set', emoji: '✉️', trackStock: false },
  { id: 'gs3', name: 'Ugandan coffee 250 g', category: 'Souvenirs', outlet: 'Gift shop', price: 38000, unit: 'pack', emoji: '☕', trackStock: false },
]

export const EXTRA_RECIPES: Recipes = {
  rs1: [
    { stockId: 'fnb-bun', qty: 1, unit: 'piece' },
    { stockId: 'fnb-chicken', qty: 120, unit: 'g' },
    { stockId: 'fnb-lettuce', qty: 20, unit: 'g' },
    { stockId: 'fnb-tomato', qty: 30, unit: 'g' },
  ],
  rs2: [
    { stockId: 'fnb-potato', qty: 150, unit: 'g', wastePercent: 5 },
    { stockId: 'fnb-tomato', qty: 40, unit: 'g' },
    { stockId: 'fnb-oil', qty: 15, unit: 'ml' },
    { stockId: 'fnb-bun', qty: 1, unit: 'piece' },
    { stockId: 'fnb-orange', qty: 2, unit: 'piece' },
  ],
  mb1: [{ stockId: 'fnb-water', qty: 1, unit: 'bottle' }],
  mb2: [{ stockId: 'fnb-soda', qty: 1, unit: 'bottle' }],
  mb3: [{ stockId: 'fnb-beer', qty: 1, unit: 'bottle' }],
  pb1: [
    { stockId: 'fnb-juice-base', qty: 150, unit: 'ml' },
    { stockId: 'fnb-milk', qty: 50, unit: 'ml' },
  ],
  pb2: [
    { stockId: 'fnb-orange', qty: 2, unit: 'piece', yieldPercent: 70 },
    { stockId: 'fnb-lemon', qty: 0.25, unit: 'piece' },
  ],
  pb3: [{ stockId: 'fnb-beer', qty: 1, unit: 'bottle' }],
}

export const DEFAULT_TABLES = Array.from({ length: 12 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`)
