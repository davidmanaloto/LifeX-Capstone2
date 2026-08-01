import type { MedplumClient } from '@medplum/core';
import type { Reference, AccessPolicy } from '@medplum/fhirtypes';
import type { RoleValue } from './practitionerRoles';

// Maps each role to the AccessPolicy resource name (as created in Medplum).
// If someone is assigned multiple roles, the FIRST match in this priority
// order wins — broadest/most-privileged role determines their access.
const ROLE_POLICY_PRIORITY: { role: RoleValue; policyName: string }[] = [
  { role: 'doctor', policyName: 'Doctor Access Policy' },
  { role: 'nurse', policyName: 'Nurse Access Policy' },
  { role: 'receptionist', policyName: 'Receptionist Access Policy' },
];

export async function resolveAccessPolicyForRoles(
  medplum: MedplumClient,
  roles: RoleValue[]
): Promise<Reference<AccessPolicy> | undefined> {
  const matched = ROLE_POLICY_PRIORITY.find((p) => roles.includes(p.role));
  if (!matched) {
    return undefined;
  }

  const results = await medplum.searchResources('AccessPolicy', { name: matched.policyName, _count: 1 });
  const policy = results[0];
  if (!policy?.id) {
    console.warn(`AccessPolicy "${matched.policyName}" not found — invited user will have no access restrictions.`);
    return undefined;
  }
  return { reference: `AccessPolicy/${policy.id}` };
}

export async function resolveHospitalAdminAccessPolicy(
  medplum: MedplumClient
): Promise<Reference<AccessPolicy> | undefined> {
  const results = await medplum.searchResources('AccessPolicy', { name: 'Hospital Admin Access Policy', _count: 1 });
  const policy = results[0];
  return policy?.id ? { reference: `AccessPolicy/${policy.id}` } : undefined;
}