import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useMedplum } from '@medplum/react';
import type { Practitioner, PractitionerRole, ProjectMembership, AuditEvent } from '@medplum/fhirtypes';
import { getReferenceString } from '@medplum/core';
import { Container, Title, Text, Group, Badge, Button, Card, Stack, Table, Loader, Alert, Divider } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useLocations } from '../hooks/useLocations';
import { getRoleValues, roleLabel, roleColor, type RoleValue } from '../utils/practitionerRoles';
import { getAuditEventDetail } from '../utils/auditLog';
import { EditStaffInfoModal } from '../components/admin/EditStaffInfoModal';
import { EditRoleModal } from '../components/admin/EditRoleModal';
import { useOrganizations } from '../hooks/useOrganizations';

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  'user-status-change': { label: 'Status Changed', color: 'red' },
  'user-role-change': { label: 'Role Changed', color: 'blue' },
  'user-department-change': { label: 'Department Changed', color: 'cyan' },
  'user-info-change': { label: 'Info Updated', color: 'gray' },
};

export function StaffDetailPage(): JSX.Element {
  const { practitionerId } = useParams();
  const navigate = useNavigate();
  const medplum = useMedplum();
  const isAdmin = useAdminAccess();
  const { locations } = useLocations();
  const { organizations } = useOrganizations();

  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [membership, setMembership] = useState<ProjectMembership | null>(null);
  const [role, setRole] = useState<PractitionerRole | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRoleModalOpen, setEditRoleModalOpen] = useState(false);

  const loadAll = async (): Promise<void> => {
    if (!practitionerId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await medplum.readResource('Practitioner', practitionerId);
      setPractitioner(p);

      const practitionerRef = getReferenceString(p);

      const [memberships, roles, auditEvents] = await Promise.all([
        medplum.searchResources('ProjectMembership', { profile: practitionerRef, _count: 1 }),
        medplum.searchResources('PractitionerRole', { practitioner: practitionerRef, _count: 1 }),
        medplum.searchResources('AuditEvent', {
          entity: `Practitioner/${practitionerId}`,
          _sort: '-_lastUpdated',
          _count: 50,
        }),
      ]);

      setMembership(memberships[0] ?? null);
      setRole(roles[0] ?? null);
      setEvents(auditEvents);
    } catch (err) {
      console.error('Failed to load staff detail', err);
      setError('Failed to load this staff member. They may not exist, or you may not have access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAll().catch((err) => console.error(err));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practitionerId, isAdmin]);

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

  if (error || !practitioner) {
    return (
      <Container size="sm">
        <Alert color="red" title="Not found">
          {error ?? 'Staff member not found.'}
        </Alert>
        <Button mt="md" variant="light" onClick={() => navigate('/admin')}>
          Back to Staff Management
        </Button>
      </Container>
    );
  }

  const displayName =
    `${practitioner.name?.[0]?.given?.join(' ') ?? ''} ${practitioner.name?.[0]?.family ?? ''}`.trim() ||
    '(unnamed)';
  const email = practitioner.telecom?.find((t) => t.system === 'email')?.value ?? '—';
  const phone = practitioner.telecom?.find((t) => t.system === 'phone')?.value ?? '—';
  const roleValues: RoleValue[] = getRoleValues(role ?? undefined);
  const isActive = membership?.active !== false;
  const organizationName = organizations.find((o) => `Organization/${o.id}` === role?.organization?.reference)?.name;
  const departmentNames =
    role?.location
      ?.map((ref) => locations.find((l) => `Location/${l.id}` === ref.reference)?.name)
      .filter((n): n is string => Boolean(n)) ?? [];

  return (
    <Container size="md">
      <Button
        variant="subtle"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => navigate('/admin')}
        mb="md"
        pl={0}
      >
        Back to Staff Management
      </Button>

      <Card withBorder padding="lg" mb="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2}>{displayName}</Title>
            <Text c="dimmed" size="sm">{email}</Text>
            <Text c="dimmed" size="sm">{phone}</Text>
          </Stack>
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={() => setEditModalOpen(true)}>
              Edit Info
            </Button>
            <Button size="xs" variant="light" onClick={() => setEditRoleModalOpen(true)}>
              Edit Role
            </Button>
          </Group>
        </Group>

        <Divider my="md" />

        <Group gap="xs" mb="xs">
          {roleValues.length > 0 ? (
            roleValues.map((rv) => (
              <Badge key={rv} color={roleColor(rv)} variant="light">
                {roleLabel(rv)}
              </Badge>
            ))
          ) : (
            <Badge color="gray" variant="light">No role set</Badge>
          )}
          {membership?.admin && <Badge color="grape">Admin</Badge>}
          {isActive ? (
            <Badge color="green" variant="light">Active</Badge>
          ) : (
            <Badge color="red" variant="light">Inactive</Badge>
          )}
        </Group>

        {organizationName && (
          <Text size="sm" c="dimmed" mt="xs">Organization: {organizationName}</Text>
        )}

        {departmentNames.length > 0 && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">Department(s):</Text>
            {departmentNames.map((n) => (
              <Badge key={n} color="cyan" variant="light">{n}</Badge>
            ))}
          </Group>
        )}
      </Card>

      <Title order={4} mb="sm">History</Title>

      {events.length === 0 ? (
        <Text c="dimmed">No recorded activity for this staff member yet.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Change</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Notes</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {events.map((event) => {
              const eventCode = event.type?.code ?? '';
              const meta = EVENT_LABELS[eventCode] ?? { label: eventCode, color: 'gray' };

              return (
                <Table.Tr key={event.id}>
                  <Table.Td>{event.recorded ? new Date(event.recorded).toLocaleString() : '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={meta.color} variant="light">{meta.label}</Badge>
                  </Table.Td>
                  <Table.Td>{getAuditEventDetail(event, 'reason') ?? '—'}</Table.Td>
                  <Table.Td>{getAuditEventDetail(event, 'notes') ?? '—'}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <EditStaffInfoModal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => loadAll()}
        practitioner={practitioner}
      />

      <EditRoleModal
        opened={editRoleModalOpen}
        onClose={() => setEditRoleModalOpen(false)}
        onSuccess={() => loadAll()}
        practitioner={practitioner}
        currentRole={role}
        membership={membership}
      />
    </Container>
  );
}