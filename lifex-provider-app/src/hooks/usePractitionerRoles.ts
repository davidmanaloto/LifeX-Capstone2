import { useEffect, useState } from 'react';
import { useMedplum, useMedplumProfile } from '@medplum/react';
import type { PractitionerRole } from '@medplum/fhirtypes';
import { getReferenceString } from '@medplum/core';
import { getRoleValues, type RoleValue } from '../utils/practitionerRoles';

interface UsePractitionerRolesResult {
  roles: RoleValue[];
  loading: boolean;
  isDoctor: boolean;
  isNurse: boolean;
}

// Reads the current logged-in user's own PractitionerRole(s) so the UI can
// tailor itself (nav items, tabs) based on their job title(s).
export function usePractitionerRoles(): UsePractitionerRolesResult {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const [roles, setRoles] = useState<RoleValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!profile || profile.resourceType !== 'Practitioner') {
      setRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    medplum
      .searchResources('PractitionerRole', {
        practitioner: getReferenceString(profile),
        _count: 10,
      })
      .then((results: PractitionerRole[]) => {
        if (cancelled) return;
        const found = results.flatMap((r) => getRoleValues(r));
        setRoles(found);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load current user\'s practitioner role', err);
        if (!cancelled) {
          setRoles([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [medplum, profile]);

  return {
    roles,
    loading,
    isDoctor: roles.includes('doctor'),
    isNurse: roles.includes('nurse'),
  };
}