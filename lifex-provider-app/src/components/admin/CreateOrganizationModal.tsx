import { useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { Modal, TextInput, Button, Stack, Alert, Text } from '@mantine/core';

interface CreateOrganizationModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateOrganizationModal({ opened, onClose, onSuccess }: CreateOrganizationModalProps): JSX.Element {
  const medplum = useMedplum();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    if (!name.trim()) {
      setError('Please enter your hospital or clinic name.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await medplum.createResource({
        resourceType: 'Organization',
        name: name.trim(),
      });
      setName('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create organization', err);
      setError('Something went wrong. Check the console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Set up your hospital" centered closeOnClickOutside={false}>
      <Stack>
        <Text size="sm" c="dimmed">
          This only needs to happen once. Staff you invite afterward will be linked to this organization
          automatically.
        </Text>

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

        <Button onClick={handleSubmit} loading={submitting} fullWidth mt="sm">
          Create
        </Button>
      </Stack>
    </Modal>
  );
}