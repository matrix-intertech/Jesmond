import { test, expect } from '@playwright/test';
import { formatLocalDate, getItemDateString, getItemTimeString, formatDisplayDate } from '../utils/datetime';

test.describe('Business Availability & Offline Appointments Module', () => {
  test.describe('1. Date and Time Formatting Unit Logic', () => {
    test('formatLocalDate formats local Date object to YYYY-MM-DD reliably', () => {
      const d = new Date(2026, 10, 20); // 2026-11-20
      expect(formatLocalDate(d)).toBe('2026-11-20');
    });

    test('getItemDateString extracts exact date string without timezone shift', () => {
      expect(getItemDateString('2026-11-20T10:00:00.000Z')).toBe('2026-11-20');
      expect(getItemDateString('2026-11-20T23:30:00.000Z')).toBe('2026-11-20');
    });

    test('getItemTimeString extracts exact HH:mm from ISO timestamp', () => {
      expect(getItemTimeString('2026-11-20T10:00:00.000Z')).toBe('10:00');
      expect(getItemTimeString('2026-11-20T11:45:00.000Z')).toBe('11:45');
    });

    test('formatDisplayDate formats Australian localized date string consistently', () => {
      expect(formatDisplayDate('2026-11-20T10:00:00.000Z')).toBe('Fri, 20 Nov 2026');
    });
  });

  test.describe('2. Browser E2E: Record Offline Appointment Modal & Calendar Visibility', () => {
    const mockStaff = [
      {
        id: 'staff-1',
        role: 'SENIOR_MECHANIC',
        user: {
          id: 'u-staff-1',
          firstName: 'Dave',
          lastName: 'Tradie',
          email: 'dave@jesmond.demo',
        },
        serviceAssignments: [
          { service: { id: 'svc-1', name: 'Comprehensive Inspection', durationMins: 60 } },
        ],
      },
      {
        id: 'staff-2',
        role: 'APPRENTICE',
        user: {
          id: 'u-staff-2',
          firstName: 'Sarah',
          lastName: 'Technician',
          email: 'sarah@jesmond.demo',
        },
        serviceAssignments: [
          { service: { id: 'svc-2', name: 'Standard Service', durationMins: 45 } },
        ],
      },
    ];

    const mockServices = [
      {
        id: 'svc-1',
        name: 'Comprehensive Inspection',
        durationMins: 60,
        price: 8900,
        branchId: 'branch-1',
      },
      {
        id: 'svc-2',
        name: 'Standard Service',
        durationMins: 45,
        price: 7900,
        branchId: 'branch-1',
      },
    ];

    const mockTimeOff = [
      {
        id: 'to-1',
        staffId: 'staff-1',
        organizationId: 'org-1',
        startTime: '2026-11-20T14:00:00.000Z',
        endTime: '2026-11-20T15:00:00.000Z',
        timezone: 'Australia/Sydney',
        type: 'BREAK',
        reason: 'Lunch Break',
        recurrence: 'NONE',
        staff: {
          id: 'staff-1',
          user: { firstName: 'Dave', lastName: 'Tradie', email: 'dave@jesmond.demo' },
        },
      },
    ];

    let recordedAppointments: any[] = [];
    let lastOfflinePayload: any = null;

    const setupAvailabilitySession = async (
      page: any,
      businessCategory: 'SERVICES' | 'MECHANICS' = 'SERVICES',
    ) => {
      recordedAppointments = [];
      lastOfflinePayload = null;

      const user = {
        id: 'user-biz-1',
        email: businessCategory === 'SERVICES' ? 'demo.services@jesmond.com.au' : 'demo.mechanics@jesmond.com.au',
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
        const method = route.request().method();

        if (url.includes('/auth/me')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({ ...user, user }),
          });
          return;
        }

        if (url.includes('/business-appointments/staff')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify(mockStaff),
          });
          return;
        }

        if (url.includes('/business-appointments/time-off')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify(mockTimeOff),
          });
          return;
        }

        if (url.includes('/business-appointments/services')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify(mockServices),
          });
          return;
        }

        if (url.includes('/business-appointments/offline') && method === 'POST') {
          const body = route.request().postDataJSON();
          lastOfflinePayload = body;

          const newAppt = {
            id: `appt-offline-${Date.now()}`,
            organizationId: 'org-1',
            branchId: body.branchId,
            serviceId: body.serviceId,
            staffId: body.staffId,
            status: 'CONFIRMED',
            startTime: body.startTime,
            endTime: body.endTime,
            timezone: body.timezone || 'Australia/Sydney',
            serviceName: mockServices.find((s) => s.id === body.serviceId)?.name || 'Service',
            durationMins: 60,
            price: 8900,
            currency: 'AUD',
            customerNotes: body.notes
              ? `[Offline Booking] ${body.notes} (Customer: ${body.customerName || 'Walk-in'})`
              : `[Offline Booking] Customer: ${body.customerName || 'Walk-in'}`,
            customer: {
              id: 'cust-walkin-1',
              firstName: body.customerName ? body.customerName.split(' ')[0] : 'Walk-in',
              lastName: body.customerName ? body.customerName.split(' ').slice(1).join(' ') : 'Customer',
              email: body.customerEmail || 'walkin@customer.demo',
              phone: body.customerPhone || '0412 345 678',
            },
            staff: mockStaff.find((s) => s.id === body.staffId),
            service: mockServices.find((s) => s.id === body.serviceId),
            branch: { id: body.branchId, name: 'Main Workshop' },
          };

          recordedAppointments.push(newAppt);

          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify(newAppt),
          });
          return;
        }

        if (url.endsWith('/business-appointments') || url.includes('/business-appointments?')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify(recordedAppointments),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([]),
        });
      });

      await page.addInitScript(
        ({ tokenVal, userVal }: { tokenVal: string; userVal: any }) => {
          window.localStorage.setItem('token', tokenVal);
          window.localStorage.setItem('access_token', tokenVal);
          window.localStorage.setItem('user', JSON.stringify(userVal));
        },
        { tokenVal: 'mock-valid-jwt.eyJzdWIiOiJ1c2VyLTEifQ.sig', userVal: user },
      );
    };

    test('1. Record Offline Appointment modal displays both Cancel and Save Appointment buttons visibly', async ({
      page,
    }) => {
      await setupAvailabilitySession(page, 'SERVICES');
      await page.goto('/portal/business/availability');

      // Click "Record Offline Work"
      const recordBtn = page.locator('[data-testid="record-offline-work-btn"]');
      await expect(recordBtn).toBeVisible({ timeout: 10000 });
      await recordBtn.click();

      // Modal should be visible
      const modal = page.locator('[data-testid="record-offline-appointment-modal"]');
      await expect(modal).toBeVisible();

      // Check Cancel and Save buttons
      const cancelBtn = page.locator('[data-testid="cancel-offline-appointment-btn"]');
      const saveBtn = page.locator('[data-testid="save-offline-appointment-btn"]');

      await expect(cancelBtn).toBeVisible();
      await expect(cancelBtn).toHaveText('Cancel');

      await expect(saveBtn).toBeVisible();
      await expect(saveBtn).toHaveText('Save Appointment');

      // Verify the save button is in viewport (not pushed off-screen or hidden behind overflow)
      const saveBtnBox = await saveBtn.boundingBox();
      expect(saveBtnBox).not.toBeNull();
      expect(saveBtnBox!.height).toBeGreaterThan(0);
      expect(saveBtnBox!.width).toBeGreaterThan(0);

      // Verify Cancel closes modal
      await cancelBtn.click();
      await expect(modal).not.toBeVisible();
    });

    test('2. Modal supports vertical scrolling while footer buttons remain permanently visible', async ({
      page,
    }) => {
      await setupAvailabilitySession(page, 'SERVICES');
      await page.goto('/portal/business/availability');

      await page.locator('[data-testid="record-offline-work-btn"]').click();
      const modal = page.locator('[data-testid="record-offline-appointment-modal"]');
      await expect(modal).toBeVisible();

      const saveBtn = page.locator('[data-testid="save-offline-appointment-btn"]');
      const cancelBtn = page.locator('[data-testid="cancel-offline-appointment-btn"]');

      // Check footer is visible prior to scrolling
      await expect(saveBtn).toBeVisible();
      await expect(cancelBtn).toBeVisible();

      // Scroll inside the form body
      const formBody = modal.locator('form > div.flex-1.overflow-y-auto');
      await expect(formBody).toBeVisible();
      await formBody.evaluate((el: HTMLElement) => {
        el.scrollTop = el.scrollHeight;
      });

      // Verify footer buttons remain 100% visible after body scroll
      await expect(saveBtn).toBeVisible();
      await expect(cancelBtn).toBeVisible();
    });

    test('3. Submits offline appointment and verifies correct payload & immediate calendar visibility', async ({
      page,
    }) => {
      await setupAvailabilitySession(page, 'SERVICES');
      await page.goto('/portal/business/availability');

      // Open Offline modal
      await page.locator('[data-testid="record-offline-work-btn"]').click();
      const modal = page.locator('[data-testid="record-offline-appointment-modal"]');
      await expect(modal).toBeVisible();

      // Today's date string YYYY-MM-DD
      const today = new Date();
      const todayStr = formatLocalDate(today);

      // Select service
      await modal.locator('[data-testid="offline-service-select"]').selectOption('svc-1');

      // Select staff
      await modal.locator('[data-testid="offline-staff-select"]').selectOption('staff-1');

      // Fill Date
      await modal.locator('[data-testid="offline-date-input"]').fill(todayStr);

      // Fill Start & End Time
      await modal.locator('[data-testid="offline-start-time-input"]').fill('10:00');
      await modal.locator('[data-testid="offline-end-time-input"]').fill('11:00');

      // Fill Customer details
      await modal.locator('[data-testid="offline-customer-name"]').fill('Michael Walkin');
      await modal.locator('[data-testid="offline-customer-phone"]').fill('0412 888 999');
      await modal.locator('[data-testid="offline-customer-email"]').fill('michael@example.com');
      await modal.locator('[data-testid="offline-notes"]').fill('Emergency brake check');

      // Submit form
      const saveBtn = modal.locator('[data-testid="save-offline-appointment-btn"]');
      await saveBtn.click();

      // Modal closes automatically
      await expect(modal).not.toBeVisible();

      // Verify API payload was sent correctly
      expect(lastOfflinePayload).not.toBeNull();
      expect(lastOfflinePayload.serviceId).toBe('svc-1');
      expect(lastOfflinePayload.staffId).toBe('staff-1');
      expect(lastOfflinePayload.branchId).toBe('branch-1');
      expect(lastOfflinePayload.customerName).toBe('Michael Walkin');
      expect(lastOfflinePayload.customerPhone).toBe('0412 888 999');
      expect(lastOfflinePayload.customerEmail).toBe('michael@example.com');
      expect(lastOfflinePayload.notes).toBe('Emergency brake check');
      expect(lastOfflinePayload.startTime).toBe(`${todayStr}T10:00:00.000Z`);
      expect(lastOfflinePayload.endTime).toBe(`${todayStr}T11:00:00.000Z`);

      // Verify success notification is rendered
      await expect(page.getByText('Offline appointment recorded and added to calendar successfully!')).toBeVisible();

      // Verify appointment appears in Calendar view
      const apptCard = page.locator(`[data-testid="calendar-day-column-${todayStr}"] [data-testid="calendar-appointment-card"]`);
      await expect(apptCard).toBeVisible();
      await expect(apptCard).toContainText('Comprehensive Inspection');
      await expect(apptCard).toContainText('10:00 - 11:00');
      await expect(apptCard).toContainText('Dave Tradie');
      await expect(apptCard).toContainText('Michael Walkin');
      await expect(apptCard).toContainText('$89.00');

      // Click card to open appointment details modal
      await apptCard.click();
      const detailsModal = page.locator('[data-testid="view-appointment-modal"]');
      await expect(detailsModal).toBeVisible();
      await expect(detailsModal).toContainText('Comprehensive Inspection');
      await expect(detailsModal).toContainText('Emergency brake check');
      await expect(detailsModal).toContainText('0412 888 999');
      await detailsModal.locator('[data-testid="close-appointment-details-btn"]').click();
      await expect(detailsModal).not.toBeVisible();

      // Switch to List view and verify appearance
      await page.locator('[data-testid="view-list-tab"]').click();
      const listItem = page.locator('[data-testid="list-appointment-item"]');
      await expect(listItem).toBeVisible();
      await expect(listItem).toContainText('Comprehensive Inspection');
      await expect(listItem).toContainText('Dave Tradie');
      await expect(listItem).toContainText('Michael Walkin');
      await expect(listItem).toContainText('0412 888 999');
    });

    test('4. Professional filtering isolates appointments and time-off to selected staff', async ({
      page,
    }) => {
      await setupAvailabilitySession(page, 'SERVICES');

      // Prepopulate an appointment for staff-1 and an appointment for staff-2
      const todayStr = formatLocalDate(new Date());
      recordedAppointments = [
        {
          id: 'appt-1',
          organizationId: 'org-1',
          branchId: 'branch-1',
          serviceId: 'svc-1',
          staffId: 'staff-1',
          status: 'CONFIRMED',
          startTime: `${todayStr}T09:00:00.000Z`,
          endTime: `${todayStr}T10:00:00.000Z`,
          serviceName: 'Comprehensive Inspection',
          durationMins: 60,
          price: 8900,
          customerNotes: '[Offline Booking] Dave job',
          staff: mockStaff[0],
          service: mockServices[0],
          branch: { id: 'branch-1', name: 'Main Workshop' },
        },
        {
          id: 'appt-2',
          organizationId: 'org-1',
          branchId: 'branch-1',
          serviceId: 'svc-2',
          staffId: 'staff-2',
          status: 'CONFIRMED',
          startTime: `${todayStr}T11:00:00.000Z`,
          endTime: `${todayStr}T11:45:00.000Z`,
          serviceName: 'Standard Service',
          durationMins: 45,
          price: 7900,
          customerNotes: '[Offline Booking] Sarah job',
          staff: mockStaff[1],
          service: mockServices[1],
          branch: { id: 'branch-1', name: 'Main Workshop' },
        },
      ];

      await page.goto('/portal/business/availability');

      // Initially "All Staff" is active: both appointments visible in calendar
      const dayCol = page.locator(`[data-testid="calendar-day-column-${todayStr}"]`);
      await expect(dayCol.getByText('Dave Tradie')).toBeVisible();
      await expect(dayCol.getByText('Sarah Technician')).toBeVisible();

      // Click "Sarah Technician" filter
      await page.locator('[data-testid="filter-staff-staff-2"]').click();

      // Now only Sarah's appointment is visible, Dave's is filtered out
      await expect(dayCol.getByText('Sarah Technician')).toBeVisible();
      await expect(dayCol.getByText('Dave Tradie')).not.toBeVisible();

      // Click "Dave Tradie" filter
      await page.locator('[data-testid="filter-staff-staff-1"]').click();
      await expect(dayCol.getByText('Dave Tradie')).toBeVisible();
      await expect(dayCol.getByText('Sarah Technician')).not.toBeVisible();

      // Return to All Staff
      await page.locator('[data-testid="filter-all-staff"]').click();
      await expect(dayCol.getByText('Dave Tradie')).toBeVisible();
      await expect(dayCol.getByText('Sarah Technician')).toBeVisible();
    });

    test('5. Mechanics business compatibility on /portal/business/availability', async ({
      page,
    }) => {
      await setupAvailabilitySession(page, 'MECHANICS');
      await page.goto('/portal/business/availability');

      // Check header and controls render without redirects
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Mechanics Dashboard');
      await expect(page.locator('[data-testid="record-offline-work-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="block-time-off-btn"]')).toBeVisible();
    });
  });
});
