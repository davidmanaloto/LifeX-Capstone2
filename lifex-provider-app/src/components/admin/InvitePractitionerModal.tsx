import { useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { Modal, TextInput, Checkbox, Button, Stack, Alert } from '@mantine/core';

interface InvitePractitionerModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InvitePractitionerModal({ opened, onClose, onSuccess }: InvitePractitionerModalProps): JSX.Element {
  const medplum = useMedplum();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm(): void {
    setFirstName('');
    setLastName('');
    setEmail('');
    setMakeAdmin(false);
    setError(null);
  }

  function handleClose(): void {
    resetForm();
    onClose();
  }

  async function handleSubmit(): Promise<void> {
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('First name, last name, and email are all required.');
      return;
    }

    const project = medplum.getProject();
    if (!project?.id) {
      setError('Could not determine the current project. Please try again.');
      return;
    }

    setSubmitting(true);
    try {
      await medplum.post(`admin/projects/${project.id}/invite`, {
        resourceType: 'Practitioner',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        sendEmail: true,
        membership: makeAdmin ? { admin: true } : undefined,
      });
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to invite practitioner', err);
      setError('Failed to send invite. The email may already be in use, or check the console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Invite Practitioner" centered>
      <Stack>
        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        <TextInput
          label="First name"
          placeholder="Jane"
          value={firstName}
          onChange={(e) => setFirstName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Last name"
          placeholder="Doe"
          value={lastName}
          onChange={(e) => setLastName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Email"
          placeholder="jane.doe@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
        />
        <Checkbox
          label="Make this user a project admin"
          checked={makeAdmin}
          onChange={(e) => setMakeAdmin(e.currentTarget.checked)}
        />

        <Button onClick={handleSubmit} loading={submitting} fullWidth mt="sm">
          Send Invite
        </Button>
      </Stack>
    </Modal>
  );
}