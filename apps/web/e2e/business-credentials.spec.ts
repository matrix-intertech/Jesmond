import { test, expect } from '@playwright/test';
import * as http from 'http';

test.describe('Business Credentials & Verification System (e2e)', () => {
  let mockApiServer: http.Server | null = null;

  test.beforeAll(async () => {
    try {
      mockApiServer = http.createServer((req, res) => {
        const reqOrigin = req.headers.origin || 'http://localhost:3005';
        res.setHeader('Access-Control-Allow-Origin', reqOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Organization-Id, Cache-Control, Pragma');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.url?.includes('/retail/marketplace/stores/branch-mech-1/catalog')) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              branch: {
                id: 'branch-mech-1',
                name: 'Newcastle Auto Care Main',
                isActive: true,
                address: '100 Workshop Way, Newcastle NSW 2300',
                phone: '02 4900 1122',
                organization: {
                  name: 'Newcastle Auto Care',
                  businessCategory: 'MECHANICS',
                  profileCompletion: {
                    overallStatus: 'VERIFIED',
                  },
                  credentials: [
                    {
                      id: 'cred-mvrl-1',
                      credentialNumber: 'MVRL98765',
                      credentialType: {
                        name: 'Motor Vehicle Repairer Licence',
                        code: 'NSW_MVRL',
                      },
                    },
                  ],
                },
              },
              catalog: [],
            }),
          );
          return;
        }

        if (req.url?.includes('/appointments/services')) {
          res.writeHead(200);
          res.end(JSON.stringify([]));
          return;
        }

        res.writeHead(200);
        res.end(JSON.stringify([]));
      });

      await new Promise<void>((resolve) => {
        mockApiServer?.listen(3001, () => resolve());
        mockApiServer?.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            resolve();
          } else {
            resolve();
          }
        });
      });
    } catch {
      // Ignored if cannot bind
    }
  });

  test.afterAll(async () => {
    if (mockApiServer) {
      await new Promise<void>((resolve) => {
        mockApiServer?.close(() => resolve());
      });
    }
  });

  const corsHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
  };

  const mechanicsRequirements = {
    organizationId: 'org-mechanics-1',
    organizationName: 'Newcastle Auto Care',
    businessCategory: 'MECHANICS',
    state: 'NSW',
    branchAddress: '100 Workshop Way, Newcastle NSW 2300',
    selectedServices: ['Logbook Servicing', 'Brake Repairs', 'Air Conditioning Service'],
    abn: null,
    abnStatus: 'NOT_PROVIDED',
    abnExemptionReason: null,
    overallStatus: 'NOT_SUBMITTED',
    isCompleted: false,
    dismissedUntil: null,
    requirements: [
      {
        credentialTypeId: 'type-mvrl',
        credentialCode: 'NSW_MVRL',
        name: 'Motor Vehicle Repairer Licence',
        description: 'NSW Fair Trading statutory business licence for mechanical repairs.',
        isMandatory: true,
        requiresDocument: true,
        legalBasis: 'Motor Dealers and Repairers Act 2013 (NSW)',
        verificationAuthority: 'NSW Fair Trading',
        authorityUrl: 'https://verify.licence.nsw.gov.au',
        currentCredential: {
          id: 'cred-mvrl-1',
          status: 'DRAFT',
          licenceNumber: 'MVRL98765',
          licenceName: 'Motor Vehicle Repairer Licence',
          expiresAt: '2028-12-31T00:00:00.000Z',
          rejectionReason: null,
          reviewerNotes: null,
          documents: [
            {
              id: 'doc-mvrl-1',
              filename: 'mvrl_license_certificate.pdf',
              mimeType: 'application/pdf',
              size: 245760,
              createdAt: '2026-11-20T10:00:00.000Z',
            },
          ],
        },
        isSatisfied: true,
      },
    ],
  };

  const setupMechanicsSession = async (page: any, overrides: Partial<typeof mechanicsRequirements> = {}) => {
    let currentRequirements = { ...mechanicsRequirements, ...overrides };

    await page.route(/\/api\/v1\//, async (route: any) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      const url = route.request().url();
      const method = route.request().method();

      // Auth mock
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            id: 'usr-mechanic-1',
            email: 'mechanic@newcastle.demo',
            role: 'ORG_STAFF',
            organizationId: 'org-mechanics-1',
            orgType: 'RETAIL',
            businessCategory: 'MECHANICS',
            orgRole: 'ADMIN',
            permissions: ['*'],
            accountStatus: 'ACTIVE',
            user: {
              id: 'usr-mechanic-1',
              email: 'mechanic@newcastle.demo',
              role: 'ORG_STAFF',
              organizationId: 'org-mechanics-1',
              orgType: 'RETAIL',
              businessCategory: 'MECHANICS',
              orgRole: 'ADMIN',
              permissions: ['*'],
              accountStatus: 'ACTIVE',
            },
          }),
        });
        return;
      }

      // Settings Profile mock for profile completion banner
      if (url.includes('/settings/profile')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            profileCompletion: { isComplete: true, missingFields: [] },
          }),
        });
        return;
      }

      // Requirements mock
      if (url.includes('/business/credentials/requirements')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(currentRequirements),
        });
        return;
      }

      // ABN Verify mock
      if (url.includes('/business/credentials/verify-abn')) {
        currentRequirements.abn = '51824753556';
        currentRequirements.abnStatus = 'VERIFIED';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            abn: '51824753556',
            entityName: 'NEWCASTLE AUTO PTY LTD',
            entityTypeCode: 'PRV',
            status: 'Active',
            gstRegistered: true,
            verified: true,
          }),
        });
        return;
      }

      // ABN Exemption mock
      if (url.includes('/business/credentials/abn-exemption/request')) {
        currentRequirements.abnStatus = 'EXEMPTION_PENDING';
        currentRequirements.abnExemptionReason = 'Hobby repair club';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            organizationId: 'org-mechanics-1',
            abnExemptionStatus: 'PENDING_REVIEW',
            abnExemptionReason: 'Hobby repair club',
          }),
        });
        return;
      }

      // Save draft mock
      if (method === 'PUT' && url.includes('/business/credentials/')) {
        const postData = route.request().postDataJSON();
        currentRequirements.requirements[0].currentCredential.licenceNumber = postData.licenceNumber;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            id: 'cred-mvrl-1',
            licenceNumber: postData.licenceNumber,
            status: 'DRAFT',
          }),
        });
        return;
      }

      // Submit credentials mock
      if (url.includes('/business/credentials/submit')) {
        currentRequirements.overallStatus = 'PARTIALLY_VERIFIED';
        currentRequirements.requirements[0].currentCredential.status = 'PENDING_REVIEW';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            organizationId: 'org-mechanics-1',
            submittedCount: 1,
            overallStatus: 'PARTIALLY_VERIFIED',
          }),
        });
        return;
      }

      // 14-day Dismissal mock
      if (url.includes('/business/credentials/completion/dismiss')) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 14);
        currentRequirements.dismissedUntil = futureDate.toISOString();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            organizationId: 'org-mechanics-1',
            dismissedUntil: futureDate.toISOString(),
          }),
        });
        return;
      }

      // Signed document URL mock
      if (url.includes('/documents/') && url.includes('/signed-url')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            signedUrl: 'https://cdn.jesmond.demo/credentials/preview-sample.pdf?token=exp900',
            expiresIn: 900,
          }),
        });
        return;
      }

      if (url.includes('/business-appointments')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([]),
        });
        return;
      }

      if (url.includes('/notifications')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ unreadCount: 0, notifications: [] }),
        });
        return;
      }

      // Safe fallback for any other API routes
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(() => {
      const token = 'mock_jwt_token_mechanic';
      const user = {
        id: 'usr-mechanic-1',
        email: 'mechanic@newcastle.demo',
        role: 'ORG_STAFF',
        organizationId: 'org-mechanics-1',
        businessCategory: 'MECHANICS',
        orgType: 'RETAIL',
        orgRole: 'ADMIN',
        permissions: ['*'],
        accountStatus: 'ACTIVE',
      };
      localStorage.setItem('auth_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('current_user', JSON.stringify(user));
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('access_token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      document.cookie = `access_token=${token}; path=/`;
    });
  };

  test('1. Non-blocking organization completion popup appears for unverified businesses', async ({
    page,
  }) => {
    await setupMechanicsSession(page);
    await page.goto('/portal/business/appointments');

    // Wait for the popup modal to appear
    const modal = page.locator('[data-testid="business-verification-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await expect(modal).toContainText('Complete Your Business Profile');
    await expect(modal).toContainText('Newcastle Auto Care');
    await expect(modal).toContainText('Motor Vehicle Repairer Licence');

    // Header reminder pill is also present
    const headerPill = page.locator('[data-testid="header-verification-pill"]');
    await expect(headerPill).toBeVisible();
    await expect(headerPill).toContainText('Verification Incomplete');
  });

  test('2. 14-Day dismissal persists and suppresses popup across page reloads', async ({
    page,
  }) => {
    await setupMechanicsSession(page);
    await page.goto('/portal/business/appointments');

    const modal = page.locator('[data-testid="business-verification-modal"]');
    await expect(modal).toBeVisible();

    // Click "Maybe Later (14 days)"
    const dismissBtn = page.locator('[data-testid="business-verification-dismiss-btn"]');
    await dismissBtn.click();

    // Modal disappears immediately
    await expect(modal).not.toBeVisible();

    // Reload page: modal stays hidden
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(modal).not.toBeVisible();

    // But header reminder pill remains visible to allow voluntary completion
    const headerPill = page.locator('[data-testid="header-verification-pill"]');
    await expect(headerPill).toBeVisible();
  });

  test('3. Progressive credential form, ABN verification, and draft auto-saving', async ({
    page,
  }) => {
    await setupMechanicsSession(page);
    await page.goto('/portal/business/verification');

    // Step 1: Business Identity & ABN
    await expect(page.locator('h1')).toContainText('Business Credentials & Verification');
    await expect(page.locator('[data-testid="abn-input"]')).toBeVisible();

    // Enter valid Modulus 89 ABN and verify
    await page.locator('[data-testid="abn-input"]').fill('51 824 753 556');
    await page.locator('[data-testid="verify-abn-btn"]').click();

    // Success banner appears
    await expect(page.locator('text=NEWCASTLE AUTO PTY LTD')).toBeVisible({ timeout: 5000 });

    // Navigate to Step 2
    await page.locator('[data-testid="next-step-btn"]').click();
    await expect(page.locator('text=Active Category Services')).toBeVisible();
    await expect(page.locator('text=Logbook Servicing')).toBeVisible();

    // Navigate to Step 3: Applicable Licences
    await page.locator('[data-testid="next-step-btn"]').click();
    const licenceInput = page.locator('[data-testid="licence-number-NSW_MVRL"]');
    await expect(licenceInput).toBeVisible();
    expect(await licenceInput.inputValue()).toBe('MVRL98765');

    // Edit licence number to test draft save
    await licenceInput.fill('MVRL112233');
    await licenceInput.blur();

    // Navigate to Step 4: Documents
    await page.locator('[data-testid="next-step-btn"]').click();
    await expect(page.locator('text=Private Supporting Documents')).toBeVisible();
    await expect(page.locator('text=mvrl_license_certificate.pdf')).toBeVisible();

    // Navigate to Step 5: Review & Submit
    await page.locator('[data-testid="next-step-btn"]').click();
    await expect(page.getByRole('heading', { name: 'Step 5: Review & Submit' })).toBeVisible();

    const submitBtn = page.locator('[data-testid="submit-credentials-btn"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await expect(page.locator('text=Credentials successfully submitted for compliance review!')).toBeVisible({
      timeout: 5000,
    });
  });

  test('4. Admin review queue and decision actions', async ({ page }) => {
    // Admin session mock
    await page.route(/\/api\/v1\//, async (route: any) => {
      const url = route.request().url();
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            id: 'admin-1',
            email: 'admin@jesmond.com',
            role: 'ADMIN',
            accountStatus: 'ACTIVE',
          }),
        });
        return;
      }

      if (url.includes('/admin/credentials/queue')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            data: [
              {
                id: 'cred-mvrl-1',
                credentialNumber: 'MVRL98765',
                state: 'NSW',
                status: 'PENDING_REVIEW',
                organization: {
                  id: 'org-mechanics-1',
                  name: 'Newcastle Auto Care',
                  abn: '51824753556',
                  businessCategory: 'MECHANICS',
                },
                credentialType: {
                  code: 'NSW_MVRL',
                  name: 'Motor Vehicle Repairer Licence',
                },
                documents: [
                  {
                    id: 'doc-1',
                    filename: 'mvrl_license.pdf',
                  },
                ],
              },
            ],
            meta: { total: 1, page: 1, totalPages: 1 },
          }),
        });
        return;
      }

      if (url.includes('/admin/credentials/cred-mvrl-1/review')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            id: 'cred-mvrl-1',
            status: 'VERIFIED',
          }),
        });
        return;
      }

      if (url.includes('/notifications')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ unreadCount: 0, notifications: [] }),
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

    await page.addInitScript(() => {
      const token = 'mock_admin_token';
      const user = {
        id: 'admin-1',
        email: 'admin@jesmond.com',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      };
      localStorage.setItem('auth_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('current_user', JSON.stringify(user));
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('access_token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      document.cookie = `access_token=${token}; path=/`;
    });

    await page.goto('/admin/credentials');
    await expect(page.locator('h1')).toContainText('Business Credentials Compliance Queue');
    await expect(page.locator('text=Newcastle Auto Care')).toBeVisible();

    // Open review modal
    await page.locator('[data-testid="review-btn-cred-mvrl-1"]').click();
    await expect(page.locator('text=Review Credential Submission')).toBeVisible();

    // Fill reviewer notes and click approve
    await page.locator('[data-testid="reviewer-notes-input"]').fill('Confirmed on NSW Fair Trading register.');
    await page.locator('[data-testid="decision-verify-btn"]').click();

    await expect(page.locator('text=Credential successfully updated to VERIFIED.')).toBeVisible({
      timeout: 5000,
    });
  });

  test('5. Public storefront verified partner badge and licence chips visibility', async ({
    page,
  }) => {
    // Mock public catalog endpoint
    await page.route(/\/api\/v1\/retail\/marketplace\/stores\/branch-mech-1\/catalog/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          branch: {
            id: 'branch-mech-1',
            name: 'Newcastle Auto Care Main',
            isActive: true,
            address: '100 Workshop Way, Newcastle NSW 2300',
            phone: '02 4900 1122',
            organization: {
              name: 'Newcastle Auto Care',
              businessCategory: 'MECHANICS',
              profileCompletion: {
                overallStatus: 'VERIFIED',
              },
              credentials: [
                {
                  id: 'cred-mvrl-1',
                  credentialNumber: 'MVRL98765',
                  credentialType: {
                    name: 'Motor Vehicle Repairer Licence',
                    code: 'NSW_MVRL',
                  },
                },
              ],
            },
          },
          catalog: [],
        }),
      });
    });

    await page.goto('/businesses/store/branch-mech-1');

    // Verified Partner badge is visible
    const badge = page.locator('[data-testid="public-verified-partner-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Verified Partner');

    // Verified licence chip is visible
    const licenceChip = page.locator('[data-testid="public-verified-licence-NSW_MVRL"]');
    await expect(licenceChip).toBeVisible();
    await expect(licenceChip).toContainText('Motor Vehicle Repairer Licence: MVRL98765');
  });
});
