import type { MedplumClient } from '@medplum/core';
import type { AccessPolicy, ProjectMembership, Reference } from '@medplum/fhirtypes';
import { createRoleChangeAuditEvent } from './auditLog';
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

/**
 * Applies a role change consistently: syncs the ProjectMembership's AccessPolicy
 * to match the new role(s), then records the audit event. Used by both single-person
 * role editing and bulk role assignment so the two paths can't drift apart.
 *
 * Admin accounts are protected — their AccessPolicy stays pinned to the Hospital
 * Admin policy regardless of role. Removing all roles intentionally leaves the
 * current AccessPolicy untouched (use Deactivate to actually revoke access).
 */
export async function syncAccessPolicyAndLogRoleChange(
  medplum: MedplumClient,
  membership: ProjectMembership | null | undefined,
  practitionerRef: string,
  name: string,
  previousRoles: RoleValue[],
  finalRoles: RoleValue[],
  reason?: string,
  notes?: string
): Promise<void> {
  if (membership?.id) {
    try {
      const newAccessPolicy = membership.admin
        ? await resolveHospitalAdminAccessPolicy(medplum)
        : finalRoles.length > 0
          ? await resolveAccessPolicyForRoles(medplum, finalRoles)
          : undefined;

      if (newAccessPolicy) {
        await medplum.patchResource('ProjectMembership', membership.id, [
          { op: 'add', path: '/accessPolicy', value: newAccessPolicy },
        ]);
      }
    } catch (err) {
      console.error('Failed to sync access policy for', name, err);
    }
  }

  try {
    await createRoleChangeAuditEvent(medplum, practitionerRef, name, previousRoles, finalRoles, reason, notes);
  } catch (err) {
    console.error('Failed to record role-change audit event for', name, err);
  }
}