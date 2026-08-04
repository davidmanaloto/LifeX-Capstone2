import { useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import type { Location } from '@medplum/fhirtypes';
import { Table, Loader, Text, Title, Container, Button, Group, Badge, Modal, Stack, Select, Textarea, TextInput } from '@mantine/core';
import { IconPlus, IconAlertTriangle } from '@tabler/icons-react';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useOrganizations } from '../hooks/useOrganizations';
import { useLocations } from '../hooks/useLocations';
import { LocationModal } from '../components/admin/LocationModal';
import {
  createLocationStatusChangeAuditEvent,
  LOCATION_DEACTIVATION_REASONS,
  LOCATION_REACTIVATION_REASONS,
} from '../utils/auditLog';

const PHYSICAL_TYPE_LABELS: Record<string, string> = {
  bu: 'Building',
  wi: 'Wing',
  wa: 'Ward',
  lvl: 'Floor / Level',
  co: 'Corridor',
  ro: 'Room',
  bd: 'Bed',
};

export function LocationDashboard(): JSX.Element {
  const medplum = useMedplum();
  const isAdmin = useAdminAccess();
  const { organizations } = useOrganizations();
  const { locations, loading, reload } = useLocations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Location | null>(null);
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

  function findLocationName(ref: string | undefined): string {
    if (!ref) return '—';
    const id = ref.replace('Location/', '');
    return locations.find((l) => l.id === id)?.name ?? '—';
  }

  function openCreateModal(): void {
    setEditingLocation(null);
    setModalOpen(true);
  }

  function openEditModal(location: Location): void {
    setEditingLocation(location);
    setModalOpen(true);
  }

  function requestToggle(location: Location): void {
    setPendingToggle(location);
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
    const locationId = pendingToggle?.id;
    if (!locationId || !reason) {
        return;
    }
    const location = pendingToggle;
    const isCurrentlyActive = location.status !== 'inactive';
    const newStatus: 'active' | 'inactive' = isCurrentlyActive ? 'inactive' : 'active';
    const name = location.name ?? '(unnamed location)';

    closeToggleModal();
    setActionError(null);
    setBusyId(locationId);

    try {
        try {
        await createLocationStatusChangeAuditEvent(medplum, locationId, name, newStatus, reason, notes);
        } catch (err) {
        console.error('Failed to record audit event', err);
        setActionError('Status was changed, but the audit record could not be saved. Check the console.');
        }
        await medplum.updateResource({ ...location, status: newStatus });
        await reload();
    } catch (err) {
        console.error('Failed to update location status', err);
        setActionError('That action failed. Check the console for details.');
    } finally {
        setBusyId(null);
    }
    }

  const isDeactivating = pendingToggle ? pendingToggle.status !== 'inactive' : false;
  const reasonOptions = isDeactivating ? LOCATION_DEACTIVATION_REASONS : LOCATION_REACTIVATION_REASONS;
  const nameMatches = pendingToggle ? confirmText.trim() === (pendingToggle.name ?? '').trim() : false;
  const canConfirm = isDeactivating ? Boolean(reason) && nameMatches : Boolean(reason);

  return (
    <Container size="lg">
      <Group justify="space-between" mb="md">
        <Title order={2}>Locations</Title>
        <Button leftSection={<IconPlus size={18} />} onClick={openCreateModal} disabled={organizations.length === 0}>
          New Location
        </Button>
      </Group>

      {organizations.length === 0 && (
        <Text c="dimmed" mb="md">
          Set up an organization first before adding locations.
        </Text>
      )}

      {actionError && (
        <Text c="red" mb="md">
          {actionError}
        </Text>
      )}

      {locations.length === 0 ? (
        <Text c="dimmed">No locations set up yet. Click "New Location" to add one.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Part Of</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {locations.map((location) => {
              const typeCode = location.physicalType?.coding?.[0]?.code;
              const isActive = location.status !== 'inactive';
              const isBusy = busyId === location.id;

              return (
                <Table.Tr key={location.id}>
                  <Table.Td>{location.name ?? '—'}</Table.Td>
                  <Table.Td>{typeCode ? PHYSICAL_TYPE_LABELS[typeCode] ?? typeCode : '—'}</Table.Td>
                  <Table.Td>{findLocationName(location.partOf?.reference)}</Table.Td>
                  <Table.Td>
                    {isActive ? (
                      <Badge color="green" variant="light">Active</Badge>
                    ) : (
                      <Badge color="red" variant="light">Inactive</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="light" onClick={() => openEditModal(location)}>
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        color={isActive ? 'red' : 'green'}
                        variant="light"
                        loading={isBusy}
                        onClick={() => requestToggle(location)}
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

      <LocationModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => reload()}
        location={editingLocation ?? undefined}
        organizations={organizations}
        locations={locations}
      />

      <Modal
        opened={pendingToggle !== null}
        onClose={closeToggleModal}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-orange-6)" />
            <Text fw={600}>{isDeactivating ? 'Deactivate' : 'Reactivate'} location</Text>
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