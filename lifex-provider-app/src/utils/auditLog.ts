import type { MedplumClient } from '@medplum/core';
import { getReferenceString } from '@medplum/core';
import type { ProjectMembership } from '@medplum/fhirtypes';
import { roleLabel, type RoleValue } from './practitionerRoles';
import type { AuditEvent } from '@medplum/fhirtypes';

export function getAuditEventDetail(event: AuditEvent, type: string): string | undefined {
  return event.entity?.[0]?.detail?.find((d) => d.type === type)?.valueString;
}

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

export const LOCATION_DEACTIVATION_REASONS = [
  { value: 'closed', label: 'Closed / Decommissioned' },
  { value: 'renovation', label: 'Under Renovation' },
  { value: 'duplicate', label: 'Duplicate Entry' },
  { value: 'other', label: 'Other' },
];

export const LOCATION_REACTIVATION_REASONS = [
  { value: 'reopened', label: 'Reopened' },
  { value: 'renovation-complete', label: 'Renovation Complete' },
  { value: 'correction', label: 'Correction (was deactivated in error)' },
  { value: 'other', label: 'Other' },
];

export async function createLocationStatusChangeAuditEvent(
  medplum: MedplumClient,
  locationId: string,
  name: string,
  newStatus: 'active' | 'inactive',
  reasonValue: string,
  notesValue: string
): Promise<void> {
  const currentProfile = medplum.getProfile();
  const reasonLabel =
    (newStatus === 'active' ? LOCATION_REACTIVATION_REASONS : LOCATION_DEACTIVATION_REASONS).find(
      (r) => r.value === reasonValue
    )?.label ?? reasonValue;

  await medplum.createResource({
    resourceType: 'AuditEvent',
    type: {
      system: 'https://lifex-provider.app/fhir/audit-event-type',
      code: 'location-status-change',
      display: 'Location Status Change',
    },
    action: 'U',
    recorded: new Date().toISOString(),
    outcome: '0',
    outcomeDesc: `${newStatus === 'active' ? 'Reactivated' : 'Deactivated'} location "${name}". Reason: ${reasonLabel}.${notesValue ? ` Notes: ${notesValue}` : ''}`,
    agent: currentProfile
      ? [{ who: { reference: getReferenceString(currentProfile) }, requestor: true }]
      : [],
    source: { observer: { display: 'LifeX Provider App' } },
    entity: [
      {
        what: { reference: `Location/${locationId}` },
        name,
        detail: [
          { type: 'reason', valueString: reasonLabel },
          ...(notesValue ? [{ type: 'notes', valueString: notesValue }] : []),
          { type: 'newStatus', valueString: newStatus },
        ],
      },
    ],
  });
}

export const ORG_DEACTIVATION_REASONS = [
  { value: 'closed', label: 'Closed / Ceased Operations' },
  { value: 'merged', label: 'Merged with Another Facility' },
  { value: 'temporary-suspension', label: 'Temporary Suspension' },
  { value: 'duplicate', label: 'Duplicate Entry' },
  { value: 'other', label: 'Other' },
];

export const ORG_REACTIVATION_REASONS = [
  { value: 'reopened', label: 'Reopened' },
  { value: 'suspension-lifted', label: 'Suspension Lifted' },
  { value: 'correction', label: 'Correction (was deactivated in error)' },
  { value: 'other', label: 'Other' },
];

export async function createOrgStatusChangeAuditEvent(
  medplum: MedplumClient,
  organizationId: string,
  name: string,
  newActiveState: boolean,
  reasonValue: string,
  notesValue: string
): Promise<void> {
  const currentProfile = medplum.getProfile();
  const reasonLabel =
    (newActiveState ? ORG_REACTIVATION_REASONS : ORG_DEACTIVATION_REASONS).find((r) => r.value === reasonValue)
      ?.label ?? reasonValue;

  await medplum.createResource({
    resourceType: 'AuditEvent',
    type: {
      system: 'https://lifex-provider.app/fhir/audit-event-type',
      code: 'org-status-change',
      display: 'Organization Status Change',
    },
    action: 'U',
    recorded: new Date().toISOString(),
    outcome: '0',
    outcomeDesc: `${newActiveState ? 'Reactivated' : 'Deactivated'} organization "${name}". Reason: ${reasonLabel}.${notesValue ? ` Notes: ${notesValue}` : ''}`,
    agent: currentProfile
      ? [{ who: { reference: getReferenceString(currentProfile) }, requestor: true }]
      : [],
    source: { observer: { display: 'LifeX Provider App' } },
    entity: [
      {
        what: { reference: `Organization/${organizationId}` },
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

export const DEPARTMENT_CHANGE_REASONS = [
  { value: 'new-assignment', label: 'New Assignment' },
  { value: 'transfer', label: 'Department Transfer' },
  { value: 'cross-coverage', label: 'Cross-coverage / Floating' },
  { value: 'correction', label: 'Correction (was set in error)' },
  { value: 'other', label: 'Other' },
];

export async function createLocationAssignmentAuditEvent(
  medplum: MedplumClient,
  practitionerRef: string,
  name: string,
  previousLocations: string[],
  newLocations: string[],
  reasonValue?: string,
  notesValue?: string
): Promise<void> {
  const currentProfile = medplum.getProfile();
  const previousLabel = previousLocations.length > 0 ? previousLocations.join(', ') : 'None';
  const newLabel = newLocations.length > 0 ? newLocations.join(', ') : 'None';
  const reasonLabel = reasonValue
    ? DEPARTMENT_CHANGE_REASONS.find((r) => r.value === reasonValue)?.label ?? reasonValue
    : undefined;

  await medplum.createResource({
    resourceType: 'AuditEvent',
    type: {
      system: 'https://lifex-provider.app/fhir/audit-event-type',
      code: 'user-department-change',
      display: 'User Department/Unit Assignment Change',
    },
    action: 'U',
    recorded: new Date().toISOString(),
    outcome: '0',
    outcomeDesc: `Changed ${name}'s department/unit assignment from "${previousLabel}" to "${newLabel}".${reasonLabel ? ` Reason: ${reasonLabel}.` : ''}${notesValue ? ` Notes: ${notesValue}` : ''}`,
    agent: currentProfile
      ? [{ who: { reference: getReferenceString(currentProfile) }, requestor: true }]
      : [],
    source: { observer: { display: 'LifeX Provider App' } },
    entity: [
      {
        what: { reference: practitionerRef },
        name,
        detail: [
          { type: 'previousLocations', valueString: previousLabel },
          { type: 'newLocations', valueString: newLabel },
          ...(reasonLabel ? [{ type: 'reason', valueString: reasonLabel }] : []),
          ...(notesValue ? [{ type: 'notes', valueString: notesValue }] : []),
        ],
      },
    ],
  });
}

export async function createStaffInfoChangeAuditEvent(
  medplum: MedplumClient,
  practitionerRef: string,
  name: string,
  changedFields: string[]
): Promise<void> {
  const currentProfile = medplum.getProfile();

  await medplum.createResource({
    resourceType: 'AuditEvent',
    type: {
      system: 'https://lifex-provider.app/fhir/audit-event-type',
      code: 'user-info-change',
      display: 'User Info Change',
    },
    action: 'U',
    recorded: new Date().toISOString(),
    outcome: '0',
    outcomeDesc: `Updated ${name}'s profile info (${changedFields.join(', ')}).`,
    agent: currentProfile
      ? [{ who: { reference: getReferenceString(currentProfile) }, requestor: true }]
      : [],
    source: { observer: { display: 'LifeX Provider App' } },
    entity: [
      {
        what: { reference: practitionerRef },
        name,
        detail: changedFields.map((field) => ({ type: 'changedField', valueString: field })),
      },
    ],
  });
}