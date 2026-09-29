# Agency Roles & Permissions - Implementation Analysis (PHASE 1)

## 1. Current Architecture

### 1.1 Role Architecture
- **Global Roles**: Handled by the `UserRole` enum (`STUDENT`, `ORG_STAFF`, `ADMIN`, `SUPER_ADMIN`).
- **Agency-Level Roles**: Currently handled by a simple `AgencyRole` enum on the `OrgStaff` model. 
  - Values are `AGENCY_ADMIN` and `TEAM_MEMBER`.
  - There is **no database model** representing custom reusable roles (e.g., a "Role" table with `name`, `description`, `permissions`).
  - Access to sensitive Agency endpoints is currently checked by verifying if the caller is `UserRole.ADMIN`, `UserRole.SUPER_ADMIN`, or an `OrgStaff` with `agencyRole === AGENCY_ADMIN` (e.g., `AgencyService.verifyAgencyAdmin()`).

### 1.2 Permission Architecture
- **Global/Retail Permissions**: The `OrgStaff` model has a `permissions: String[]` field.
  - This field is **already being used successfully** by the Retail module (`RetailPermissionGuard` and `RequirePermissions` decorator using `RetailPermission` enum).
  - Agency module currently **does not use** `OrgStaff.permissions`.
- **Property-Level Permissions**: These are handled via the `PropertyManager` join model, linking `OrgStaff` to `Property`.
  - It uses the `PropertyPermission` enum, supporting `VIEW` and `MANAGE`.
  - It is actively enforced in `PropertiesService.verifyPropertyAccess()`, where non-admin team members must have a matching `PropertyManager` record to view or edit a property.

### 1.3 Settings Architecture (Frontend)
- The Agency Settings page (`/portal/agency/settings`) is currently a single basic form.
- The prompt requires converting it to a categorized layout (General, Agency Profile, Team, Roles & Permissions, Notifications). 
- Team Members are currently managed at `/portal/agency/members`. The UI there handles assigning properties (`propertyAssignments`), but doesn't handle custom roles or granular permissions yet.

## 2. Gap Analysis & Proposed Solutions

### 2.1 Reusable Custom Roles
**Gap:** The prompt requires Agency Admins to create, edit, and delete "Custom Roles" with descriptions and permission assignments. 
**Solution:** We cannot rely solely on the `AgencyRole` enum. We **must introduce a new model** to represent custom roles.
- **Proposed Model:** `CustomRole` (or `AgencyCustomRole`), scoped to `organizationId`.
- **Fields:** `id`, `organizationId`, `name`, `description`, `permissions: String[]`, `isDefault/isSystem`.
- **Relationship:** Update `OrgStaff` with an optional `customRoleId` to link a staff member to their assigned custom role. (We can retain `agencyRole` as a fallback or system-level marker).

### 2.2 Reusing Existing Permission Infrastructure
**Gap:** Agency endpoints currently rely on simple role checks (Admin vs Team Member). We need granular checks.
**Solution:** 
- Define a new enum/constants for Agency permissions (e.g., `AGENCY_VIEW`, `AGENCY_MANAGE`, `PROPERTY_MANAGE_ALL`, etc.) mimicking the Retail module's approach.
- Reuse or adapt the existing `@RequirePermissions()` decorator logic.
- We will sync a user's effective permissions (derived from their assigned `CustomRole`) into the existing `OrgStaff.permissions` array. This ensures the backend permission guard can work exactly as it does for Retail without modifying the core guard logic!

### 2.3 Preserving Property-Level Permissions
**Gap:** "A user's agency role should define their default/base permissions, while property-level permissions should continue to control access to individual properties."
**Solution:**
- The existing `PropertyManager` table and `verifyPropertyAccess` logic will remain completely untouched. 
- If a user has a global `PROPERTY_MANAGE_ALL` permission (from their Custom Role), the guard could bypass the `PropertyManager` check. Otherwise, it falls back to the existing `PropertyManager` check for explicit assignments.

## 3. Database Changes Required (Minimal)
Since we must support creating and saving custom role templates, a Prisma schema update is strictly necessary.

```prisma
model AgencyCustomRole {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  name           String
  description    String?
  permissions    String[]     // Array of permission strings
  isSystem       Boolean      @default(false) // e.g. default Agency Admin role

  staff          OrgStaff[]   // Relation to users holding this role

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([organizationId, name])
  @@index([organizationId])
}

// Update OrgStaff to include:
// customRoleId String?
// customRole   AgencyCustomRole? @relation(fields: [customRoleId], references: [id])
```

## 4. Next Steps (PHASE 2 - DESIGN)
If this analysis is approved, I will proceed to create `roles_permissions_implementation_plan.md` outlining the precise API contracts, frontend component restructuring, and the exact precedence flow for permissions.
