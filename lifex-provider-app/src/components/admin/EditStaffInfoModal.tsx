import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { Modal, TextInput, Button, Stack, Alert, Text, Group } from '@mantine/core';
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

  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened && practitioner) {
      setPrefix(practitioner.name?.[0]?.prefix?.[0] ?? '');
      setFirstName(practitioner.name?.[0]?.given?.[0] ?? '');
      setLastName(practitioner.name?.[0]?.family ?? '');
      setEmail(practitioner.telecom?.find((t) => t.system === 'email')?.value ?? '');
      setPhone(practitioner.telecom?.find((t) => t.system === 'phone')?.value ?? '');
      setStreet(practitioner.address?.[0]?.line?.[0] ?? '');
      setCity(practitioner.address?.[0]?.city ?? '');
      setRegion(practitioner.address?.[0]?.state ?? '');
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
      const original = practitioner.name?.[0];
      if (
        prefix.trim() !== (original?.prefix?.[0] ?? '') ||
        firstName.trim() !== (original?.given?.[0] ?? '') ||
        lastName.trim() !== (original?.family ?? '')
      ) changedFields.push('name');

      const originalEmail = practitioner.telecom?.find((t) => t.system === 'email')?.value ?? '';
      const originalPhone = practitioner.telecom?.find((t) => t.system === 'phone')?.value ?? '';
      if (email.trim() !== originalEmail) changedFields.push('contact email');
      if (phone.trim() !== originalPhone) changedFields.push('phone');

      const originalAddress = practitioner.address?.[0];
      if (
        street.trim() !== (originalAddress?.line?.[0] ?? '') ||
        city.trim() !== (originalAddress?.city ?? '') ||
        region.trim() !== (originalAddress?.state ?? '')
      ) changedFields.push('address');

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

      const address =
        street.trim() || city.trim() || region.trim()
          ? [{ use: 'work' as const, line: street.trim() ? [street.trim()] : undefined, city: city.trim() || undefined, state: region.trim() || undefined }]
          : undefined;

      const updated = await medplum.updateResource({
        ...practitioner,
        name: [{
          ...practitioner.name?.[0],
          prefix: prefix.trim() ? [prefix.trim()] : undefined,
          given: [firstName.trim()],
          family: lastName.trim(),
        }],
        telecom,
        address,
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

        <Group grow>
          <TextInput label="Title (optional)" placeholder="Dr., RN, etc." value={prefix} onChange={(e) => setPrefix(e.currentTarget.value)} />
        </Group>
        <TextInput label="First name" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} required />
        <TextInput label="Last name" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} required />
        <TextInput label="Contact email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
        <TextInput label="Street" value={street} onChange={(e) => setStreet(e.currentTarget.value)} />
        <Group grow>
          <TextInput label="City" value={city} onChange={(e) => setCity(e.currentTarget.value)} />
          <TextInput label="Province / Region" value={region} onChange={(e) => setRegion(e.currentTarget.value)} />
        </Group>

        <Button onClick={handleSubmit} loading={submitting} fullWidth mt="sm">
          Save Changes
        </Button>
      </Stack>
    </Modal>
  );
}