import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import type { AuditEvent, Practitioner } from '@medplum/fhirtypes';
import { Container, Title, Table, Loader, Text, Alert, Badge, Group, Pagination, Select } from '@mantine/core';
import { useAdminAccess } from '../../hooks/useAdminAccess';

function getDetail(event: AuditEvent, type: string): string | undefined {
  return event.entity?.[0]?.detail?.find((d) => d.type === type)?.valueString;
}

export function AuditLogPage(): JSX.Element {
  const medplum = useMedplum();
  const isAdmin = useAdminAccess();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function load(): Promise<void> {
      try {
        const results = await medplum.searchResources('AuditEvent', {
          type: 'https://lifex-provider.app/fhir/audit-event-type|user-status-change,https://lifex-provider.app/fhir/audit-event-type|user-role-change',
          _sort: '-_lastUpdated',
          _count: 100,
        });
        setEvents(results);

        const refs = Array.from(
          new Set(results.map((e) => e.agent?.[0]?.who?.reference).filter((r): r is string => Boolean(r)))
        );
        const names: Record<string, string> = {};
        await Promise.all(
          refs.map(async (ref) => {
            try {
              const practitioner = await medplum.readReference<Practitioner>({ reference: ref });
              names[ref] = `${practitioner.name?.[0]?.given?.join(' ') ?? ''} ${practitioner.name?.[0]?.family ?? ''}`.trim() || ref;
            } catch {
              names[ref] = ref;
            }
          })
        );
        setActorNames(names);
      } catch (err) {
        console.error('Failed to load audit log', err);
        setError('Failed to load the activity log. Check the console for details.');
      } finally {
        setLoading(false);
      }
    }

    load().catch((err) => console.error(err));
  }, [medplum, isAdmin]);

  const pageSizeNum = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(events.length / pageSizeNum));

  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * pageSizeNum;
    return events.slice(start, start + pageSizeNum);
  }, [events, page, pageSizeNum]);

  // Reset to page 1 whenever the underlying data or page size changes, so we
  // never get stranded on a page that no longer has any rows.
  useEffect(() => {
    setPage(1);
  }, [events.length, pageSize]);

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

  return (
    <Container size="lg">
      <Title order={2} mb="md">
        Staff Activity Log
      </Title>

      {error && (
        <Alert color="red" title="Error" mb="md">
          {error}
        </Alert>
      )}

      {events.length === 0 ? (
        <Text c="dimmed">No staff status changes recorded yet.</Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Staff Member</Table.Th>
                <Table.Th>Change</Table.Th>
                <Table.Th>Details</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Notes</Table.Th>
                <Table.Th>Performed By</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedEvents.map((event) => {
                const targetName = event.entity?.[0]?.name ?? '—';
                const isRoleChange = event.type?.code === 'user-role-change';
                const actorRef = event.agent?.[0]?.who?.reference;
                const actorName = actorRef ? (actorNames[actorRef] ?? actorRef) : '—';

                return (
                  <Table.Tr key={event.id}>
                    <Table.Td>{event.recorded ? new Date(event.recorded).toLocaleString() : '—'}</Table.Td>
                    <Table.Td>{targetName}</Table.Td>
                    <Table.Td>
                      {isRoleChange ? (
                        <Badge color="blue" variant="light">Role Changed</Badge>
                      ) : getDetail(event, 'newStatus') === 'active' ? (
                        <Badge color="green" variant="light">Reactivated</Badge>
                      ) : (
                        <Badge color="red" variant="light">Deactivated</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {isRoleChange ? `${getDetail(event, 'previousRoles')} → ${getDetail(event, 'newRoles')}` : '—'}
                    </Table.Td>
                    <Table.Td>{getDetail(event, 'reason') ?? '—'}</Table.Td>
                    <Table.Td>{getDetail(event, 'notes') ?? '—'}</Table.Td>
                    <Table.Td>{actorName}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>

          <Group justify="space-between" mt="md">
            <Group gap="xs">
              <Text size="sm" c="dimmed">Rows per page</Text>
              <Select
                data={['10', '20', '50', '100']}
                value={pageSize}
                onChange={(v) => setPageSize(v ?? '20')}
                w={80}
                size="xs"
                allowDeselect={false}
              />
            </Group>

            <Text size="sm" c="dimmed">
              Showing {Math.min((page - 1) * pageSizeNum + 1, events.length)}–{Math.min(page * pageSizeNum, events.length)} of{' '}
              {events.length}
            </Text>

            <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
          </Group>
        </>
      )}
    </Container>
  );
}