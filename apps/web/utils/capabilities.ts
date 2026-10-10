export type BusinessCapability =
  | 'CATALOG'
  | 'INVENTORY'
  | 'ORDERS'
  | 'DELIVERY'
  | 'TAKEAWAY'
  | 'MENU'
  | 'MENU_ITEMS'
  | 'POS'
  | 'APPOINTMENTS'
  | 'APPOINTMENT_SERVICES'
  | 'APPOINTMENT_STAFF'
  | 'APPOINTMENT_CUSTOMERS';

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
  MECHANICS: [
    'APPOINTMENTS',
    'APPOINTMENT_SERVICES',
    'APPOINTMENT_STAFF',
    'APPOINTMENT_CUSTOMERS',
  ],
  SERVICES: [
    'APPOINTMENTS',
    'APPOINTMENT_SERVICES',
    'APPOINTMENT_STAFF',
    'APPOINTMENT_CUSTOMERS',
  ],
  RENTALS: [],
};

export function canUseBusinessCapability(category: string | undefined | null, capability: BusinessCapability): boolean {
  if (!category) return false;
  const caps = CategoryCapabilities[category.toUpperCase()] || [];
  return caps.includes(capability);
}
