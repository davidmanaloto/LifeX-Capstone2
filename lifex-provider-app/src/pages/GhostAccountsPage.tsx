import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router';
import { useMedplum } from '@medplum/react';
import type { Practitioner, PractitionerRole, ProjectMembership, AuditEvent } from '@medplum/fhirtypes';
import { getReferenceString } from '@medplum/core';
import { Container, Title, Text, Table, Loader, Alert, Badge, Group, Tabs, Button } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { getRoleValues, roleLabel, roleColor, type RoleValue } from '../utils/practitionerRoles';
import { getAuditEventDetail } from '../utils/auditLog';

interface GhostRow {
  practitioner: Practitioner;
  membership: ProjectMembership;
  name: string;
  email: string;
  detail: string;
}

const DORMANT_THRESHOLD_DAYS = 90;

export function GhostAccountsPage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const isAdmin = useAdminAccess();

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [memberships, setMemberships] = useState<ProjectMembership[]>([]);
  const [roles, setRoles] = useState<PractitionerRole[]>([]);
  const [statusEvents, setStatusEvents] = useState<AuditEvent[]>([]);
  const [loginRefs, setLoginRefs] = useState<Set<string> | null>(null); // null = couldn't determine
  const [loading, setLoading] = useState(true);
  const [loginCheckError, setLoginCheckError] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function load(): Promise<void> {
      const [practitionerResults, membershipResults, roleResults, eventResults] = await Promise.all([
        medplum.searchResources('Practitioner', { _count: 100 }),
        medplum.searchResources('ProjectMembership', { _count: 100 }),
        medplum.searchResources('PractitionerRole', { _count: 100 }),
        medplum.searchResources('AuditEvent', {
          type: 'https://lifex-provider.app/fhir/audit-event-type|user-status-change',
          _count: 200,
        }),
      ]);
      setPractitioners(practitionerResults);
      setMemberships(membershipResults);
      setRoles(roleResults);
      setStatusEvents(eventResults);

      // Best-effort: determine which practitioners have ever logged in.
      // Login is a Medplum-specific admin resource — if this project's
      // AccessPolicy doesn't grant it, or the search shape isn't what we
      // expect, we fall back to "unable to determine" rather than fail
      // the whole page.
      try {
        const logins = await medplum.searchResources('Login', { _count: 500 });
        const refs = new Set<string>();
        for (const login of logins) {
          const profileRef = (login as { profile?: { reference?: string } }).profile?.reference;
          if (profileRef) refs.add(profileRef);
        }
        setLoginRefs(refs);
      } catch (err) {
        console.warn('Could not determine login history (Login resource unavailable or not permitted)', err);
        setLoginCheckError(true);
        setLoginRefs(null);
      }

      setLoading(false);
    }

    load().catch((err) => {
      console.error('Failed to load ghost account data', err);
      setLoading(false);
    });
  }, [medplum, isAdmin]);

  function findMembership(practitioner: Practitioner): ProjectMembership | undefined {
    const ref = getReferenceString(practitioner);
    return memberships.find((m) => m.profile?.reference === ref);
  }

  function findRole(practitioner: Practitioner): PractitionerRole | undefined {
    const ref = getReferenceString(practitioner);
    return roles.find((r) => r.practitioner?.reference === ref);
  }

  function displayName(p: Practitioner): string {
    return `${p.name?.[0]?.given?.join(' ') ?? ''} ${p.name?.[0]?.family ?? ''}`.trim() || '(unnamed)';
  }

  function displayEmail(p: Practitioner): string {
    return p.telecom?.find((t) => t.system === 'email')?.value ?? '—';
  }

  const noRole: GhostRow[] = useMemo(() => {
    return practitioners
      .map((p) => {
        const membership = findMembership(p);
        if (!membership) return null;
        const role = findRole(p);
        const roleValues = getRoleValues(role);
        if (roleValues.length > 0) return null;
        return { practitioner: p, membership, name: displayName(p), email: displayEmail(p), detail: 'Stuck after account creation — no role assigned' };
      })
      .filter((r): r is GhostRow => r !== null);
  }, [practitioners, memberships, roles]);

  const noAccessPolicy: GhostRow[] = useMemo(() => {
    return practitioners
      .map((p) => {
        const membership = findMembership(p);
        if (!membership) return null;
        const role = findRole(p);
        const roleValues = getRoleValues(role);
        if (roleValues.length === 0) return null; // covered by "no role" already
        if (membership.accessPolicy) return null;
        const roleLabels = roleValues.map((rv: RoleValue) => roleLabel(rv)).join(', ');
        return {
          practitioner: p,
          membership,
          name: displayName(p),
          email: displayEmail(p),
          detail: `Has role(s) "${roleLabels}" but no access policy is set — enforced access may not match`,
        };
      })
      .filter((r): r is GhostRow => r !== null);
  }, [practitioners, memberships, roles]);

  const dormant: GhostRow[] = useMemo(() => {
    return practitioners
      .map((p) => {
        const membership = findMembership(p);
        if (!membership || membership.active !== false) return null;

        const practitionerRef = getReferenceString(p);
        const relevantEvents = statusEvents
          .filter((e) => e.entity?.[0]?.what?.reference === practitionerRef)
          .filter((e) => getAuditEventDetail(e, 'newStatus') === 'inactive')
          .sort((a, b) => (b.recorded ?? '').localeCompare(a.recorded ?? ''));

        const deactivatedAt = relevantEvents[0]?.recorded ?? membership.meta?.lastUpdated;
        if (!deactivatedAt) return null;

        const daysSince = Math.floor((Date.now() - new Date(deactivatedAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince < DORMANT_THRESHOLD_DAYS) return null;

        return {
          practitioner: p,
          membership,
          name: displayName(p),
          email: displayEmail(p),
          detail: `Inactive for ${daysSince} days (since ${new Date(deactivatedAt).toLocaleDateString()})`,
        };
      })
      .filter((r): r is GhostRow => r !== null);
  }, [practitioners, memberships, statusEvents]);

  const neverLoggedIn: GhostRow[] = useMemo(() => {
    if (!loginRefs) return [];
    return practitioners
      .map((p) => {
        const membership = findMembership(p);
        if (!membership) return null;
        const practitionerRef = getReferenceString(p);
        if (!practitionerRef || loginRefs.has(practitionerRef)) return null;
        return { practitioner: p, membership, name: displayName(p), email: displayEmail(p), detail: 'No login recorded since account creation' };
      })
      .filter((r): r is GhostRow => r !== null);
  }, [practitioners, memberships, loginRefs]);

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

  function renderTable(rows: GhostRow[]): JSX.Element {
    if (rows.length === 0) {
      return <Text c="dimmed">None found.</Text>;
    }
    return (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Detail</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.practitioner.id}>
              <Table.Td>{row.name}</Table.Td>
              <Table.Td>{row.email}</Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">{row.detail}</Text>
              </Table.Td>
              <Table.Td>
                <Button size="xs" variant="light" onClick={() => navigate(`/admin/staff/${row.practitioner.id}`)}>
                  View
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  }

  return (
    <Container size="lg">
      <Title order={2} mb="md">Ghost Accounts</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Accounts that may need attention — stuck mid-setup, misconfigured, or unused.
      </Text>

      <Tabs defaultValue="no-role">
        <Tabs.List>
          <Tabs.Tab value="no-role">No Role ({noRole.length})</Tabs.Tab>
          <Tabs.Tab value="no-policy">No Access Policy ({noAccessPolicy.length})</Tabs.Tab>
          <Tabs.Tab value="dormant">Dormant 90+ days ({dormant.length})</Tabs.Tab>
          <Tabs.Tab value="never-logged-in">
            Never Logged In {loginRefs ? `(${neverLoggedIn.length})` : ''}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="no-role" pt="md">{renderTable(noRole)}</Tabs.Panel>
        <Tabs.Panel value="no-policy" pt="md">{renderTable(noAccessPolicy)}</Tabs.Panel>
        <Tabs.Panel value="dormant" pt="md">{renderTable(dormant)}</Tabs.Panel>
        <Tabs.Panel value="never-logged-in" pt="md">
          {loginCheckError ? (
            <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
              Unable to determine login history — this project's access policy may not grant access to login
              records, or the Login resource isn't queryable this way. This category is unavailable until that's
              resolved.
            </Alert>
          ) : (
            renderTable(neverLoggedIn)
          )}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}