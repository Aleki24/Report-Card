/** A school waiting for the platform owner, as /api/platform/schools lists it. Client-safe. */
export interface PendingSchool {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  requestedAt: string | null;
  requester: { name: string; email: string | null; phone: string | null } | null;
  /** The owner's single-use decision links (they open a confirmation page). */
  approveUrl: string;
  rejectUrl: string;
}

export const PENDING_SCHOOLS_URL = '/api/platform/schools';
