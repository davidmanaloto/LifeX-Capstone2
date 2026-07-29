import { useCallback, useEffect, useState } from 'react';
import { useMedplum } from '@medplum/react';
import type { Organization } from '@medplum/fhirtypes';

interface UseOrganizationsResult {
  organizations: Organization[];
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Fetches all Organization resources in the current project.
 * Most single-hospital deployments will only ever have one —
 * this hook just gives you the list so the UI can decide
 * whether to auto-select, show a dropdown, or prompt for setup.
 */
export function useOrganizations(): UseOrganizationsResult {
  const medplum = useMedplum();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    const results = await medplum.searchResources('Organization');
    setOrganizations(results);
    setLoading(false);
  }, [medplum]);

  useEffect(() => {
    reload().catch((err) => {
      console.error('Failed to load organizations', err);
      setLoading(false);
    });
  }, [reload]);

  return { organizations, loading, reload };
}