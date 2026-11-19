import { test, expect } from '@playwright/test';

test.describe('Customer Appointment History Module', () => {
  const mockCustomer = {
    id: 'cust-101',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'sarah.connor@example.com',
    phone: '0412 888 999',
    createdAt: '2025-06-15T00:00:00.000Z',
  };

  const mockCustomerEmpty = {
    id: 'cust-empty-202',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: null,
    createdAt: '2026-02-01T00:00:00.000Z',
  };

  const mockCustomerList = [
    {
      id: 'cust-101',
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.connor@example.com',
      phone: '0412 888 999',
      firstSeen: '2025-06-15T00:00:00.000Z',
      totalAppointments: 3,
      lastAppointmentDate: '2026-11-25T10:00:00.000Z',
      lastServiceName: 'Air Conditioning Regas & Service',
    },
    {
      id: 'cust-empty-202',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: null,
      firstSeen: '2026-02-01T00:00:00.000Z',
      totalAppointments: 0,
      lastAppointmentDate: null,
      lastServiceName: null,
    },
  ];

  const mockAppointments = [
    {
      id: 'appt-hist-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      customerId: 'cust-101',
      serviceId: 'svc-1',
      serviceName: 'Comprehensive Vehicle Safety Inspection',
      durationMins: 60,
      price: 18900,
      currency: 'AUD',
      status: 'COMPLETED',
      startTime: '2026-11-10T09:00:00.000Z',
      endTime: '2026-11-10T10:00:00.000Z',
      timezone: 'Australia/Sydney',
      customerNotes: 'Please check rear brake pads and wiper fluid.',
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-10T10:05:00.000Z',
      service: {
        id: 'svc-1',
        name: 'Comprehensive Vehicle Safety Inspection',
        description: 'Complete 100-point vehicle safety inspection',
        durationMins: 60,
        price: 18900,
      },
      staff: {
        id: 'staff-1',
        role: 'SENIOR_MECHANIC',
        user: {
          id: 'u-1',
          firstName: 'Dave',
          lastName: 'Tradie',
          email: 'dave@tradie.com',
        },
      },
      branch: { id: 'branch-1', name: 'Jesmond Central Workshop' },
    },
    {
      id: 'appt-hist-2',
      organizationId: 'org-1',
      branchId: 'branch-1',
      customerId: 'cust-101',
      serviceId: 'svc-2',
      serviceName: 'Emergency Roadside Battery Replacement',
      durationMins: 45,
      price: 24900,
      currency: 'AUD',
      status: 'CONFIRMED',
      startTime: '2026-11-25T11:00:00.000Z',
      endTime: '2026-11-25T11:45:00.000Z',
      timezone: 'Australia/Sydney',
      customerNotes: '[Offline Booking] Urgent roadside battery drop-in',
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
      service: {
        id: 'svc-2',
        name: 'Emergency Roadside Battery Replacement',
        description: 'Battery testing, removal and replacement',
        durationMins: 45,
        price: 24900,
      },
      staff: {
        id: 'staff-1',
        role: 'SENIOR_MECHANIC',
        user: {
          id: 'u-1',
          firstName: 'Dave',
          lastName: 'Tradie',
          email: 'dave@tradie.com',
        },
      },
      branch: { id: 'branch-1', name: 'Jesmond Central Workshop' },
    },
    {
      id: 'appt-hist-3',
      organizationId: 'org-1',
      branchId: 'branch-1',
      customerId: 'cust-101',
      serviceId: 'svc-3',
      serviceName: 'Logbook Scheduled Maintenance',
      durationMins: 90,
      price: 29900,
      currency: 'AUD',
      status: 'CANCELLED',
      startTime: '2026-10-15T13:00:00.000Z',
      endTime: '2026-10-15T14:30:00.000Z',
      timezone: 'Australia/Sydney',
      customerNotes: 'Customer rescheduled to a later date.',
      createdAt: '2026-10-10T12:00:00.000Z',
      updatedAt: '2026-10-14T09:00:00.000Z',
      service: {
        id: 'svc-3',
        name: 'Logbook Scheduled Maintenance',
        durationMins: 90,
        price: 29900,
      },
      staff: null,
      branch: { id: 'branch-1', name: 'Jesmond Central Workshop' },
    },
  ];

  const setupCustomerHistorySession = async (
    page: any,
    businessCategory: 'SERVICES' | 'MECHANICS' = 'SERVICES',
  ) => {
    const user = {
      id: 'user-biz-1',
      email:
        businessCategory === 'SERVICES'
          ? 'demo.services@jesmond.com.au'
          : 'demo.mechanics@jesmond.com.au',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory,
      organizationId: 'org-1',
    };

    const corsHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    };

    await page.route(/\/api\/v1\//, async (route: any) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      const url = route.request().url();

      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ ...user, user }),
        });
        return;
      }

      if (url.includes('/settings/profile')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ profileCompletion: { isComplete: true } }),
        });
        return;
      }

      // List of customers for Customers page
      if (url.includes('/api/v1/business-appointments/customers') && !url.includes('/history')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(mockCustomerList),
        });
        return;
      }

      // Customer Appointment History endpoint
      if (url.includes('/api/v1/business-appointments/customers/cust-101/history')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            customer: mockCustomer,
            summary: {
              total: 3,
              completed: 1,
              upcoming: 1,
              cancelled: 1,
            },
            appointments: mockAppointments,
          }),
        });
        return;
      }

      // Customer with 0 appointments
      if (url.includes('/api/v1/business-appointments/customers/cust-empty-202/history')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            customer: mockCustomerEmpty,
            summary: { total: 0, completed: 0, upcoming: 0, cancelled: 0 },
            appointments: [],
          }),
        });
        return;
      }

      // Invalid customer ID (404)
      if (url.includes('/api/v1/business-appointments/customers/invalid-id/history')) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Customer not found' }),
        });
        return;
      }

      // Organization isolation failure / 403 Forbidden
      if (url.includes('/api/v1/business-appointments/customers/cust-other-org/history')) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Customer does not belong to this business organization' }),
        });
        return;
      }

      // Default appointments list
      if (url.includes('/api/v1/business-appointments')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(mockAppointments),
        });
        return;
      }

      await route.continue();
    });

    await page.addInitScript(
      ({ tokenVal, userVal }: { tokenVal: string; userVal: any }) => {
        window.localStorage.setItem('token', tokenVal);
        window.localStorage.setItem('access_token', tokenVal);
        window.localStorage.setItem('user', JSON.stringify(userVal));
        window.localStorage.setItem('auth_user', JSON.stringify(userVal));
        window.sessionStorage.setItem('auth_seeded_for', userVal.id);
      },
      { tokenVal: 'mock-valid-jwt.eyJzdWIiOiJ1c2VyLTEifQ.sig', userVal: user },
    );
  };

  test('1. Opening customer history from the Customers page navigates correctly', async ({
    page,
  }) => {
    await setupCustomerHistorySession(page, 'SERVICES');
    await page.goto('/portal/business/customers');

    // Verify customers table loaded
    await expect(page.getByText('Sarah Connor')).toBeVisible();
    await expect(page.getByText('John Doe')).toBeVisible();

    // Click History for Sarah Connor
    const historyBtn = page.locator('[data-testid="customer-history-btn-cust-101"]');
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    // Verify navigation to /portal/business/customers/cust-101/history
    await page.waitForURL('**/portal/business/customers/cust-101/history');
    await expect(page.locator('[data-testid="customer-profile-header"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sarah Connor' })).toBeVisible();
  });

  test('2. Loading the correct customer profile and summary metrics', async ({ page }) => {
    await setupCustomerHistorySession(page, 'SERVICES');
    await page.goto('/portal/business/customers/cust-101/history');

    // Header Details
    await expect(page.getByRole('heading', { name: 'Sarah Connor' })).toBeVisible();
    await expect(page.getByText('sarah.connor@example.com')).toBeVisible();
    await expect(page.getByText('0412 888 999')).toBeVisible();
    await expect(page.locator('[data-testid="back-to-customers-btn"]')).toBeVisible();

    // Summary Metric Cards
    await expect(page.locator('[data-testid="card-total-appointments"]')).toContainText('3');
    await expect(page.locator('[data-testid="card-completed-appointments"]')).toContainText('1');
    await expect(page.locator('[data-testid="card-upcoming-appointments"]')).toContainText('1');
    await expect(page.locator('[data-testid="card-cancelled-appointments"]')).toContainText('1');

    // Table Rows
    const table = page.locator('[data-testid="appointments-history-table"]');
    await expect(table).toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-3"]')).toBeVisible();
  });

  test('3. Correct AUD price display and Online vs Offline booking badges', async ({ page }) => {
    await setupCustomerHistorySession(page, 'SERVICES');
    await page.goto('/portal/business/customers/cust-101/history');

    // Row 1: $189.00 (from 18900 cents) Online
    const row1 = page.locator('[data-testid="appointment-row-appt-hist-1"]');
    await expect(row1.getByText('$189.00')).toBeVisible();
    await expect(row1.getByText('Online')).toBeVisible();

    // Row 2: $249.00 (from 24900 cents) Offline
    const row2 = page.locator('[data-testid="appointment-row-appt-hist-2"]');
    await expect(row2.getByText('$249.00')).toBeVisible();
    await expect(row2.getByText('Offline')).toBeVisible();

    // Row 3: $299.00 (from 29900 cents) Online
    const row3 = page.locator('[data-testid="appointment-row-appt-hist-3"]');
    await expect(row3.getByText('$299.00')).toBeVisible();
  });

  test('4. Appointment Details modal displays complete metadata and closes cleanly', async ({
    page,
  }) => {
    await setupCustomerHistorySession(page, 'SERVICES');
    await page.goto('/portal/business/customers/cust-101/history');

    // Open details for offline appointment #appt-hist-2
    await page.locator('[data-testid="view-details-btn-appt-hist-2"]').click();

    const modal = page.locator('[data-testid="appointment-details-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Emergency Roadside Battery Replacement')).toBeVisible();
    await expect(modal.getByText('Dave Tradie')).toBeVisible();
    await expect(modal.getByText('Offline Work')).toBeVisible();
    await expect(modal.getByText('$249.00')).toBeVisible();
    await expect(modal.getByText('[Offline Booking] Urgent roadside battery drop-in')).toBeVisible();

    // Close modal
    await page.locator('[data-testid="close-appointment-details-btn"]').click();
    await expect(modal).not.toBeVisible();
  });

  test('5. Search and status filters narrow appointment history list', async ({ page }) => {
    await setupCustomerHistorySession(page, 'SERVICES');
    await page.goto('/portal/business/customers/cust-101/history');

    const searchInput = page.locator('[data-testid="search-appointments-input"]');
    const statusSelect = page.locator('[data-testid="filter-status-select"]');

    // Search by service name "Battery"
    await searchInput.fill('Battery');
    await expect(page.locator('[data-testid="appointment-row-appt-hist-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-1"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-3"]')).not.toBeVisible();

    // Clear search and filter by status COMPLETED
    await searchInput.fill('');
    await statusSelect.selectOption('COMPLETED');
    await expect(page.locator('[data-testid="appointment-row-appt-hist-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-2"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-3"]')).not.toBeVisible();

    // Reset filters
    await page.locator('[data-testid="clear-filters-btn"]').click();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="appointment-row-appt-hist-3"]')).toBeVisible();
  });

  test('6. Customer with no appointments displays empty state', async ({ page }) => {
    await setupCustomerHistorySession(page, 'SERVICES');
    await page.goto('/portal/business/customers/cust-empty-202/history');

    await expect(page.getByRole('heading', { name: 'John Doe' })).toBeVisible();
    await expect(page.locator('[data-testid="empty-customer-appointments"]')).toBeVisible();
    await expect(page.getByText('No Appointment History')).toBeVisible();
    await expect(page.locator('[data-testid="card-total-appointments"]')).toContainText('0');
  });

  test('7. Invalid customer ID renders friendly error state with back link', async ({ page }) => {
    await setupCustomerHistorySession(page, 'SERVICES');
    await page.goto('/portal/business/customers/invalid-id/history');

    const errorState = page.locator('[data-testid="customer-not-found-state"]');
    await expect(errorState).toBeVisible();
    await expect(errorState.getByText('Unable to Load Customer')).toBeVisible();
    await expect(errorState.getByRole('link', { name: 'Return to Customers' })).toBeVisible();
  });

  test('8. Organization isolation error displays access denied boundary', async ({ page }) => {
    await setupCustomerHistorySession(page, 'SERVICES');
    await page.goto('/portal/business/customers/cust-other-org/history');

    const errorState = page.locator('[data-testid="customer-not-found-state"]');
    await expect(errorState).toBeVisible();
    await expect(errorState.getByText('Access denied. Customer does not belong to your organization.')).toBeVisible();
  });

  test('9. Mechanics business compatibility on Customer History page', async ({ page }) => {
    await setupCustomerHistorySession(page, 'MECHANICS');
    await page.goto('/portal/business/customers/cust-101/history');

    await expect(page.locator('[data-testid="customer-profile-header"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sarah Connor' })).toBeVisible();
    await expect(page.locator('[data-testid="appointments-history-table"]')).toBeVisible();
  });
});
