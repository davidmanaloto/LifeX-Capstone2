import { useCallback, useEffect, useState } from 'react';
import { useMedplum } from '@medplum/react';
import type { Appointment } from '@medplum/fhirtypes';

interface UseAppointmentsResult {
  appointments: Appointment[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useAppointments(): UseAppointmentsResult {
  const medplum = useMedplum();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    const results = await medplum.searchResources('Appointment', {
      _count: 100,
      _sort: '-date',
    });
    setAppointments(results);
    setLoading(false);
  }, [medplum]);

  useEffect(() => {
    reload().catch((err) => {
      console.error('Failed to load appointments', err);
      setLoading(false);
    });
  }, [reload]);

  return { appointments, loading, reload };
}