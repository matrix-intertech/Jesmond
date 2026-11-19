# Jesmond 2.0 — Retail Business Onboarding & Operations Guide

> **Target Audience:** Store Owners, Retail Managers, Platform Administrators, and Onboarding Engineers
> **Applicable Environment:** Jesmond 2.0 Web Portal & API
> **Default Timezone:** `Australia/Sydney` (AEST / AEDT)
> **Currency Format:** Australian Dollars (AUD), stored internally as integers in cents ($19.99 = 1999 cents)
> **Default GST Rate:** 10% (0.10) for standard retail merchandise; 0% (0.00) for GST-free food staples

---

## Executive Overview

This operational runbook establishes the end-to-end standard operating procedure (SOP) for setting up, configuring, and operating a Retail Business on Jesmond 2.0. Whether onboarding an automated demo account or guiding a new independent store owner, this document outlines every sequential stage—from tenant creation to processing cash register sales and reviewing audit trails.

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ 1. Registration │ ──> │ 2. Profile Setup     │ ──> │ 3. Branch Creation  │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
                                                                │
                                                                ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ 6. POS Terminal │ <── │ 5. Catalog Authoring │ <── │ 4. Inventory Init   │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────────┐
│ 7. Process Sale │ ──> │ 8. Audit & History   │
└─────────────────┘     └──────────────────────┘
```

---

## Sequential 10-Step Setup & Operations Workflow

### Step 1: Account Registration & User Provisioning
1. **Access Point:** Navigate to `/register`.
2. **Account Selection:** Select **Business Account**.
3. **Identity Details:** Provide First Name, Last Name, Phone Number, Date of Birth, and Country Code (`+61` for Australia).
4. **Business Specification:**
   - **Business Name:** e.g., `Jesmond Retail Express`.
   - **Business Category:** Select `Retail` (`businessCategory: "RETAIL"`).
   - The platform automatically assigns the organization `type: "RETAIL"` and provisions the initial user as `UserRole.ORG_STAFF` with primary owner privileges.
5. **Email Verification:** If email verification is enabled, enter the 6-digit OTP dispatched to the corporate email.

---

### Step 2: Business Profile & Settings Configuration
1. **Access Point:** Navigate to `/portal/retail/business` and `/portal/retail/settings`.
2. **Business Details:**
   - Configure Australian Business Number (ABN).
   - Enter primary business telephone and public support email.
   - Set business operating hours and public visibility toggle (`isPubliclyVisible: true`).
3. **Fulfillment Capabilities:**
   - Enable **In-Store Pickup / Takeaway** (`takeawayEnabled: true`).
   - Enable or disable **Local Delivery** (`deliveryEnabled: false/true`).

---

### Step 3: Retail Branch Creation & Activation
> **CRITICAL ARCHITECTURAL REQUIREMENT:** Every retail business **must** have at least one active branch before inventory, catalog stock, or POS terminals can be provisioned. Inventory records use a composite primary key `@@id([branchId, productId])`.
1. **Access Point:** Navigate to `/portal/retail/branches`.
2. **New Branch Provisioning:**
   - Click **Add Branch**.
   - **Branch Name:** e.g., `Jesmond Store - Main Branch` or `Newcastle CBD Store`.
   - **Physical Address:** e.g., `Shop 4, 12 Blue Gum Road, Jesmond NSW 2299`.
   - **Phone Number:** e.g., `02 4900 1234`.
   - **Status:** Set toggle to **Active**.
3. **Verification:** Confirm the branch appears in the branch list with an active status badge.

---

### Step 4: POS Terminal Configuration (Registers)
1. **Access Point:** Navigate to `/portal/retail/terminals`.
2. **Register Provisioning:**
   - Click **Add Terminal**.
   - **Assigned Branch:** Select the branch created in Step 3.
   - **Terminal Name:** e.g., `Main Counter Register - 01`.
   - **Display Name:** e.g., `Cash Register 1`.
   - **External Identifier:** e.g., `REG-01` or `DEMO-REG-01`.
   - **Provider / Mode:**
     - For standalone cash/manual EFTPOS setups: Leave payment gateway provider unset (`provider: NULL`).
     - For integrated Tyro/Stripe terminals: Select provider and enter merchant pairing ID.
3. **Status:** The terminal is initialized in `ONLINE` status ready to accept transactions.

---

### Step 5: Employee Management, Roles & Branch Permissions
1. **Access Point:** Navigate to `/portal/retail/employees`.
2. **Invite Staff:**
   - Click **Invite Employee**.
   - Enter email address, first name, and surname.
   - **Assigned Branch:** Lock employee to their physical store branch (`retailBranchId`) or leave unrestricted for floating managers.
3. **Assign Granular Permissions:**
   - **Cashier / Floor Staff:**
     - `POS_VIEW`, `POS_USE`, `CUSTOMERS_VIEW`, `ORDERS_VIEW`
   - **Store Shift Supervisor:**
     - `POS_VIEW`, `POS_USE`, `ORDERS_VIEW`, `ORDERS_MANAGE`, `INVENTORY_VIEW`, `INVENTORY_ADJUST`, `CATALOG_VIEW`
   - **Branch Manager / Owner:**
     - `*` or all 20 explicit `RetailPermission`s (`BRANCH_VIEW`, `BRANCH_MANAGE`, `STAFF_VIEW`, `STAFF_MANAGE`, `TERMINALS_VIEW`, `TERMINALS_MANAGE`, `RETAIL_SETTINGS_MANAGE`, etc.)

---

### Step 6: Product Category Architecture & Taxonomy
1. **Access Point:** Navigate to `/portal/retail/catalog` $\rightarrow$ **Categories**.
2. **Category Definitions:** Create department categories to structure inventory.
   - **Electronics & Accessories:** *Cables, chargers, audio and mobile tech accessories*
   - **Home Essentials:** *Household cleaning supplies, kitchenware and home decor*
   - **Personal Care:** *Everyday grooming, skin care, oral health and wellness*
   - **Stationery & Office:** *Notebooks, pens, desk organizers and study supplies*
   - **Grocery & Packaged Goods:** *Snacks, beverages, coffee and shelf-stable pantry items*
3. **Status:** Ensure categories are flagged as `isActive: true`.

---

### Step 7: Product Catalog Authoring
1. **Access Point:** Navigate to `/portal/retail/catalog`.
2. **Add Products:**
   - Click **New Product**.
   - **Product Name:** e.g., `USB-C to Lightning Braided Cable 1.5m`.
   - **Category:** Select assigned category.
   - **SKU (Stock Keeping Unit):** Unique code, e.g., `ELEC-CBL-001`.
   - **Barcode (EAN-13 / UPC):** e.g., `9312345001014`.
   - **Selling Price:** Input AUD retail price (e.g., `$19.99`, converted to `1999` cents).
   - **Cost Price:** Input wholesale purchase cost (e.g., `$8.50`, converted to `850` cents).
   - **GST Rate:**
     - Standard taxable goods: `10%` (`taxRate: 0.10`).
     - GST-free basic food items (plain water, coffee beans, nuts): `0%` (`taxRate: 0.00`).
   - **Unit:** `piece`, `pack`, `set`, `bottle`, or `bag`.
   - **Image URL:** Product display image.
   - **Initial Status:** Active (`isActive: true`).

---

### Step 8: Branch Inventory Initialization & Stock Tracking
1. **Access Point:** Navigate to `/portal/retail/inventory`.
2. **Branch Context:** Select the active branch from the top-right branch selector.
3. **Stock Level Verification:**
   - Products created in Catalog appear in the branch inventory table.
   - Initial stock defaults to 0 units until initialized.
4. **Stock Intake / Receipt:**
   - Click on any product row to open the stock detail drawer.
   - Click **Adjust Stock**.
   - Select Type: **ADD** (`actualQty > 0`).
   - Select Reason: `STOCK_RECEIPT` or `INITIAL_COUNT`.
   - Input Received Quantity (e.g., `45` units).
   - Click **Apply Adjustment**.
   - Verify that:
     - Real-time stock reflects the update immediately.
     - A recorded movement appears in the Stock Movement audit log.
     - KPI summary cards (Total Products, Total Units, Low Stock, Healthy) update instantly.

---

### Step 9: Point of Sale (POS) Register Operations
1. **Access Point:** Navigate to `/portal/retail/pos`.
2. **Terminal Session Selection:** Select the active register (e.g., `Main Counter Register - 01`).
3. **Adding Items to Cart:**
   - **Barcode Scanning:** Scan product barcode via attached USB/Bluetooth scanner or enter barcode in the search bar.
   - **Manual Lookup:** Search by SKU or product name, or click category tiles.
   - Adjust quantities or apply line-item discounts.
4. **Customer Assignment (Optional):**
   - Search existing customer by name/phone or click **Walk-in Customer**.
5. **Tender & Payment Processing:**
   - Click **Checkout / Pay**.
   - Select Payment Method:
     - **Cash:** Input amount tendered; system computes change due.
     - **Card / Manual EFTPOS:** Process amount on card terminal, then confirm receipt in POS.
   - Click **Complete Sale**.
   - Printable thermal receipt is generated with transaction ID, tax breakdown, and itemized lines.
   - Branch inventory automatically decrements by sold units in real time.

---

### Step 10: Sales History, Order Tracking & Audit Verification
1. **Access Point:** Navigate to `/portal/retail/sales-history` or `/portal/retail/orders`.
2. **Order Verification:**
   - Confirm completed order appears with unique Order Number (`ORD-xxxx`).
   - Status displays `COMPLETED`.
   - Payment method, cashier name, branch name, and AUD totals reflect accurately.
3. **Audit Trail:**
   - Return to `/portal/retail/inventory` $\rightarrow$ select sold item $\rightarrow$ open drawer.
   - Confirm a movement of type `SALE` with negative quantity matching the transaction was appended to the immutable `InventoryMovement` log.

---

## Concise Operational Checklist

| Phase | Milestone | Responsible Role | Verification Method |
|---|---|---|---|
| **1. Identity** | Register business account with category `RETAIL` | Business Owner | Verify redirect to `/portal/retail` with header "Retail Business Dashboard" |
| **2. Structure** | Create physical store branch | Business Owner / Admin | Check `/portal/retail/branches` shows active branch |
| **3. Hardware** | Configure POS cash register | Store Manager | Check `/portal/retail/terminals` shows status `ONLINE` |
| **4. Staffing** | Provision cashier accounts with POS permissions | Store Manager | Check `/portal/retail/employees` shows linked staff |
| **5. Taxonomy** | Create retail departments/categories | Inventory Manager | Check `/portal/retail/catalog` category list |
| **6. Catalog** | Author products with SKU, cent price & GST rate | Inventory Manager | Verify catalog table shows correct AUD formatted prices |
| **7. Stock** | Initialize branch stock levels via stock receipt | Store Staff | Check `/portal/retail/inventory` shows non-zero units and KPI health |
| **8. POS** | Process first test sale on register | Cashier | Check POS completes transaction and issues receipt |
| **9. Audit** | Verify inventory decrement and sales history | Store Manager | Check `/portal/retail/sales-history` and movement ledger |

---

## Comprehensive Troubleshooting Guide

### 1. "No branches found..." & Stuck Skeletons on `/portal/retail/inventory`
- **Symptom:** The branch selector shows "No branches found...", all 4 KPI StatCards show loading skeleton pulses, and the table shows 5 pulsating skeleton rows indefinitely.
- **Root Cause:**
  1. The organization has 0 branches configured in the database, or
  2. The frontend `fetchBranches()` previously failed to call `setLoading(false)` when `branches.length === 0`.
- **Resolution:**
  - With the current patch applied, the page cleanly stops loading and renders a clear empty state: *"No retail branches found. You need at least one active branch to manage inventory."* with a direct CTA button **"Set Up Your First Branch"**.
  - Click **Set Up Your First Branch** (or visit `/portal/retail/branches`) and create your initial branch.
  - Refresh the inventory page; the branch will populate and inventory will load.

### 2. 403 Forbidden on `/api/v1/retail/branches` or `/api/v1/retail/inventory`
- **Symptom:** API calls to retail endpoints return HTTP 403 Forbidden.
- **Root Cause:**
  - `OrgTypesGuard` rejected the user because `org.type` in the database was `PROVIDER` (default) rather than `RETAIL`, even though `businessCategory` was `RETAIL`.
  - Alternatively, the user's `OrgStaff` role lacks `BRANCH_VIEW` or `INVENTORY_VIEW` permissions.
- **Resolution:**
  - Backend `OrgTypesGuard` now determines effective type by checking `user.businessCategory === 'RETAIL'`, granting access.
  - For permission errors: Log in as the Organization Owner (`role: ADMIN` has wildcard `*` access) and grant the cashier employee `BRANCH_VIEW` and `INVENTORY_VIEW` via `/portal/retail/employees`.

### 3. POS Terminal Not Showing in POS Register View
- **Symptom:** When navigating to `/portal/retail/pos`, no registers are available to start a session.
- **Root Cause:** The terminal is configured under a different branch than the one currently selected, or status is `INACTIVE`.
- **Resolution:**
  - Navigate to `/portal/retail/terminals`.
  - Confirm the terminal's assigned `branchId` matches your physical branch.
  - Ensure status is set to `ONLINE`.

### 4. Pricing Calculation Mismatch (100x Discrepancy)
- **Symptom:** A product entered as $20.00 displays as $2,000.00 or $0.20.
- **Root Cause:** In Jesmond 2.0, all financial amounts in Postgres are stored as **cents** (`sellingPrice: 2000`).
- **Resolution:**
  - When authoring via UI forms, input standard AUD (e.g. `20.00`); the frontend converts `Math.round(parseFloat(price) * 100)`.
  - In direct SQL seeds, always provide integer cents (`2000` for $20.00). Never insert decimal float values into integer columns.

### 5. Negative Stock Adjustment Rejection
- **Symptom:** Submitting a stock removal error alert displays: *"Adjustment would result in negative stock."*
- **Root Cause:** Jesmond 2.0 enforces inventory integrity; current quantity cannot drop below 0.
- **Resolution:** Verify physical count. If damaged or lost goods exceed recorded stock, first verify past receipt movements in the item's drawer history.
