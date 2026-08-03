import type { MedplumClient } from '@medplum/core';
import { getReferenceString } from '@medplum/core';
import type { ProjectMembership } from '@medplum/fhirtypes';
import { roleLabel, type RoleValue } from './practitionerRoles';

const DEACTIVATION_REASONS = [
  { value: 'resigned', label: 'Resigned' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'leave-of-absence', label: 'Leave of Absence' },
  { value: 'policy-violation', label: 'Policy Violation' },
  { value: 'other', label: 'Other' },
];

const REACTIVATION_REASONS = [
  { value: 'returned', label: 'Returned from Leave' },
  { value: 'rehired', label: 'Rehired' },
  { value: 'correction', label: 'Correction (was deactivated in error)' },
  { value: 'other', label: 'Other' },
];

export { DEACTIVATION_REASONS, REACTIVATION_REASONS };

export async function createStatusChangeAuditEvent(
  medplum: MedplumClient,
  membership: ProjectMembership,
  name: string,
  newActiveState: boolean,
  reasonValue: string,
  notesValue: string
): Promise<void> {
  const currentProfile = medplum.getProfile();
  const reasonLabel =
    (newActiveState ? REACTIVATION_REASONS : DEACTIVATION_REASONS).find((r) => r.value === reasonValue)?.label ??
    reasonValue;

  await medplum.createResource({
    resourceType: 'AuditEvent',
    type: {
      system: 'https://lifex-provider.app/fhir/audit-event-type',
      code: 'user-status-change',
      display: 'User Status Change',
    },
    action: 'U',
    recorded: new Date().toISOString(),
    outcome: '0',
    outcomeDesc: `${newActiveState ? 'Reactivated' : 'Deactivated'} ${name}. Reason: ${reasonLabel}.${notesValue ? ` Notes: ${notesValue}` : ''}`,
    agent: currentProfile
      ? [{ who: { reference: getReferenceString(currentProfile) }, requestor: true }]
      : [],
    source: { observer: { display: 'LifeX Provider App' } },
    entity: [
      {
        what: membership.id ? { reference: `ProjectMembership/${membership.id}` } : undefined,
        name,
        detail: [
          { type: 'reason', valueString: reasonLabel },
          ...(notesValue ? [{ type: 'notes', valueString: notesValue }] : []),
          { type: 'newStatus', valueString: newActiveState ? 'active' : 'inactive' },
        ],
      },
    ],
  });
}

export const ROLE_CHANGE_REASONS = [
  { value: 'promotion', label: 'Promotion / New Responsibility' },
  { value: 'reassignment', label: 'Department Reassignment' },
  { value: 'cross-training', label: 'Cross-training' },
  { value: 'correction', label: 'Correction (was set in error)' },
  { value: 'other', label: 'Other' },
];

export async function createRoleChangeAuditEvent(
  medplum: MedplumClient,
  practitionerRef: string,
  name: string,
  previousRoles: RoleValue[],
  newRoles: RoleValue[],
  reasonValue?: string,
  notesValue?: string
): Promise<void> {
  const currentProfile = medplum.getProfile();
  const previousLabel = previousRoles.length > 0 ? previousRoles.map(roleLabel).join(', ') : 'None (initial assignment)';
  const newLabel = newRoles.length > 0 ? newRoles.map(roleLabel).join(', ') : 'None';
  const reasonLabel = reasonValue
    ? ROLE_CHANGE_REASONS.find((r) => r.value === reasonValue)?.label ?? reasonValue
    : undefined;

  await medplum.createResource({
    resourceType: 'AuditEvent',
    type: {
      system: 'https://lifex-provider.app/fhir/audit-event-type',
      code: 'user-role-change',
      display: 'User Role Change',
    },
    action: 'U',
    recorded: new Date().toISOString(),
    outcome: '0',
    outcomeDesc: `Changed ${name}'s role(s) from "${previousLabel}" to "${newLabel}".${reasonLabel ? ` Reason: ${reasonLabel}.` : ''}${notesValue ? ` Notes: ${notesValue}` : ''}`,
    agent: currentProfile
      ? [{ who: { reference: getReferenceString(currentProfile) }, requestor: true }]
      : [],
    source: { observer: { display: 'LifeX Provider App' } },
    entity: [
      {
        what: { reference: practitionerRef },
        name,
        detail: [
          { type: 'previousRoles', valueString: previousLabel },
          { type: 'newRoles', valueString: newLabel },
          ...(reasonLabel ? [{ type: 'reason', valueString: reasonLabel }] : []),
          ...(notesValue ? [{ type: 'notes', valueString: notesValue }] : []),
        ],
      },
    ],
  });
}