import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { Modal, TextInput, Button, Stack, Alert, Text, Group } from '@mantine/core';
import type { Organization } from '@medplum/fhirtypes';

interface CreateOrganizationModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization?: Organization; // present = edit mode, absent = create mode
}

export function CreateOrganizationModal({
  opened,
  onClose,
  onSuccess,
  organization,
}: CreateOrganizationModalProps): JSX.Element {
  const medplum = useMedplum();
  const isEditMode = Boolean(organization);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setName(organization?.name ?? '');
      setPhone(organization?.telecom?.find((t) => t.system === 'phone')?.value ?? '');
      setStreet(organization?.address?.[0]?.line?.[0] ?? '');
      setCity(organization?.address?.[0]?.city ?? '');
      setRegion(organization?.address?.[0]?.state ?? '');
      setPostalCode(organization?.address?.[0]?.postalCode ?? '');
      setError(null);
    }
  }, [opened, organization]);

  async function handleSubmit(): Promise<void> {
    if (!name.trim()) {
      setError('Please enter an organization name.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const address =
        street.trim() || city.trim() || region.trim() || postalCode.trim()
          ? [
              {
                use: 'work' as const,
                line: street.trim() ? [street.trim()] : undefined,
                city: city.trim() || undefined,
                state: region.trim() || undefined,
                postalCode: postalCode.trim() || undefined,
              },
            ]
          : undefined;

      const telecom = phone.trim() ? [{ system: 'phone' as const, value: phone.trim() }] : undefined;

      if (isEditMode && organization) {
        await medplum.updateResource({
          ...organization,
          name: name.trim(),
          address,
          telecom,
        });
      } else {
        await medplum.createResource({
          resourceType: 'Organization',
          name: name.trim(),
          address,
          telecom,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} organization`, err);
      setError('Something went wrong. Check the console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditMode ? 'Edit organization' : 'Set up your hospital'}
      centered
      closeOnClickOutside={!isEditMode}
    >
      <Stack>
        {!isEditMode && (
          <Text size="sm" c="dimmed">
            This only needs to happen once. Staff you invite afterward will be linked to this organization
            automatically.
          </Text>
        )}

        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        <TextInput
          label="Hospital / clinic name"
          placeholder="Lifex General Hospital"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Phone (optional)"
          placeholder="+63 XXX XXX XXXX"
          value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)}
        />
        <TextInput
          label="Street (optional)"
          value={street}
          onChange={(e) => setStreet(e.currentTarget.value)}
        />
        <Group grow>
          <TextInput label="City" value={city} onChange={(e) => setCity(e.currentTarget.value)} />
          <TextInput label="Province / Region" value={region} onChange={(e) => setRegion(e.currentTarget.value)} />
        </Group>
        <TextInput
          label="Postal code"
          value={postalCode}
          onChange={(e) => setPostalCode(e.currentTarget.value)}
        />

        <Button onClick={handleSubmit} loading={submitting} fullWidth mt="sm">
          {isEditMode ? 'Save Changes' : 'Create'}
        </Button>
      </Stack>
    </Modal>
  );
}