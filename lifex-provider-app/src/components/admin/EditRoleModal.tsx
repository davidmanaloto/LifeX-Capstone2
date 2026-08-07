import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { Modal, MultiSelect, Select, TextInput, Textarea, Button, Stack, Alert, Text } from '@mantine/core';
import type { Practitioner, PractitionerRole, ProjectMembership } from '@medplum/fhirtypes';
import { getRoleValues, buildRoleCodes, ROLE_OPTIONS, ROLES_WITH_SPECIALTY, type RoleValue } from '../../utils/practitionerRoles';
import { ROLE_CHANGE_REASONS } from '../../utils/auditLog';
import { syncAccessPolicyAndLogRoleChange } from '../../utils/accessPolicies';
import { useOrganizations } from '../../hooks/useOrganizations';
import { useLocations } from '../../hooks/useLocations';

interface EditRoleModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  practitioner: Practitioner | null;
  currentRole: PractitionerRole | null | undefined;
  membership: ProjectMembership | null | undefined;
}

export function EditRoleModal({
  opened,
  onClose,
  onSuccess,
  practitioner,
  currentRole,
  membership,
}: EditRoleModalProps): JSX.Element {
  const medplum = useMedplum();
  const { organizations } = useOrganizations();
  const { locations } = useLocations();

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [specialtyText, setSpecialtyText] = useState('');
  const [availabilityExceptions, setAvailabilityExceptions] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSpecialtyField = (selectedRoles as RoleValue[]).some((r) => ROLES_WITH_SPECIALTY.has(r));

  useEffect(() => {
    if (opened) {
      setSelectedRoles(getRoleValues(currentRole ?? undefined));
      setSelectedOrgId(currentRole?.organization?.reference?.replace('Organization/', '') ?? organizations[0]?.id ?? null);
      setSelectedLocationIds(
        currentRole?.location?.map((ref) => ref.reference?.replace('Location/', '') ?? '').filter(Boolean) ?? []
      );
      setSpecialtyText(currentRole?.specialty?.[0]?.text ?? '');
      setAvailabilityExceptions(currentRole?.availabilityExceptions ?? '');
      setReason(null);
      setNotes('');
      setError(null);
    }
  }, [opened, currentRole, organizations]);

  async function handleSubmit(): Promise<void> {
    if (!practitioner?.id) return;
    if (!reason) {
      setError('Please select a reason.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const previousRoles = getRoleValues(currentRole ?? undefined);
      const finalRoles = selectedRoles as RoleValue[];
      const practitionerRef = `Practitioner/${practitioner.id}`;
      const name =
        `${practitioner.name?.[0]?.given?.join(' ') ?? ''} ${practitioner.name?.[0]?.family ?? ''}`.trim() ||
        '(unnamed)';

      const org = organizations.find((o) => o.id === selectedOrgId);
      const locationRefs =
        selectedLocationIds.length > 0 ? selectedLocationIds.map((id) => ({ reference: `Location/${id}` })) : undefined;
      const specialty = showSpecialtyField && specialtyText.trim() ? [{ text: specialtyText.trim() }] : undefined;
      const code = buildRoleCodes(finalRoles);

      const updates: Partial<PractitionerRole> = {
        code,
        organization: org?.id ? { reference: `Organization/${org.id}`, display: org.name } : undefined,
        location: locationRefs,
        specialty,
        availabilityExceptions: availabilityExceptions.trim() || undefined,
      };

      if (currentRole) {
        await medplum.updateResource({ ...currentRole, active: true, ...updates });
      } else if (finalRoles.length > 0) {
        await medplum.createResource({
          resourceType: 'PractitionerRole',
          active: true,
          practitioner: { reference: practitionerRef },
          ...updates,
        });
      }

      await syncAccessPolicyAndLogRoleChange(medplum, membership, practitionerRef, name, previousRoles, finalRoles, reason, notes);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update role', err);
      setError('Something went wrong. Check the console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Edit role & assignment" centered>
      <Stack>
        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {membership?.admin && (
          <Text size="xs" c="dimmed">
            This user is a project admin — their access policy stays on the Hospital Admin policy regardless of the
            role(s) selected here.
          </Text>
        )}

        <MultiSelect
          label="Role(s)"
          placeholder="Select one or more"
          data={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
          value={selectedRoles}
          onChange={setSelectedRoles}
        />

        <Select
          label="Organization"
          data={organizations.map((org) => ({ value: org.id ?? '', label: org.name ?? 'Unnamed Org' }))}
          value={selectedOrgId}
          onChange={setSelectedOrgId}
        />

        {locations.length > 0 && (
          <MultiSelect
            label="Department / Unit"
            placeholder="Select one or more"
            data={locations
              .filter((l) => l.managingOrganization?.reference === `Organization/${selectedOrgId}`)
              .map((l) => ({ value: l.id ?? '', label: l.name ?? 'Unnamed' }))}
            value={selectedLocationIds}
            onChange={setSelectedLocationIds}
          />
        )}

        {showSpecialtyField && (
          <TextInput
            label="Specialty"
            placeholder="e.g. Cardiology"
            value={specialtyText}
            onChange={(e) => setSpecialtyText(e.currentTarget.value)}
          />
        )}

        <Textarea
          label="Availability Exceptions"
          value={availabilityExceptions}
          onChange={(e) => setAvailabilityExceptions(e.currentTarget.value)}
          minRows={2}
        />

        <Select
          label="Reason for this change"
          placeholder="Select a reason"
          data={ROLE_CHANGE_REASONS}
          value={reason}
          onChange={setReason}
          required
        />

        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
        />

        <Button onClick={handleSubmit} loading={submitting} disabled={!reason} fullWidth mt="sm">
          Save Changes
        </Button>
      </Stack>
    </Modal>
  );
}