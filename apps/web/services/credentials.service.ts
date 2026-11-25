import { getApiUrl } from "@/utils/api";
import { getCurrentUser, getSelectedOrganizationId } from "@/utils/auth";

function buildCredentialHeaders(
  token?: string | null,
  includeJson = false,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const orgId = getSelectedOrganizationId() || getCurrentUser()?.organizationId;
  if (orgId) {
    headers["X-Organization-Id"] = orgId;
  }
  return headers;
}

export interface CredentialDocumentDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface CredentialRequirementDto {
  credentialTypeId: string;
  credentialCode: string;
  name: string;
  description: string;
  isMandatory: boolean;
  requiresDocument: boolean;
  legalBasis: string;
  verificationAuthority: string;
  authorityUrl: string;
  currentCredential: {
    id: string;
    status: string;
    licenceNumber: string | null;
    licenceName: string | null;
    expiresAt: string | null;
    rejectionReason: string | null;
    reviewerNotes: string | null;
    documents: CredentialDocumentDto[];
  } | null;
  isSatisfied: boolean;
}

export interface RequirementsResponseDto {
  organizationId: string;
  organizationName: string;
  businessCategory: string;
  state: string;
  branchAddress: string | null;
  selectedServices: string[];
  abn: string | null;
  abnStatus: string;
  abnExemptionReason: string | null;
  overallStatus: string;
  isCompleted: boolean;
  dismissedUntil: string | null;
  requirements: CredentialRequirementDto[];
}

export async function getCredentialsRequirements(
  token?: string | null,
): Promise<RequirementsResponseDto> {
  const base = token ? getApiUrl() : "";
  const res = await fetch(`${base}/api/v1/business/credentials/requirements`, {
    headers: buildCredentialHeaders(token),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to load credential requirements");
  }
  return res.json();
}

export async function verifyAbn(
  token: string,
  abn: string,
): Promise<{
  success: boolean;
  abn: string;
  entityName: string;
  entityTypeCode: string;
  status: string;
  gstRegistered: boolean;
  verified: boolean;
}> {
  const res = await fetch(`${getApiUrl()}/api/v1/business/credentials/verify-abn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ abn }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to verify ABN");
  }
  return res.json();
}

export async function requestAbnExemption(
  token: string,
  reason: string,
): Promise<any> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/business/credentials/abn-exemption/request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to submit ABN exemption request");
  }
  return res.json();
}

export async function saveCredentialDraft(
  token: string,
  code: string,
  data: {
    licenceNumber?: string;
    licenceName?: string;
    holderName?: string;
    issuer?: string;
    state?: string;
    expiresAt?: string | null;
  },
): Promise<any> {
  const res = await fetch(`${getApiUrl()}/api/v1/business/credentials/${code}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to save credential draft");
  }
  return res.json();
}

export async function uploadCredentialDocument(
  token: string,
  credentialId: string,
  file: File,
): Promise<CredentialDocumentDto> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${getApiUrl()}/api/v1/business/credentials/${credentialId}/documents`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to upload document");
  }
  return res.json();
}

export async function getDocumentSignedUrl(
  token: string,
  credentialId: string,
  docId: string,
): Promise<{ signedUrl: string; expiresIn: number }> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/business/credentials/${credentialId}/documents/${docId}/signed-url`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to fetch secure document link");
  }
  return res.json();
}

export async function submitCredentials(token: string): Promise<any> {
  const res = await fetch(`${getApiUrl()}/api/v1/business/credentials/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to submit credentials for review");
  }
  return res.json();
}

export async function dismissCompletionReminder(token?: string | null): Promise<any> {
  const base = token ? getApiUrl() : "";
  const res = await fetch(
    `${base}/api/v1/business/credentials/completion/dismiss`,
    {
      method: "POST",
      headers: buildCredentialHeaders(token, true),
      credentials: "include",
      body: JSON.stringify({}),
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to dismiss reminder");
  }
  return res.json();
}

// Admin API methods
export async function getAdminCredentialsQueue(
  token: string,
  params: {
    status?: string;
    category?: string;
    state?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ data: any[]; meta: any }> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "ALL") query.append("status", params.status);
  if (params.category && params.category !== "ALL") query.append("category", params.category);
  if (params.state && params.state !== "ALL") query.append("state", params.state);
  if (params.page) query.append("page", params.page.toString());
  if (params.limit) query.append("limit", params.limit.toString());

  const res = await fetch(`${getApiUrl()}/api/v1/admin/credentials/queue?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to load admin verification queue");
  }
  return res.json();
}

export async function getAdminAbnExemptionQueue(
  token: string,
  params: { page?: number; limit?: number } = {},
): Promise<{ data: any[]; meta: any }> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", params.page.toString());
  if (params.limit) query.append("limit", params.limit.toString());

  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/credentials/abn-exemptions?${query.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to load ABN exemption queue");
  }
  return res.json();
}

export async function reviewAdminCredential(
  token: string,
  credentialId: string,
  data: {
    decision: "VERIFIED" | "REJECTED" | "NEEDS_INFORMATION" | "UNABLE_TO_VERIFY";
    notes?: string;
    internalNotes?: string;
  },
): Promise<any> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/credentials/${credentialId}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to submit review decision");
  }
  return res.json();
}

export async function reviewAdminAbnExemption(
  token: string,
  orgId: string,
  data: {
    decision: "APPROVED" | "REJECTED";
    notes?: string;
    internalNotes?: string;
  },
): Promise<any> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/credentials/abn-exemptions/${orgId}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to review ABN exemption");
  }
  return res.json();
}

export async function getAdminSignedDocumentUrl(
  token: string,
  credentialId: string,
  docId: string,
): Promise<{ signedUrl: string; expiresIn: number }> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/credentials/${credentialId}/documents/${docId}/signed-url`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to fetch admin document URL");
  }
  return res.json();
}
