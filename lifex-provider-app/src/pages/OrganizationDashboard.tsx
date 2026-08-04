import { useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import type { Organization } from '@medplum/fhirtypes';
import { formatAddress } from '@medplum/core';
import { Table, Loader, Text, Title, Container, Button, Group, Badge, Modal, Stack, Select, Textarea, TextInput } from '@mantine/core';
import { IconPlus, IconAlertTriangle } from '@tabler/icons-react';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useOrganizations } from '../hooks/useOrganizations';
import { CreateOrganizationModal } from '../components/admin/CreateOrganizationModal';
import { createOrgStatusChangeAuditEvent, ORG_DEACTIVATION_REASONS, ORG_REACTIVATION_REASONS } from '../utils/auditLog';

export function OrganizationDashboard(): JSX.Element {
  const medplum = useMedplum();
  const isAdmin = useAdminAccess();
  const { organizations, loading, reload } = useOrganizations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Organization | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <Container>
        <Text c="red">You do not have permission to view this page.</Text>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container>
        <Loader />
      </Container>
    );
  }

  function openCreateModal(): void {
    setEditingOrg(null);
    setModalOpen(true);
  }

  function openEditModal(org: Organization): void {
    setEditingOrg(org);
    setModalOpen(true);
  }

  function requestToggle(org: Organization): void {
    setPendingToggle(org);
    setReason(null);
    setNotes('');
    setConfirmText('');
  }

  function closeToggleModal(): void {
    setPendingToggle(null);
    setReason(null);
    setNotes('');
    setConfirmText('');
  }

  async function confirmToggleActive(): Promise<void> {
    const orgId = pendingToggle?.id;
    if (!orgId || !reason) {
        return;
    }
    const org = pendingToggle;
    const newActiveState = org.active === false;
    const name = org.name ?? '(unnamed organization)';

    closeToggleModal();
    setActionError(null);
    setBusyId(orgId);

    try {
        try {
        await createOrgStatusChangeAuditEvent(medplum, orgId, name, newActiveState, reason, notes);
        } catch (err) {
        console.error('Failed to record audit event', err);
        setActionError('Status was changed, but the audit record could not be saved. Check the console.');
        }
        await medplum.updateResource({ ...org, active: newActiveState });
        await reload();
    } catch (err) {
        console.error('Failed to update organization status', err);
        setActionError('That action failed. Check the console for details.');
    } finally {
        setBusyId(null);
    }
    }

  const isDeactivating = pendingToggle ? pendingToggle.active !== false : false;
  const reasonOptions = isDeactivating ? ORG_DEACTIVATION_REASONS : ORG_REACTIVATION_REASONS;
  const nameMatches = pendingToggle ? confirmText.trim() === (pendingToggle.name ?? '').trim() : false;
  const canConfirm = isDeactivating ? Boolean(reason) && nameMatches : Boolean(reason);

  return (
    <Container size="lg">
      <Group justify="space-between" mb="md">
        <Title order={2}>Organizations</Title>
        <Button leftSection={<IconPlus size={18} />} onClick={openCreateModal}>
          New Organization
        </Button>
      </Group>

      {actionError && (
        <Text c="red" mb="md">
          {actionError}
        </Text>
      )}

      {organizations.length === 0 ? (
        <Text c="dimmed">No organizations set up yet. Click "New Organization" to add one.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {organizations.map((org) => {
              const phone = org.telecom?.find((t) => t.system === 'phone')?.value;
              const isActive = org.active !== false;
              const isBusy = busyId === org.id;

              return (
                <Table.Tr key={org.id}>
                  <Table.Td>{org.name ?? '—'}</Table.Td>
                  <Table.Td>{phone ?? '—'}</Table.Td>
                  <Table.Td>{org.address?.[0] ? formatAddress(org.address[0]) : '—'}</Table.Td>
                  <Table.Td>
                    {isActive ? (
                      <Badge color="green" variant="light">Active</Badge>
                    ) : (
                      <Badge color="red" variant="light">Inactive</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="light" onClick={() => openEditModal(org)}>
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        color={isActive ? 'red' : 'green'}
                        variant="light"
                        loading={isBusy}
                        onClick={() => requestToggle(org)}
                      >
                        {isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <CreateOrganizationModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => reload()}
        organization={editingOrg ?? undefined}
      />

      <Modal
        opened={pendingToggle !== null}
        onClose={closeToggleModal}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-orange-6)" />
            <Text fw={600}>{isDeactivating ? 'Deactivate' : 'Reactivate'} organization</Text>
          </Group>
        }
        centered
      >
        <Stack>
          <Text size="sm">
            <strong>{pendingToggle?.name}</strong> will be marked as {isDeactivating ? 'inactive' : 'active'}.
          </Text>

          <Select
            label="Reason"
            placeholder="Select a reason"
            data={reasonOptions}
            value={reason}
            onChange={setReason}
            required
          />

          <Textarea
            label="Notes (optional)"
            placeholder="Any additional context for the record"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            minRows={2}
          />

          {isDeactivating && (
            <TextInput
              label={
                <>
                  Type <strong>{pendingToggle?.name}</strong> to confirm
                </>
              }
              placeholder={pendingToggle?.name}
              value={confirmText}
              onChange={(e) => setConfirmText(e.currentTarget.value)}
            />
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={closeToggleModal}>
              Cancel
            </Button>
            <Button
              color={isDeactivating ? 'red' : 'green'}
              disabled={!canConfirm}
              onClick={() => {
                confirmToggleActive().catch((err) => console.error(err));
              }}
            >
              {isDeactivating ? 'Deactivate' : 'Reactivate'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}