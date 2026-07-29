import type { CodeableConcept, PractitionerRole } from '@medplum/fhirtypes';

export const PRACTITIONER_ROLE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/practitioner-role';

export type RoleValue = 'doctor' | 'nurse' | 'pharmacist' | 'researcher' | 'ict' | 'receptionist';

export const ROLES_WITH_SPECIALTY = new Set<RoleValue>(['doctor', 'nurse']);

export interface RoleOption {
  value: RoleValue;
  label: string;
  color: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { value: 'doctor', label: 'Doctor', color: 'blue' },
  { value: 'nurse', label: 'Nurse', color: 'teal' },
  { value: 'pharmacist', label: 'Pharmacist', color: 'green' },
  { value: 'researcher', label: 'Researcher', color: 'purple' },
  { value: 'ict', label: 'ICT', color: 'red' },
  { value: 'receptionist', label: 'Receptionist', color: 'orange' },
];

export function roleLabel(value: RoleValue): string {
  return ROLE_OPTIONS.find((r) => r.value === value)?.label ?? value;
}

export function roleColor(value: RoleValue): string {
  return ROLE_OPTIONS.find((r) => r.value === value)?.color ?? 'gray';
}

// The real HL7 practitioner-role code system includes: doctor, nurse,
// pharmacist, researcher, teacher, ict. "Receptionist" genuinely isn't
// in it, so that one alone stays text-only.
const HL7_CODED_ROLES = new Set<RoleValue>(['doctor', 'nurse', 'pharmacist', 'researcher', 'ict']);

function roleValueToConcept(value: RoleValue): CodeableConcept {
  const label = ROLE_OPTIONS.find((r) => r.value === value)?.label ?? value;
  if (HL7_CODED_ROLES.has(value)) {
    return {
      coding: [{ system: PRACTITIONER_ROLE_SYSTEM, code: value, display: label }],
      text: label,
    };
  }
  // Receptionist isn't in the HL7 practitioner-role value set, so store as text only.
  return { text: label };
}

// Builds the full `code` array for a PractitionerRole from one or more selected roles.
export function buildRoleCodes(values: RoleValue[]): CodeableConcept[] {
  return values.map(roleValueToConcept);
}

// Reads every role value off an existing PractitionerRole's `code` array.
// Matches generically against ROLE_OPTIONS instead of hardcoding specific
// values, so it works for every role (including ones added later).
export function getRoleValues(role: PractitionerRole | undefined): RoleValue[] {
  if (!role?.code) {
    return [];
  }
  const found: RoleValue[] = [];
  for (const concept of role.code) {
    const coding = concept.coding?.find((c) => c.system === PRACTITIONER_ROLE_SYSTEM);
    const matchByCode = ROLE_OPTIONS.find((r) => r.value === coding?.code);
    const matchByText = ROLE_OPTIONS.find(
      (r) => r.label.toLowerCase() === concept.text?.toLowerCase()
    );
    const match = matchByCode ?? matchByText;
    if (match) {
      found.push(match.value);
    }
  }
  return found;
}