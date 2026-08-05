import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import type { Practitioner, PractitionerRole, ProjectMembership } from '@medplum/fhirtypes';
import { getReferenceString } from '@medplum/core';
import {
  Table,
  Loader,
  Text,
  Title,
  Container,
  Alert,
  Button,
  Group,
  Badge,
  Modal,
  Stack,
  Card,
  SimpleGrid,
  TextInput,
  Select,
  MultiSelect,
  Textarea,
  Paper,
} from '@mantine/core';
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useOrganizations } from '../hooks/useOrganizations';
import { useLocations } from '../hooks/useLocations';
import { useAppointments } from '../hooks/useAppointments';
import { useNavigate } from 'react-router';
import {
  createLocationAssignmentAuditEvent,
  createStatusChangeAuditEvent,
  DEACTIVATION_REASONS,
  REACTIVATION_REASONS,
  ROLE_CHANGE_REASONS,
  DEPARTMENT_CHANGE_REASONS,
} from '../utils/auditLog';
import { CreateOrganizationModal } from '../components/admin/CreateOrganizationModal';
import {
  getRoleValues,
  roleLabel,
  roleColor,
  buildRoleCodes,
  ROLE_OPTIONS,
  type RoleValue,
} from '../utils/practitionerRoles';
import { syncAccessPolicyAndLogRoleChange } from '../utils/accessPolicies';

interface BulkStatusTarget {
  membership: ProjectMembership;
  name: string;
}

export function AdminDashboard(): JSX.Element {
  const medplum = useMedplum();
  const isAdmin = useAdminAccess();
  const navigate = useNavigate();
  const { locations } = useLocations();
  const { appointments } = useAppointments();

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [memberships, setMemberships] = useState<ProjectMembership[]>([]);
  const [roles, setRoles] = useState<PractitionerRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk role assignment
  const [bulkRoleModalOpen, setBulkRoleModalOpen] = useState(false);
  const [bulkRoleAction, setBulkRoleAction] = useState<'replace' | 'add' | 'remove'>('replace');
  const [bulkRoles, setBulkRoles] = useState<RoleValue[]>([]);
  const [bulkRoleReason, setBulkRoleReason] = useState<string | null>(null);
  const [bulkRoleNotes, setBulkRoleNotes] = useState('');
  const [bulkRoleConfirmText, setBulkRoleConfirmText] = useState('');
  const [bulkRoleSubmitting, setBulkRoleSubmitting] = useState(false);

  // Bulk department assignment
  const [bulkDeptModalOpen, setBulkDeptModalOpen] = useState(false);
  const [bulkDeptAction, setBulkDeptAction] = useState<'replace' | 'add' | 'remove'>('replace');
  const [bulkDeptLocationIds, setBulkDeptLocationIds] = useState<string[]>([]);
  const [bulkDeptReason, setBulkDeptReason] = useState<string | null>(null);
  const [bulkDeptNotes, setBulkDeptNotes] = useState('');
  const [bulkDeptConfirmText, setBulkDeptConfirmText] = useState('');
  const [bulkDeptSubmitting, setBulkDeptSubmitting] = useState(false);

  // Bulk status change (deactivate/reactivate)
  const [bulkStatusTargets, setBulkStatusTargets] = useState<BulkStatusTarget[] | null>(null);
  const [bulkStatusDeactivating, setBulkStatusDeactivating] = useState(true);
  const [bulkReason, setBulkReason] = useState<string | null>(null);
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkConfirmText, setBulkConfirmText] = useState('');
  const [bulkStatusSubmitting, setBulkStatusSubmitting] = useState(false);

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

  const summary = useMemo(() => {
    const total = practitioners.length;
    const activeCount = memberships.filter((m) => m.active !== false).length;
    const inactiveCount = total - activeCount;

    const roleCounts: Record<string, number> = {};
    const noRoleStaff: string[] = [];

    for (const p of practitioners) {
      const role = findRole(p);
      const roleValues = getRoleValues(role);
      if (roleValues.length === 0) {
        const name = `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim() || '(unnamed)';
        noRoleStaff.push(name);
      } else {
        for (const rv of roleValues) {
          roleCounts[rv] = (roleCounts[rv] ?? 0) + 1;
        }
      }
    }

    return { total, activeCount, inactiveCount, roleCounts, noRoleStaff };
  }, [practitioners, memberships, roles]);

  const hospitalSummary = useMemo(() => {
    const activeOrgs = organizations.filter((o) => o.active !== false).length;
    const activeLocations = locations.filter((l) => l.status !== 'inactive').length;

    const todayStr = new Date().toDateString();
    const todaysAppointments = appointments.filter(
      (a) => a.start && new Date(a.start).toDateString() === todayStr
    ).length;

    return {
      totalOrgs: organizations.length,
      activeOrgs,
      totalLocations: locations.length,
      activeLocations,
      todaysAppointments,
      totalAppointments: appointments.length,
    };
  }, [organizations, locations, appointments]);

  const filteredPractitioners = useMemo(() => {
    return practitioners.filter((p) => {
      const displayName = `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim().toLowerCase();
      const email = p.telecom?.find((t) => t.system === 'email')?.value?.toLowerCase() ?? '';
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || displayName.includes(query) || email.includes(query);

      const role = findRole(p);
      const roleValues = getRoleValues(role);
      const matchesRole = roleFilter === 'all' || roleValues.includes(roleFilter as RoleValue);

      const membership = findMembership(p);
      const isActive = membership?.active !== false;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? isActive : !isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [practitioners, memberships, roles, searchQuery, roleFilter, statusFilter]);

  // Clear selection whenever the visible filtered set changes, so stale
  // selections from a previous filter view can't silently linger.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, roleFilter, statusFilter]);

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

  function findLocationNames(practitioner: Practitioner): string[] {
    const role = findRole(practitioner);
    if (!role?.location) return [];
    return role.location
      .map((ref) => locations.find((l) => `Location/${l.id}` === ref.reference)?.name)
      .filter((n): n is string => Boolean(n));
  }

  function findRole(practitioner: Practitioner): PractitionerRole | undefined {
    const practitionerRef = getReferenceString(practitioner);
    return roles.find((r) => r.practitioner?.reference === practitionerRef);
  }

  const selectedPractitioners = filteredPractitioners.filter((p) => p.id && selectedIds.has(p.id));

  // --- Bulk role assignment ---

  function openBulkRoleModal(): void {
    setBulkRoleAction('replace');
    setBulkRoles([]);
    setBulkRoleReason(null);
    setBulkRoleNotes('');
    setBulkRoleConfirmText('');
    setBulkRoleModalOpen(true);
  }

  function closeBulkRoleModal(): void {
    setBulkRoleModalOpen(false);
  }

  async function submitBulkRoleAssignment(): Promise<void> {
    if (bulkRoles.length === 0) {
      return;
    }
    setBulkRoleSubmitting(true);
    setActionError(null);
    try {
      await Promise.all(
        selectedPractitioners.map(async (p) => {
          const practitionerId = p.id;
          if (!practitionerId) return;

          const existing = findRole(p);
          const previousRoles = getRoleValues(existing);
          const name = `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim() || '(unnamed)';
          const practitionerRef = `Practitioner/${practitionerId}`;

          let finalRoles: RoleValue[];
          if (bulkRoleAction === 'replace') {
            finalRoles = bulkRoles;
          } else if (bulkRoleAction === 'add') {
            finalRoles = Array.from(new Set([...previousRoles, ...bulkRoles]));
          } else {
            finalRoles = previousRoles.filter((r) => !bulkRoles.includes(r));
          }

          const unchanged =
            finalRoles.length === previousRoles.length && finalRoles.every((r) => previousRoles.includes(r));
          if (unchanged) return;

          const code = buildRoleCodes(finalRoles);

          if (existing) {
            await medplum.updateResource({ ...existing, code });
          } else if (finalRoles.length > 0) {
            await medplum.createResource({
              resourceType: 'PractitionerRole',
              active: true,
              practitioner: { reference: practitionerRef },
              code,
            });
          }

          const membership = findMembership(p);
          await syncAccessPolicyAndLogRoleChange(
            medplum,
            membership,
            practitionerRef,
            name,
            previousRoles,
            finalRoles,
            bulkRoleReason ?? undefined,
            bulkRoleNotes
          );
        })
      );
      closeBulkRoleModal();
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      console.error('Bulk role assignment failed', err);
      setActionError('Bulk role assignment failed partway through. Check the console and verify affected accounts.');
    } finally {
      setBulkRoleSubmitting(false);
    }
  }

  // --- Bulk department assignment ---

  function openBulkDeptModal(): void {
    setBulkDeptAction('replace');
    setBulkDeptLocationIds([]);
    setBulkDeptReason(null);
    setBulkDeptNotes('');
    setBulkDeptConfirmText('');
    setBulkDeptModalOpen(true);
  }

  function closeBulkDeptModal(): void {
    setBulkDeptModalOpen(false);
  }

  async function submitBulkDeptAssignment(): Promise<void> {
    if (bulkDeptLocationIds.length === 0) {
      return;
    }
    setBulkDeptSubmitting(true);
    setActionError(null);
    try {
      await Promise.all(
        selectedPractitioners.map(async (p) => {
          const practitionerId = p.id;
          if (!practitionerId) return;

          const existing = findRole(p);
          const previousLocationIds =
            existing?.location?.map((ref) => ref.reference?.replace('Location/', '') ?? '').filter(Boolean) ?? [];
          const name = `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim() || '(unnamed)';
          const practitionerRef = `Practitioner/${practitionerId}`;

          let finalLocationIds: string[];
          if (bulkDeptAction === 'replace') {
            finalLocationIds = bulkDeptLocationIds;
          } else if (bulkDeptAction === 'add') {
            finalLocationIds = Array.from(new Set([...previousLocationIds, ...bulkDeptLocationIds]));
          } else {
            finalLocationIds = previousLocationIds.filter((id) => !bulkDeptLocationIds.includes(id));
          }

          const unchanged =
            finalLocationIds.length === previousLocationIds.length &&
            finalLocationIds.every((id) => previousLocationIds.includes(id));
          if (unchanged) return;

          const locationRefs = finalLocationIds.map((id) => ({ reference: `Location/${id}` }));

          if (existing) {
            await medplum.updateResource({ ...existing, location: locationRefs });
          } else if (finalLocationIds.length > 0) {
            await medplum.createResource({
              resourceType: 'PractitionerRole',
              active: true,
              practitioner: { reference: practitionerRef },
              location: locationRefs,
            });
          }

          const previousNames = locations
            .filter((l) => previousLocationIds.includes(l.id ?? ''))
            .map((l) => l.name ?? '');
          const newNames = locations.filter((l) => finalLocationIds.includes(l.id ?? '')).map((l) => l.name ?? '');

          try {
            await createLocationAssignmentAuditEvent(
              medplum,
              practitionerRef,
              name,
              previousNames,
              newNames,
              bulkDeptReason ?? undefined,
              bulkDeptNotes
            );
          } catch (err) {
            console.error('Failed to record department-assignment audit event for', name, err);
          }
        })
      );
      closeBulkDeptModal();
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      console.error('Bulk department assignment failed', err);
      setActionError('Bulk department assignment failed partway through. Check the console and verify affected accounts.');
    } finally {
      setBulkDeptSubmitting(false);
    }
  }

  // --- Bulk status change ---

  function openBulkStatusModal(deactivating: boolean): void {
    const targets: BulkStatusTarget[] = selectedPractitioners
      .map((p) => {
        const membership = findMembership(p);
        if (!membership) return null;
        const isCurrentlyActive = membership.active !== false;
        // Only include people actually eligible for the requested action.
        if (deactivating && !isCurrentlyActive) return null;
        if (!deactivating && isCurrentlyActive) return null;
        const name = `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim() || '(unnamed)';
        return { membership, name };
      })
      .filter((t): t is BulkStatusTarget => t !== null);

    if (targets.length === 0) {
      setActionError(
        deactivating
          ? 'None of the selected accounts are currently active.'
          : 'None of the selected accounts are currently inactive.'
      );
      return;
    }

    setBulkStatusTargets(targets);
    setBulkStatusDeactivating(deactivating);
    setBulkReason(null);
    setBulkNotes('');
    setBulkConfirmText('');
  }

  function closeBulkStatusModal(): void {
    setBulkStatusTargets(null);
    setBulkReason(null);
    setBulkNotes('');
    setBulkConfirmText('');
  }

  async function patchMembershipActive(membership: ProjectMembership, value: boolean): Promise<void> {
    const project = medplum.getProject();
    if (!project?.id || !membership.id) {
      throw new Error('Missing project or membership id.');
    }
    await medplum.patchResource('ProjectMembership', membership.id, [{ op: 'add', path: '/active', value }]);
  }

  async function confirmBulkStatusChange(): Promise<void> {
    if (!bulkStatusTargets || !bulkReason) {
      return;
    }
    setBulkStatusSubmitting(true);
    setActionError(null);
    const newActiveState = !bulkStatusDeactivating;

    try {
      for (const target of bulkStatusTargets) {
        try {
          await createStatusChangeAuditEvent(medplum, target.membership, target.name, newActiveState, bulkReason, bulkNotes);
        } catch (err) {
          console.error('Failed to record audit event for', target.name, err);
        }
        await patchMembershipActive(target.membership, newActiveState);
      }
      closeBulkStatusModal();
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      console.error('Bulk status change failed', err);
      setActionError('Bulk status change failed partway through. Check the console and verify affected accounts.');
    } finally {
      setBulkStatusSubmitting(false);
    }
  }

  const bulkRoleConfirmPhrase = String(selectedPractitioners.length);
  const bulkRoleConfirmMatches = bulkRoleConfirmText.trim() === bulkRoleConfirmPhrase;
  const canConfirmBulkRole = Boolean(bulkRoleReason) && bulkRoles.length > 0 && bulkRoleConfirmMatches;

  const bulkDeptConfirmPhrase = String(selectedPractitioners.length);
  const bulkDeptConfirmMatches = bulkDeptConfirmText.trim() === bulkDeptConfirmPhrase;
  const canConfirmBulkDept = Boolean(bulkDeptReason) && bulkDeptLocationIds.length > 0 && bulkDeptConfirmMatches;

  const bulkReasonOptions = bulkStatusDeactivating ? DEACTIVATION_REASONS : REACTIVATION_REASONS;
  const bulkConfirmPhrase = bulkStatusTargets ? String(bulkStatusTargets.length) : '';
  const bulkConfirmMatches = bulkConfirmText.trim() === bulkConfirmPhrase;
  const canConfirmBulk = Boolean(bulkReason) && bulkConfirmMatches;

  return (
    <Container size="lg">
      <Title order={2} mb="md">
        Staff Management
      </Title>

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

      {!loading && practitioners.length > 0 && (
        <Stack gap="md" mb="xl">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">Total Staff</Text>
              <Text size="xl" fw={700}>{summary.total}</Text>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">Active</Text>
              <Text size="xl" fw={700} c="green">{summary.activeCount}</Text>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">Inactive</Text>
              <Text size="xl" fw={700} c="red">{summary.inactiveCount}</Text>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">No Role Set</Text>
              <Text size="xl" fw={700} c={summary.noRoleStaff.length > 0 ? 'orange' : undefined}>
                {summary.noRoleStaff.length}
              </Text>
            </Card>
          </SimpleGrid>
          <Text fw={600} size="sm" c="dimmed" mt="xs">Hospital Overview</Text>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
              <Card
                withBorder
                padding="md"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate('/admin/organizations')}
              >
                <Text size="xs" c="dimmed">Organizations</Text>
                <Text size="xl" fw={700}>{hospitalSummary.activeOrgs} / {hospitalSummary.totalOrgs}</Text>
                <Text size="xs" c="dimmed">active</Text>
              </Card>
              <Card
                withBorder
                padding="md"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate('/admin/locations')}
              >
                <Text size="xs" c="dimmed">Locations</Text>
                <Text size="xl" fw={700}>{hospitalSummary.activeLocations} / {hospitalSummary.totalLocations}</Text>
                <Text size="xs" c="dimmed">active</Text>
              </Card>
              <Card
                withBorder
                padding="md"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate('/admin/appointments')}
              >
                <Text size="xs" c="dimmed">Appointments Today</Text>
                <Text size="xl" fw={700}>{hospitalSummary.todaysAppointments}</Text>
                <Text size="xs" c="dimmed">{hospitalSummary.totalAppointments} total on record</Text>
              </Card>
            </SimpleGrid>

          <Group gap="sm">
            <TextInput
              placeholder="Search by name or email"
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              w={280}
            />
            <Select
              placeholder="All roles"
              data={[{ value: 'all', label: 'All roles' }, ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))]}
              value={roleFilter}
              onChange={(v) => setRoleFilter(v ?? 'all')}
              w={160}
              clearable={false}
            />
            <Select
              placeholder="All statuses"
              data={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v ?? 'all')}
              w={160}
              clearable={false}
            />
          </Group>

          {Object.keys(summary.roleCounts).length > 0 && (
            <Group gap="xs">
              {Object.entries(summary.roleCounts).map(([role, count]) => (
                <Badge key={role} color={roleColor(role as RoleValue)} variant="light" size="lg">
                  {roleLabel(role as RoleValue)}: {count}
                </Badge>
              ))}
            </Group>
          )}

          {summary.noRoleStaff.length > 0 && (
            <Alert color="orange" title={`${summary.noRoleStaff.length} account(s) need a role assigned`}>
              {summary.noRoleStaff.join(', ')}
            </Alert>
          )}
        </Stack>
      )}

      <Paper withBorder p="sm" mb="md">
        <Group gap="sm" wrap="wrap">
          <MultiSelect
            placeholder="Make a selection"
            data={filteredPractitioners.map((p) => ({
              value: p.id ?? '',
              label:
                `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim() || '(unnamed)',
            }))}
            value={Array.from(selectedIds)}
            onChange={(vals) => setSelectedIds(new Set(vals))}
            searchable
            clearable
            w={260}
          />

          <Button size="xs" onClick={openBulkRoleModal} disabled={selectedIds.size === 0}>
            Assign Role
          </Button>
          <Button size="xs" onClick={openBulkDeptModal} disabled={selectedIds.size === 0}>
            Assign Department
          </Button>
          <Button
            size="xs"
            color="red"
            variant="light"
            onClick={() => openBulkStatusModal(true)}
            disabled={selectedIds.size === 0}
          >
            Deactivate
          </Button>
          <Button
            size="xs"
            color="green"
            variant="light"
            onClick={() => openBulkStatusModal(false)}
            disabled={selectedIds.size === 0}
          >
            Reactivate
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
          >
            Clear
          </Button>

          {selectedIds.size > 0 && (
            <Text size="xs" c="dimmed" ml="auto">
              {selectedIds.size} selected
            </Text>
          )}
        </Group>
      </Paper>

      {filteredPractitioners.length === 0 ? (
        <Text c="dimmed">
          {practitioners.length === 0
            ? 'No staff accounts found yet.'
            : 'No staff match the current filters.'}
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Department</Table.Th>
              <Table.Th>Access</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredPractitioners.map((p) => {
              const membership = findMembership(p);
              const role = findRole(p);
              const roleValues = getRoleValues(role);
              const email = p.telecom?.find((t) => t.system === 'email')?.value;
              const displayName = `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim();
              const isSelf = membership?.id && ownMembership?.id && membership.id === ownMembership.id;
              const isActive = membership?.active !== false;

              return (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Text
                      style={{ cursor: 'pointer' }}
                      c="blue"
                      onClick={() => p.id && navigate(`/admin/staff/${p.id}`)}
                    >
                      {displayName || '—'}
                    </Text>
                    {isSelf && (
                      <Text c="dimmed" size="xs">
                        (this is you)
                      </Text>
                    )}
                  </Table.Td>
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
                    {findLocationNames(p).length > 0 ? (
                      <Group gap={4}>
                        {findLocationNames(p).map((n) => (
                          <Badge key={n} color="cyan" variant="light">{n}</Badge>
                        ))}
                      </Group>
                    ) : (
                      <Text c="dimmed" size="sm">—</Text>
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
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      {/* Bulk role assignment modal */}
      <Modal
        opened={bulkRoleModalOpen}
        onClose={closeBulkRoleModal}
        title={`Change role(s) for ${selectedPractitioners.length} staff member(s)`}
        centered
      >
        <Stack>
          <Select
            label="Action"
            data={[
              { value: 'replace', label: 'Replace — set roles to exactly this list' },
              { value: 'add', label: 'Add — keep existing roles, add these too' },
              { value: 'remove', label: 'Remove — take these roles away, keep the rest' },
            ]}
            value={bulkRoleAction}
            onChange={(v) => setBulkRoleAction((v as 'replace' | 'add' | 'remove') ?? 'replace')}
          />

          <MultiSelect
            label="Role(s)"
            placeholder="Select one or more"
            data={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
            value={bulkRoles}
            onChange={(vals) => setBulkRoles(vals as RoleValue[])}
            required
          />

          <Select
            label="Reason"
            placeholder="Select a reason"
            data={ROLE_CHANGE_REASONS}
            value={bulkRoleReason}
            onChange={setBulkRoleReason}
            required
          />

          <Textarea
            label="Notes (optional)"
            placeholder="Any additional context for the record"
            value={bulkRoleNotes}
            onChange={(e) => setBulkRoleNotes(e.currentTarget.value)}
            minRows={2}
          />

          <TextInput
            label={
              <>
                Type <strong>{bulkRoleConfirmPhrase}</strong> (the number of accounts) to confirm
              </>
            }
            placeholder={bulkRoleConfirmPhrase}
            value={bulkRoleConfirmText}
            onChange={(e) => setBulkRoleConfirmText(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={closeBulkRoleModal}>
              Cancel
            </Button>
            <Button
              disabled={!canConfirmBulkRole}
              loading={bulkRoleSubmitting}
              onClick={() => {
                submitBulkRoleAssignment().catch((err) => console.error(err));
              }}
            >
              Apply to {selectedPractitioners.length}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Bulk department assignment modal */}
      <Modal
        opened={bulkDeptModalOpen}
        onClose={closeBulkDeptModal}
        title={`Change department(s) for ${selectedPractitioners.length} staff member(s)`}
        centered
      >
        <Stack>
          <Select
            label="Action"
            data={[
              { value: 'replace', label: 'Replace — set department(s) to exactly this list' },
              { value: 'add', label: 'Add — keep existing, add these too' },
              { value: 'remove', label: 'Remove — take these away, keep the rest' },
            ]}
            value={bulkDeptAction}
            onChange={(v) => setBulkDeptAction((v as 'replace' | 'add' | 'remove') ?? 'replace')}
          />

          <MultiSelect
            label="Department(s) / Unit(s)"
            placeholder="Select one or more"
            data={locations.map((l) => ({ value: l.id ?? '', label: l.name ?? 'Unnamed' }))}
            value={bulkDeptLocationIds}
            onChange={setBulkDeptLocationIds}
            required
          />

          <Select
            label="Reason"
            placeholder="Select a reason"
            data={DEPARTMENT_CHANGE_REASONS}
            value={bulkDeptReason}
            onChange={setBulkDeptReason}
            required
          />

          <Textarea
            label="Notes (optional)"
            value={bulkDeptNotes}
            onChange={(e) => setBulkDeptNotes(e.currentTarget.value)}
            minRows={2}
          />

          <TextInput
            label={
              <>
                Type <strong>{bulkDeptConfirmPhrase}</strong> (the number of accounts) to confirm
              </>
            }
            placeholder={bulkDeptConfirmPhrase}
            value={bulkDeptConfirmText}
            onChange={(e) => setBulkDeptConfirmText(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={closeBulkDeptModal}>Cancel</Button>
            <Button
              disabled={!canConfirmBulkDept}
              loading={bulkDeptSubmitting}
              onClick={() => {
                submitBulkDeptAssignment().catch((err) => console.error(err));
              }}
            >
              Apply to {selectedPractitioners.length}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Bulk status change modal */}
      <Modal
        opened={bulkStatusTargets !== null}
        onClose={closeBulkStatusModal}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-orange-6)" />
            <Text fw={600}>
              {bulkStatusDeactivating ? 'Deactivate' : 'Reactivate'} {bulkStatusTargets?.length ?? 0} staff member(s)
            </Text>
          </Group>
        }
        centered
      >
        <Stack>
          <Text size="sm">
            The following account(s) will be {bulkStatusDeactivating ? 'deactivated' : 'reactivated'}:
          </Text>
          <Text size="sm" c="dimmed">
            {bulkStatusTargets?.map((t) => t.name).join(', ')}
          </Text>

          <Select
            label="Reason"
            placeholder="Select a reason"
            data={bulkReasonOptions}
            value={bulkReason}
            onChange={setBulkReason}
            required
          />

          <Textarea
            label="Notes (optional)"
            placeholder="Any additional context for the record"
            value={bulkNotes}
            onChange={(e) => setBulkNotes(e.currentTarget.value)}
            minRows={2}
          />

          <TextInput
            label={
              <>
                Type <strong>{bulkConfirmPhrase}</strong> (the number of accounts) to confirm
              </>
            }
            placeholder={bulkConfirmPhrase}
            value={bulkConfirmText}
            onChange={(e) => setBulkConfirmText(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={closeBulkStatusModal}>
              Cancel
            </Button>
            <Button
              color={bulkStatusDeactivating ? 'red' : 'green'}
              disabled={!canConfirmBulk}
              loading={bulkStatusSubmitting}
              onClick={() => {
                confirmBulkStatusChange().catch((err) => console.error(err));
              }}
            >
              {bulkStatusDeactivating ? 'Deactivate' : 'Reactivate'} {bulkStatusTargets?.length ?? 0}
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