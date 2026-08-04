import { useCallback, useEffect, useState } from 'react';
import { useMedplum } from '@medplum/react';
import type { Location } from '@medplum/fhirtypes';

interface UseLocationsResult {
  locations: Location[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useLocations(): UseLocationsResult {
  const medplum = useMedplum();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    const results = await medplum.searchResources('Location', { _count: 100 });
    setLocations(results);
    setLoading(false);
  }, [medplum]);

  useEffect(() => {
    reload().catch((err) => {
      console.error('Failed to load locations', err);
      setLoading(false);
    });
  }, [reload]);

  return { locations, loading, reload };
}