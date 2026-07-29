import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { useNavigate } from 'react-router';
import type { Practitioner, PractitionerRole, ProjectMembership } from '@medplum/fhirtypes';
import { getReferenceString } from '@medplum/core';
import { Table, Loader, Text, Title, Container, Alert, Button, Group, Badge, Modal, Stack } from '@mantine/core';
import { IconUserPlus, IconAlertTriangle } from '@tabler/icons-react';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useOrganizations } from '../hooks/useOrganizations';
import { CreateOrganizationModal } from '../components/admin/CreateOrganizationModal';
import { getRoleValues, roleLabel, roleColor } from '../utils/practitionerRoles';

export function AdminDashboard(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const isAdmin = useAdminAccess();

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [memberships, setMemberships] = useState<ProjectMembership[]>([]);
  const [roles, setRoles] = useState<PractitionerRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null);

  // Holds the membership + display name pending confirmation, or null when the modal is closed.
  const [pendingToggle, setPendingToggle] = useState<{ membership: ProjectMembership; name: string } | null>(null);

  const ownMembership = medplum.getProjectMembership();
  const { organizations, loading: orgsLoading, reload: reloadOrgs } = useOrganizations();
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const hasOrganization = organizations.length > 0;

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [practitionerResults, membershipResults, roleResults] = await Promise.all([
      medplum.searchResources('Practitioner', { _count: 100 }),
      medplum.searchResources('ProjectMembership', { _count: 100 }),
      medplum.searchResources('PractitionerRole', { _count: 100 }),
    ]);
    setPractitioners(practitionerResults);
    setMemberships(membershipResults);
    setRoles(roleResults);
    setLoading(false);
  }, [medplum]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadData().catch((err) => {
      console.error('Failed to load staff data', err);
      setLoading(false);
    });
  }, [isAdmin, loadData]);

  if (!isAdmin) {
    return (
      <Container>
        <Alert color="red" title="Access denied">
          You do not have permission to view this page.
        </Alert>
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

  function findMembership(practitioner: Practitioner): ProjectMembership | undefined {
    const practitionerRef = getReferenceString(practitioner);
    return memberships.find((m) => m.profile?.reference === practitionerRef);
  }

  function findRole(practitioner: Practitioner): PractitionerRole | undefined {
    const practitionerRef = getReferenceString(practitioner);
    return roles.find((r) => r.practitioner?.reference === practitionerRef);
  }

  async function patchMembership(membership: ProjectMembership, path: string, value: boolean): Promise<void> {
    const project = medplum.getProject();
    if (!project?.id || !membership.id) {
      setActionError('Missing project or membership id.');
      return;
    }
    setActionError(null);
    console.log('PATCH membership debug:', { projectId: project.id, membershipId: membership.id, path, value }); // TEMP
    setBusyMembershipId(membership.id);
    try {
      await medplum.patchResource('ProjectMembership', membership.id, [
        { op: 'add', path: '/active', value }
    ]);
      await loadData();
    } catch (err) {
      console.error(`Failed to update membership (${path})`, err);
      setActionError('That action failed. Check the console for details.');
    } finally {
      setBusyMembershipId(null);
    }
  }

  function requestToggleActive(membership: ProjectMembership, name: string): void {
    setPendingToggle({ membership, name });
  }

  async function confirmToggleActive(): Promise<void> {
    if (!pendingToggle) {
      return;
    }
    const { membership } = pendingToggle;
    const isCurrentlyActive = membership.active !== false;
    setPendingToggle(null);
    await patchMembership(membership, '/active', !isCurrentlyActive);
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="md">
        <Title order={2}>Staff Management</Title>
        <Button
          leftSection={<IconUserPlus size={18} />}
          onClick={() => navigate('/admin/new-user')}
          disabled={!hasOrganization || orgsLoading}
        >
          New user
        </Button>
      </Group>

      {!orgsLoading && !hasOrganization && (
        <Alert color="blue" title="One more step before inviting staff" mb="md">
          Set up your hospital's organization first — this only takes a moment.
          <Button size="xs" mt="sm" onClick={() => setCreateOrgModalOpen(true)}>
            Set up now
          </Button>
        </Alert>
      )}

      {actionError && (
        <Alert color="red" title="Error" mb="md" onClose={() => setActionError(null)} withCloseButton>
          {actionError}
        </Alert>
      )}

      {practitioners.length === 0 ? (
        <Text c="dimmed">No staff accounts found yet. Click "New user" to add one.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Access</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {practitioners.map((p) => {
              const membership = findMembership(p);
              const role = findRole(p);
              const roleValues = getRoleValues(role);
              const email = p.telecom?.find((t) => t.system === 'email')?.value;
              const displayName = `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim();
              const isSelf = membership?.id && ownMembership?.id && membership.id === ownMembership.id;
              const isActive = membership?.active !== false;
              const isBusy = busyMembershipId === membership?.id;

              return (
                <Table.Tr key={p.id}>
                  <Table.Td>{displayName || '—'}</Table.Td>
                  <Table.Td>{email ?? '—'}</Table.Td>
                  <Table.Td>
                    {roleValues.length > 0 ? (
                      <Group gap={4}>
                        {roleValues.map((rv) => (
                          <Badge key={rv} color={roleColor(rv)} variant="light">
                            {roleLabel(rv)}
                          </Badge>
                        ))}
                      </Group>
                    ) : (
                      <Text c="dimmed" size="sm">
                        No role set
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {membership?.admin ? (
                      <Badge color="grape">Admin</Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Staff
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {isActive ? (
                      <Badge color="green" variant="light">
                        Active
                      </Badge>
                    ) : (
                      <Badge color="red" variant="light">
                        Inactive
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {!membership ? (
                      <Text c="dimmed" size="sm">
                        No membership found
                      </Text>
                    ) : (
                      <Button
                        size="xs"
                        color={isActive ? 'red' : 'green'}
                        variant="light"
                        loading={isBusy}
                        disabled={Boolean(isSelf)}
                        onClick={() => requestToggleActive(membership, displayName || email || 'this staff member')}
                      >
                        {isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                    {isSelf && (
                      <Text c="dimmed" size="xs" mt={4}>
                        (this is you)
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={pendingToggle !== null}
        onClose={() => setPendingToggle(null)}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-orange-6)" />
            <Text fw={600}>
              {pendingToggle && pendingToggle.membership.active !== false ? 'Deactivate' : 'Reactivate'} staff member
            </Text>
          </Group>
        }
        centered
      >
        <Stack>
          <Text size="sm">
            {pendingToggle?.membership.active !== false ? (
              <>
                <strong>{pendingToggle?.name}</strong> will immediately lose access to this project. Their account
                and history are kept, and access can be restored at any time.
              </>
            ) : (
              <>
                <strong>{pendingToggle?.name}</strong> will regain access to this project immediately.
              </>
            )}
          </Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={() => setPendingToggle(null)}>
              Cancel
            </Button>
            <Button
              color={pendingToggle?.membership.active !== false ? 'red' : 'green'}
              onClick={() => {
                confirmToggleActive().catch((err) => console.error('Failed to toggle active state', err));
              }}
            >
              {pendingToggle?.membership.active !== false ? 'Deactivate' : 'Reactivate'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <CreateOrganizationModal
        opened={createOrgModalOpen}
        onClose={() => setCreateOrgModalOpen(false)}
        onSuccess={() => {
          reloadOrgs().catch((err) => console.error('Failed to refresh organizations', err));
        }}
      />
    </Container>
  );
}