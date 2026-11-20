import { getApiUrl } from "@/utils/api";

export interface NameRequestDocumentDto {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export interface NameRequestItemDto {
  id: string;
  organizationId: string;
  requestedByUserId: string;
  currentName: string;
  proposedName: string;
  reason: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  reviewerNotes: string | null;
  internalNotes: string | null;
  reviewedByUserId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    type: string;
    businessCategory: string;
    abn: string | null;
  };
  requestedByUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  reviewedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  documents: NameRequestDocumentDto[];
}

export interface NameRequestsStatsDto {
  total: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface NameRequestsQueueResponseDto {
  items: NameRequestItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: NameRequestsStatsDto;
}

export async function getAdminNameRequestsQueue(
  token: string,
  query: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<NameRequestsQueueResponseDto> {
  const params = new URLSearchParams();
  if (query.status && query.status !== "ALL") params.append("status", query.status);
  if (query.search) params.append("search", query.search);
  if (query.page) params.append("page", String(query.page));
  if (query.limit) params.append("limit", String(query.limit));

  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/name-change-requests?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to load name change requests queue");
  }

  return res.json();
}

export async function getAdminNameRequestDetails(
  token: string,
  id: string
): Promise<NameRequestItemDto> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/name-change-requests/${id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to load request details");
  }

  return res.json();
}

export async function startAdminNameRequestReview(
  token: string,
  id: string
): Promise<NameRequestItemDto> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/name-change-requests/${id}/start-review`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to move request to under review");
  }

  return res.json();
}

export async function approveAdminNameRequest(
  token: string,
  id: string,
  dto: { reviewerNotes?: string; internalNotes?: string }
): Promise<NameRequestItemDto> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/name-change-requests/${id}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to approve name change request");
  }

  return res.json();
}

export async function rejectAdminNameRequest(
  token: string,
  id: string,
  dto: { reviewerNotes: string; internalNotes?: string }
): Promise<NameRequestItemDto> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/name-change-requests/${id}/reject`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to reject name change request");
  }

  return res.json();
}

export async function getAdminNameRequestSignedDocumentUrl(
  token: string,
  requestId: string,
  documentId: string
): Promise<{ signedUrl: string; expiresIn: number }> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/admin/name-change-requests/${requestId}/documents/${documentId}/signed-url`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to generate signed document URL");
  }

  return res.json();
}
