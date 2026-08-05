import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { Modal, MultiSelect, Select, Textarea, Button, Stack, Alert, Text } from '@mantine/core';
import type { Practitioner, PractitionerRole, ProjectMembership } from '@medplum/fhirtypes';
import { getRoleValues, buildRoleCodes, ROLE_OPTIONS, type RoleValue } from '../../utils/practitionerRoles';
import { ROLE_CHANGE_REASONS } from '../../utils/auditLog';
import { syncAccessPolicyAndLogRoleChange } from '../../utils/accessPolicies';

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

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setSelectedRoles(getRoleValues(currentRole ?? undefined));
      setReason(null);
      setNotes('');
      setError(null);
    }
  }, [opened, currentRole]);

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

      const code = buildRoleCodes(finalRoles);

      if (currentRole) {
        await medplum.updateResource({ ...currentRole, active: true, code });
      } else if (finalRoles.length > 0) {
        await medplum.createResource({
          resourceType: 'PractitionerRole',
          active: true,
          practitioner: { reference: practitionerRef },
          code,
        });
      }

      // Keep AccessPolicy in sync and record the audit event — same rule as
      // bulk role assignment: Admin accounts stay pinned to the Hospital Admin
      // policy; removing all roles leaves the current access policy untouched
      // (use Deactivate to actually revoke access).
      await syncAccessPolicyAndLogRoleChange(
        medplum,
        membership,
        practitionerRef,
        name,
        previousRoles,
        finalRoles,
        reason,
        notes
      );

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
    <Modal opened={opened} onClose={onClose} title="Edit role" centered>
      <Stack>
        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {membership?.admin && (
          <Text size="xs" c="dimmed">
            This user is a project admin — their access policy stays on the Hospital Admin policy regardless of the
            role(s) selected here. Role labels below are still saved for display purposes.
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
          label="Reason"
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