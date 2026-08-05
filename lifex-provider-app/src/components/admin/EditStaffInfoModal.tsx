import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { Modal, TextInput, Button, Stack, Alert, Text } from '@mantine/core';
import type { Practitioner } from '@medplum/fhirtypes';
import { createStaffInfoChangeAuditEvent } from '../../utils/auditLog';

interface EditStaffInfoModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  practitioner: Practitioner | null;
}

export function EditStaffInfoModal({ opened, onClose, onSuccess, practitioner }: EditStaffInfoModalProps): JSX.Element {
  const medplum = useMedplum();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened && practitioner) {
      setFirstName(practitioner.name?.[0]?.given?.[0] ?? '');
      setLastName(practitioner.name?.[0]?.family ?? '');
      setEmail(practitioner.telecom?.find((t) => t.system === 'email')?.value ?? '');
      setPhone(practitioner.telecom?.find((t) => t.system === 'phone')?.value ?? '');
      setError(null);
    }
  }, [opened, practitioner]);

  async function handleSubmit(): Promise<void> {
    if (!practitioner) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const changedFields: string[] = [];
      const originalFirst = practitioner.name?.[0]?.given?.[0] ?? '';
      const originalLast = practitioner.name?.[0]?.family ?? '';
      const originalEmail = practitioner.telecom?.find((t) => t.system === 'email')?.value ?? '';
      const originalPhone = practitioner.telecom?.find((t) => t.system === 'phone')?.value ?? '';

      if (firstName.trim() !== originalFirst || lastName.trim() !== originalLast) changedFields.push('name');
      if (email.trim() !== originalEmail) changedFields.push('contact email');
      if (phone.trim() !== originalPhone) changedFields.push('phone');

      if (changedFields.length === 0) {
        onClose();
        return;
      }

      const otherTelecom = practitioner.telecom?.filter((t) => t.system !== 'email' && t.system !== 'phone') ?? [];
      const telecom = [
        ...otherTelecom,
        ...(email.trim() ? [{ system: 'email' as const, value: email.trim() }] : []),
        ...(phone.trim() ? [{ system: 'phone' as const, value: phone.trim() }] : []),
      ];

      const updated = await medplum.updateResource({
        ...practitioner,
        name: [{ ...practitioner.name?.[0], given: [firstName.trim()], family: lastName.trim() }],
        telecom,
      });

      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      try {
        await createStaffInfoChangeAuditEvent(medplum, `Practitioner/${updated.id}`, fullName, changedFields);
      } catch (err) {
        console.error('Failed to record info-change audit event', err);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update staff info', err);
      setError('Something went wrong. Check the console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Edit staff info" centered>
      <Stack>
        <Text size="xs" c="dimmed">
          This updates their profile info only. It does not change their login email or password.
        </Text>

        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        <TextInput label="First name" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} required />
        <TextInput label="Last name" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} required />
        <TextInput label="Contact email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />

        <Button onClick={handleSubmit} loading={submitting} fullWidth mt="sm">
          Save Changes
        </Button>
      </Stack>
    </Modal>
  );
}