export enum BusinessCapability {
  CATALOG = 'CATALOG',
  INVENTORY = 'INVENTORY',
  ORDERS = 'ORDERS',
  DELIVERY = 'DELIVERY',
  TAKEAWAY = 'TAKEAWAY',
  MENU = 'MENU',
  MENU_ITEMS = 'MENU_ITEMS',
  POS = 'POS',
  APPOINTMENTS = 'APPOINTMENTS',
}

export const CategoryCapabilities: Record<string, BusinessCapability[]> = {
  RETAIL: [
    BusinessCapability.CATALOG,
    BusinessCapability.INVENTORY,
    BusinessCapability.ORDERS,
    BusinessCapability.DELIVERY,
    BusinessCapability.TAKEAWAY,
    BusinessCapability.POS,
  ],
  FOOD: [
    BusinessCapability.MENU,
    BusinessCapability.MENU_ITEMS,
    BusinessCapability.ORDERS,
  ],
  MECHANICS: [BusinessCapability.APPOINTMENTS],
  SERVICES: [BusinessCapability.APPOINTMENTS],
  RENTALS: [],
};
