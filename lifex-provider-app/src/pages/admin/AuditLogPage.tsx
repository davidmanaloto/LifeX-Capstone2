import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import type { AuditEvent, Practitioner } from '@medplum/fhirtypes';
import { Container, Title, Table, Loader, Text, Alert, Badge, Group, Pagination, Select, TextInput, Button } from '@mantine/core';
import { useAdminAccess } from '../../hooks/useAdminAccess';
import { IconDownload } from '@tabler/icons-react';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function load(): Promise<void> {
      try {
        const results = await medplum.searchResources('AuditEvent', {
          type: 'https://lifex-provider.app/fhir/audit-event-type|user-status-change,https://lifex-provider.app/fhir/audit-event-type|user-role-change,https://lifex-provider.app/fhir/audit-event-type|org-status-change,https://lifex-provider.app/fhir/audit-event-type|location-status-change,https://lifex-provider.app/fhir/audit-event-type|user-department-change,https://lifex-provider.app/fhir/audit-event-type|user-info-change',
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

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!event.recorded) return true;
      const recordedDate = new Date(event.recorded);
      if (startDate && recordedDate < new Date(startDate)) return false;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (recordedDate > endOfDay) return false;
      }
      return true;
    });
  }, [events, startDate, endDate]);

  const pageSizeNum = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSizeNum));

  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * pageSizeNum;
    return filteredEvents.slice(start, start + pageSizeNum);
  }, [filteredEvents, page, pageSizeNum]);

  useEffect(() => {
    setPage(1);
  }, [filteredEvents.length, pageSize]);

  function escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  function exportToCsv(): void {
    const headers = ['Date', 'Staff Member', 'Change', 'Details', 'Reason', 'Notes', 'Performed By'];

    const rows = filteredEvents.map((event) => {
      const targetName = event.entity?.[0]?.name ?? '';
      const eventCode = event.type?.code ?? '';
      const actorRef = event.agent?.[0]?.who?.reference;
      const actorName = actorRef ? (actorNames[actorRef] ?? actorRef) : '';

      const changeLabel =
        eventCode === 'user-role-change'
          ? 'Role Changed'
          : eventCode === 'user-department-change'
            ? 'Department Changed'
            : eventCode === 'user-info-change'
              ? 'Info Updated'
              : eventCode === 'org-status-change'
                ? (getDetail(event, 'newStatus') === 'active' ? 'Org Reactivated' : 'Org Deactivated')
                : eventCode === 'location-status-change'
                  ? (getDetail(event, 'newStatus') === 'active' ? 'Location Reactivated' : 'Location Deactivated')
                  : getDetail(event, 'newStatus') === 'active'
                    ? 'Reactivated'
                    : 'Deactivated';

      const details =
        eventCode === 'user-role-change'
          ? `${getDetail(event, 'previousRoles')} -> ${getDetail(event, 'newRoles')}`
          : eventCode === 'user-department-change'
            ? `${getDetail(event, 'previousLocations')} -> ${getDetail(event, 'newLocations')}`
            : '';

      const notes =
        eventCode === 'user-info-change'
          ? getDetail(event, 'changedFields') ?? ''
          : getDetail(event, 'notes') ?? '';

      return [
        event.recorded ? new Date(event.recorded).toLocaleString() : '',
        targetName,
        changeLabel,
        details,
        getDetail(event, 'reason') ?? '',
        notes,
        actorName,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => escapeCsvField(String(field))).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.download = `staff-activity-log-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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

      {events.length > 0 && (
        <Group mb="md" gap="sm" align="flex-end">
          <TextInput
            type="date"
            label="From"
            value={startDate}
            onChange={(e) => setStartDate(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            type="date"
            label="To"
            value={endDate}
            onChange={(e) => setEndDate(e.currentTarget.value)}
            w={160}
          />
          {(startDate || endDate) && (
            <Button variant="subtle" size="sm" onClick={() => { setStartDate(''); setEndDate(''); }}>
              Clear dates
            </Button>
          )}
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={exportToCsv}
            disabled={filteredEvents.length === 0}
            ml="auto"
          >
            Export CSV ({filteredEvents.length})
          </Button>
        </Group>
      )}

      {filteredEvents.length === 0 ? (
        <Text c="dimmed">
          {events.length === 0 ? 'No staff status changes recorded yet.' : 'No events match the selected date range.'}
        </Text>
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
                const eventCode = event.type?.code;
                const actorRef = event.agent?.[0]?.who?.reference;
                const actorName = actorRef ? (actorNames[actorRef] ?? actorRef) : '—';

                return (
                  <Table.Tr key={event.id}>
                    <Table.Td>{event.recorded ? new Date(event.recorded).toLocaleString() : '—'}</Table.Td>
                    <Table.Td>{targetName}</Table.Td>
                    <Table.Td>
                      {eventCode === 'user-role-change' ? (
                        <Badge color="blue" variant="light">Role Changed</Badge>
                      ) : eventCode === 'user-department-change' ? (
                        <Badge color="cyan" variant="light">Department Changed</Badge>
                      ) : eventCode === 'user-info-change' ? (
                        <Badge color="gray" variant="light">Info Updated</Badge>
                      ) : eventCode === 'org-status-change' ? (
                        <Badge color="grape" variant="light">
                          {getDetail(event, 'newStatus') === 'active' ? 'Org Reactivated' : 'Org Deactivated'}
                        </Badge>
                      ) : eventCode === 'location-status-change' ? (
                        <Badge color="teal" variant="light">
                          {getDetail(event, 'newStatus') === 'active' ? 'Location Reactivated' : 'Location Deactivated'}
                        </Badge>
                      ) : getDetail(event, 'newStatus') === 'active' ? (
                        <Badge color="green" variant="light">Reactivated</Badge>
                      ) : (
                        <Badge color="red" variant="light">Deactivated</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {eventCode === 'user-role-change'
                        ? `${getDetail(event, 'previousRoles')} → ${getDetail(event, 'newRoles')}`
                        : eventCode === 'user-department-change'
                          ? `${getDetail(event, 'previousLocations')} → ${getDetail(event, 'newLocations')}`
                          : '—'}
                    </Table.Td>
                    <Table.Td>{getDetail(event, 'reason') ?? '—'}</Table.Td>
                    <Table.Td>
                      {eventCode === 'user-info-change'
                        ? getDetail(event, 'changedFields') ?? '—'
                        : getDetail(event, 'notes') ?? '—'}
                    </Table.Td>
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
              Showing {Math.min((page - 1) * pageSizeNum + 1, filteredEvents.length)}–
              {Math.min(page * pageSizeNum, filteredEvents.length)} of {filteredEvents.length}
            </Text>

            <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
          </Group>
        </>
      )}
    </Container>
  );
}