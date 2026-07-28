import { useMedplum } from '@medplum/react';

/**
 * Returns true if the currently logged-in user is a project admin.
 * Use this to gate any admin-only page or UI element.
 */
export function useAdminAccess(): boolean {
  const medplum = useMedplum();
  const membership = medplum.getProjectMembership();
  return Boolean(membership?.admin);
}