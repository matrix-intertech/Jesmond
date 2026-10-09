export type BusinessCapability =
  | 'CATALOG'
  | 'INVENTORY'
  | 'ORDERS'
  | 'DELIVERY'
  | 'TAKEAWAY'
  | 'MENU'
  | 'MENU_ITEMS'
  | 'POS'
  | 'APPOINTMENTS';

export const CategoryCapabilities: Record<string, BusinessCapability[]> = {
  RETAIL: [
    'CATALOG',
    'INVENTORY',
    'ORDERS',
    'DELIVERY',
    'TAKEAWAY',
    'POS',
  ],
  FOOD: [], // Food commerce is not implemented in this phase
  MECHANICS: ['APPOINTMENTS'],
  SERVICES: ['APPOINTMENTS'],
  RENTALS: [],
};

export function canUseBusinessCapability(category: string | undefined | null, capability: BusinessCapability): boolean {
  if (!category) return false;
  const caps = CategoryCapabilities[category.toUpperCase()] || [];
  return caps.includes(capability);
}
