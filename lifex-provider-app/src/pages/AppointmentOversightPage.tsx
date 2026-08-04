import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import type { Appointment, Practitioner, PractitionerRole } from '@medplum/fhirtypes';
import { Table, Loader, Text, Title, Container, Group, Badge, Select, TextInput, SimpleGrid, Card } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useAppointments } from '../hooks/useAppointments';
import { useOrganizations } from '../hooks/useOrganizations';

const STATUS_COLORS: Record<string, string> = {
  booked: 'blue',
  arrived: 'teal',
  fulfilled: 'green',
  cancelled: 'red',
  noshow: 'orange',
  proposed: 'gray',
  pending: 'yellow',
  checked_in: 'teal',
};

function formatStatusLabel(status: string | undefined): string {
  if (!status) return 'Unknown';
  return status.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

interface PractitionerInfo {
  name: string;
  organizationId?: string;
}

export function AppointmentOversightPage(): JSX.Element {
  const medplum = useMedplum();
  const isAdmin = useAdminAccess();
  const { appointments, loading } = useAppointments();
  const { organizations } = useOrganizations();
  const [practitionerInfo, setPractitionerInfo] = useState<Record<string, PractitionerInfo>>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (appointments.length === 0) {
      return;
    }
    const practitionerRefs = new Set<string>();
    for (const appt of appointments) {
      for (const p of appt.participant ?? []) {
        if (p.actor?.reference?.startsWith('Practitioner/')) {
          practitionerRefs.add(p.actor.reference);
        }
      }
    }

    Promise.all(
      Array.from(practitionerRefs).map(async (ref) => {
        try {
          const practitioner = await medplum.readReference<Practitioner>({ reference: ref });
          const name =
            `${practitioner.name?.[0]?.given?.join(' ') ?? ''} ${practitioner.name?.[0]?.family ?? ''}`.trim() ||
            ref;

          let organizationId: string | undefined;
          try {
            const roles = await medplum.searchResources('PractitionerRole', {
              practitioner: ref,
              _count: 1,
            });
            organizationId = roles[0]?.organization?.reference?.replace('Organization/', '');
          } catch {
            // Role lookup is best-effort — org filter just won't apply to this appointment.
          }

          return [ref, { name, organizationId }] as const;
        } catch {
          return [ref, { name: ref }] as const;
        }
      })
    ).then((entries) => {
      setPractitionerInfo(Object.fromEntries(entries));
    });
  }, [appointments, medplum]);

  const summary = useMemo(() => {
    const total = appointments.length;
    const byStatus: Record<string, number> = {};
    for (const appt of appointments) {
      const status = appt.status ?? 'unknown';
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    }
    return { total, byStatus };
  }, [appointments]);

  const filtered = useMemo(() => {
    return appointments.filter((appt) => {
      const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;

      const practitionerRef = appt.participant?.find((p) => p.actor?.reference?.startsWith('Practitioner/'))?.actor
        ?.reference;
      const info = practitionerRef ? practitionerInfo[practitionerRef] : undefined;

      const matchesOrg = orgFilter === 'all' || info?.organizationId === orgFilter;

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || (info?.name ?? '').toLowerCase().includes(query);

      return matchesStatus && matchesOrg && matchesSearch;
    });
  }, [appointments, statusFilter, orgFilter, searchQuery, practitionerInfo]);

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

  const statusOptions = Array.from(new Set(appointments.map((a) => a.status).filter(Boolean))) as string[];

  return (
    <Container size="lg">
      <Title order={2} mb="md">
        Appointment Oversight
      </Title>

      <Text size="sm" c="dimmed" mb="md">
        Read-only view. Patient identity is not shown here — see individual patient charts for that.
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="lg">
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed">Total</Text>
          <Text size="xl" fw={700}>{summary.total}</Text>
        </Card>
        {Object.entries(summary.byStatus)
          .slice(0, 3)
          .map(([status, count]) => (
            <Card withBorder padding="md" key={status}>
              <Text size="xs" c="dimmed">{formatStatusLabel(status)}</Text>
              <Text size="xl" fw={700} c={STATUS_COLORS[status] ?? 'gray'}>
                {count}
              </Text>
            </Card>
          ))}
      </SimpleGrid>

      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Search by practitioner"
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          w={260}
        />
        <Select
          placeholder="All statuses"
          data={[{ value: 'all', label: 'All statuses' }, ...statusOptions.map((s) => ({ value: s, label: formatStatusLabel(s) }))]}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v ?? 'all')}
          w={180}
          clearable={false}
        />
        {organizations.length > 1 && (
          <Select
            placeholder="All organizations"
            data={[{ value: 'all', label: 'All organizations' }, ...organizations.map((o) => ({ value: o.id ?? '', label: o.name ?? 'Unnamed' }))]}
            value={orgFilter}
            onChange={(v) => setOrgFilter(v ?? 'all')}
            w={200}
            clearable={false}
          />
        )}
      </Group>

      {filtered.length === 0 ? (
        <Text c="dimmed">No appointments match the current filters.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Practitioner</Table.Th>
              {organizations.length > 1 && <Table.Th>Organization</Table.Th>}
              <Table.Th>Status</Table.Th>
              <Table.Th>Type</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((appt) => {
              const practitionerRef = appt.participant?.find((p) => p.actor?.reference?.startsWith('Practitioner/'))
                ?.actor?.reference;
              const info = practitionerRef ? practitionerInfo[practitionerRef] : undefined;
              const orgName = organizations.find((o) => o.id === info?.organizationId)?.name ?? '—';
              const appointmentType = appt.appointmentType?.text ?? appt.serviceType?.[0]?.text ?? '—';

              return (
                <Table.Tr key={appt.id}>
                  <Table.Td>{appt.start ? new Date(appt.start).toLocaleString() : '—'}</Table.Td>
                  <Table.Td>{info?.name ?? '—'}</Table.Td>
                  {organizations.length > 1 && <Table.Td>{orgName}</Table.Td>}
                  <Table.Td>
                    <Badge color={STATUS_COLORS[appt.status ?? ''] ?? 'gray'} variant="light">
                      {formatStatusLabel(appt.status)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{appointmentType}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Container>
  );
}