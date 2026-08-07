import { useState, useEffect } from 'react';
import type { JSX } from 'react';
import { useMedplum, ResourceForm } from '@medplum/react';
import { useNavigate } from 'react-router';
import type { PractitionerRole, ProjectMembership } from '@medplum/fhirtypes';
import {
  Container,
  Title,
  Text,
  TextInput,
  Checkbox,
  Button,
  Stack,
  Alert,
  Group,
  Badge,
  Select,
  MultiSelect,
  Textarea,
  Card,
  List,
  Stepper,
  Modal,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useAdminAccess } from '../../hooks/useAdminAccess';
import { useOrganizations } from '../../hooks/useOrganizations';
import { useLocations } from '../../hooks/useLocations';
import { ROLE_OPTIONS, buildRoleCodes, getRoleValues, roleLabel, type RoleValue } from '../../utils/practitionerRoles';
import { resolveAccessPolicyForRoles, resolveHospitalAdminAccessPolicy } from '../../utils/accessPolicies';
import { createRoleChangeAuditEvent } from '../../utils/auditLog';

type Step = 'account' | 'role' | 'details' | 'done';

const STEP_INDEX: Record<Step, number> = { account: 0, role: 1, details: 2, done: 3 };

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export function NewUserPage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const isAdmin = useAdminAccess();
  const { organizations, loading: orgsLoading } = useOrganizations();
  const { locations } = useLocations();

  const [step, setStep] = useState<Step>('account');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: account details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [confirmAccountModalOpen, setConfirmAccountModalOpen] = useState(false);

  // Step 2: role/department details
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<RoleValue[]>(['doctor']);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState('');
  const [confirmRoleModalOpen, setConfirmRoleModalOpen] = useState(false);

  // Set after each real commit
  const [practitionerRef, setPractitionerRef] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState('');
  const [practitionerRole, setPractitionerRole] = useState<PractitionerRole | null>(null);

  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id ?? null);
    }
  }, [organizations, selectedOrgId]);

  useEffect(() => {
    if (makeAdmin) {
      setSelectedRoles([]);
    } else if (selectedRoles.length === 0) {
      setSelectedRoles(['doctor']);
    }
  }, [makeAdmin]);

  if (!isAdmin) {
    return (
      <Container size="sm" mt="xl">
        <Alert color="red" title="Access denied">
          You do not have permission to view this page or your session has expired.
        </Alert>
        <Group mt="md">
          <Button variant="outline" onClick={() => navigate('/signin')}>Go to Sign In</Button>
          <Button variant="light" onClick={() => navigate('/admin')}>Back to Staff Management</Button>
        </Group>
      </Container>
    );
  }

  if (!orgsLoading && organizations.length === 0) {
    return (
      <Container size="sm" mt="xl">
        <Alert color="blue" title="Set up your hospital first">
          You'll need to create your hospital's organization before inviting staff.
        </Alert>
        <Button mt="md" variant="light" onClick={() => navigate('/admin')}>Back to Staff Management</Button>
      </Container>
    );
  }

  // --- Step 1: create the account ---

  function requestCreateAccount(): void {
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('First name, last name, and email are all required.');
      return;
    }
    setConfirmAccountModalOpen(true);
  }

  async function confirmCreateAccount(): Promise<void> {
    const project = medplum.getProject();
    if (!project?.id) {
      setError('Could not determine the current project.');
      setConfirmAccountModalOpen(false);
      return;
    }

    setConfirmAccountModalOpen(false);
    setError(null);
    setSubmitting(true);
    try {
      const membership = (await medplum.post(`admin/projects/${project.id}/invite`, {
        resourceType: 'Practitioner',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        sendEmail: false,
        scope: 'project',
        membership: { admin: makeAdmin || undefined },
      })) as ProjectMembership;

      const ref = membership.profile?.reference ?? null;
      if (!ref) {
        setError('User created, but profile reference was missing.');
        setSubmitting(false);
        return;
      }

      setPractitionerRef(ref);
      setCreatedName(`${firstName.trim()} ${lastName.trim()}`);
      setStep('role');
    } catch (err) {
      console.error('Failed to create user account', err);
      setError('Failed to create the account. The email may already be in use, or check the console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 2: assign role & access ---

  function requestAssignRole(): void {
    setError(null);
    setConfirmRoleModalOpen(true);
  }

  async function confirmAssignRole(): Promise<void> {
    if (!practitionerRef) {
      setConfirmRoleModalOpen(false);
      return;
    }

    setConfirmRoleModalOpen(false);
    setError(null);
    setSubmitting(true);
    try {
      const accessPolicy = makeAdmin
        ? await resolveHospitalAdminAccessPolicy(medplum)
        : await resolveAccessPolicyForRoles(medplum, selectedRoles);

      const project = medplum.getProject();
      // Find and patch the membership we just created, if we can resolve it —
      // otherwise skip; the account still exists and can be fixed from Staff Management.
      const memberships = await medplum.searchResources('ProjectMembership', {
        profile: practitionerRef,
        _count: 1,
      });
      const createdMembership = memberships[0];
      if (createdMembership?.id && project?.id && accessPolicy) {
        await medplum.patchResource('ProjectMembership', createdMembership.id, [
          { op: 'add', path: '/accessPolicy', value: accessPolicy },
        ]);
      }

      const org = organizations.find((o) => o.id === selectedOrgId) ?? organizations[0];
      const locationRefs =
        selectedLocationIds.length > 0
          ? selectedLocationIds.map((id) => ({ reference: `Location/${id}` }))
          : undefined;

      const createdRole = await medplum.createResource<PractitionerRole>({
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: practitionerRef },
        organization: org?.id ? { reference: `Organization/${org.id}`, display: org.name } : undefined,
        location: locationRefs,
        code: selectedRoles.length > 0 ? buildRoleCodes(selectedRoles) : undefined,
        availabilityExceptions: availabilityExceptions.trim() || undefined,
      });

      try {
        await createRoleChangeAuditEvent(medplum, practitionerRef, createdName, [], selectedRoles);
      } catch (err) {
        console.error('Failed to record role-assignment audit event', err);
      }

      setPractitionerRole(createdRole);
      setStep('details');
    } catch (err) {
      console.error('Failed to assign role', err);
      setError('Failed to assign role. The account was created — you can fix this from Staff Management.');
    } finally {
      setSubmitting(false);
    }
  }

  function finishWithoutExtras(): void {
    setStep('done');
  }

  const stepperIndex = STEP_INDEX[step];

  // Derived for the "done" summary — read straight off the saved PractitionerRole
  // rather than shadow form state, so what's shown matches what's actually persisted
  // (including anything changed via the advanced ResourceForm editor in step 3).
  const roleValuesOnRole = practitionerRole ? getRoleValues(practitionerRole) : [];
  const departmentNames =
    practitionerRole?.location
      ?.map((ref) => locations.find((l) => `Location/${l.id}` === ref.reference)?.name)
      .filter((n): n is string => Boolean(n)) ?? [];
  const workContactSummary = practitionerRole?.telecom
    ?.map((t) => `${t.system === 'fax' ? 'Fax' : 'Phone'}: ${t.value}`)
    .join(' · ');
  const identifierSummary = practitionerRole?.identifier
    ?.map((i) => i.value)
    .filter((v): v is string => Boolean(v))
    .join(', ');
  const availabilitySummary = (() => {
    const at = practitionerRole?.availableTime?.[0];
    if (!at?.daysOfWeek?.length || !at.availableStartTime || !at.availableEndTime) return null;
    const days = at.daysOfWeek.map((d) => DAY_LABELS[d] ?? d).join(', ');
    return `${days}, ${at.availableStartTime.slice(0, 5)}–${at.availableEndTime.slice(0, 5)}`;
  })();

  return (
    <Container size="md" my="lg">
      <Title order={2} mb="md">New user</Title>

      <Stepper active={stepperIndex} mb="lg" size="sm">
        <Stepper.Step label="Create Account" description="Name & email" />
        <Stepper.Step label="Assign Role" description="Role, department & access" />
        <Stepper.Step label="Additional Details" description="Optional" />
        <Stepper.Step label="Done" />
      </Stepper>

      {error && <Alert color="red" title="Error" mb="md">{error}</Alert>}

      {stepperIndex >= 1 && (
        <Alert color="green" icon={<IconCheck size={16} />} mb="md">
          Account created for <strong>{createdName}</strong>.
        </Alert>
      )}

      {step === 'account' && (
        <Stack>
          <TextInput label="First name" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} required />
          <TextInput label="Last name" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} required />
          <TextInput label="Email" placeholder="jane.doe@example.com" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
          <Checkbox label="Also make this user a project admin" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.currentTarget.checked)} />
          <Group justify="space-between" mt="md">
            <Button variant="subtle" onClick={() => navigate('/admin')}>Cancel</Button>
            <Button onClick={requestCreateAccount} loading={submitting}>Create Account</Button>
          </Group>
        </Stack>
      )}

      {step === 'role' && (
        <Stack gap="md">
          <Text size="sm">Assign {createdName}'s role, organization, and department.</Text>

          <Select
            label="Organization"
            data={organizations.map((org) => ({ value: org.id ?? '', label: org.name ?? 'Unnamed Org' }))}
            value={selectedOrgId}
            onChange={setSelectedOrgId}
          />

          <Card withBorder padding="sm">
            <Text fw={600} size="sm" mb="xs">Role</Text>
            <MultiSelect
              placeholder="Select role(s)"
              data={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
              value={selectedRoles}
              onChange={(vals) => setSelectedRoles(vals as RoleValue[])}
              disabled={makeAdmin}
            />
            {makeAdmin && (
              <Text size="xs" c="dimmed" mt={4}>
                This user was marked as a project admin, so they'll use the Hospital Admin access policy regardless
                of role selection here. Role labels below are still saved for display purposes.
              </Text>
            )}
          </Card>

          {locations.length > 0 && (
            <Card withBorder padding="sm">
              <Text fw={600} size="sm" mb="xs">Department / Unit (optional)</Text>
              <MultiSelect
                placeholder="Select one or more"
                data={locations
                  .filter((l) => l.managingOrganization?.reference === `Organization/${selectedOrgId}`)
                  .map((l) => ({ value: l.id ?? '', label: l.name ?? 'Unnamed' }))}
                value={selectedLocationIds}
                onChange={setSelectedLocationIds}
              />
            </Card>
          )}

          <Textarea
            label="Availability Exceptions"
            placeholder="e.g. Except public holidays and emergency on-call days"
            value={availabilityExceptions}
            onChange={(e) => setAvailabilityExceptions(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="md">
            <Button onClick={requestAssignRole} loading={submitting}>Assign Role & Access</Button>
          </Group>
        </Stack>
      )}

      {step === 'details' && practitionerRole && (
        <Stack gap="md">
          <Text size="sm">
            Optional: add location, healthcare service, telecom, and availability using Medplum's standard editor.
          </Text>

          <ResourceForm
            defaultValue={practitionerRole}
            onSubmit={(updated) => {
              setPractitionerRole(updated as PractitionerRole);
              setStep('done');
            }}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={finishWithoutExtras}>
              Finish (no additional details)
            </Button>
          </Group>
        </Stack>
      )}

      {step === 'done' && (
        <Stack gap="md">
          <Alert color="green" icon={<IconCheck size={16} />} title="Setup complete">
            {createdName} has been created with the role(s) and access assigned. Review the details below —
            anything that needs adjusting can be fixed from Staff Management.
          </Alert>

          <Card withBorder padding="md">
            <List spacing="xs" size="sm">
              <List.Item><strong>Name:</strong> {createdName}</List.Item>
              <List.Item><strong>Email:</strong> {email}</List.Item>
              <List.Item><strong>Admin access:</strong> {makeAdmin ? 'Yes' : 'No'}</List.Item>
              <List.Item>
                <strong>Organization:</strong>{' '}
                {organizations.find((o) => `Organization/${o.id}` === practitionerRole?.organization?.reference)?.name ?? '—'}
              </List.Item>
              <List.Item>
                <strong>Role(s):</strong>{' '}
                {makeAdmin
                  ? 'Hospital Admin (full access policy — no clinical role)'
                  : roleValuesOnRole.length > 0
                    ? roleValuesOnRole.map(roleLabel).join(', ')
                    : 'None set'}
              </List.Item>
              {departmentNames.length > 0 && (
                <List.Item><strong>Department(s):</strong> {departmentNames.join(', ')}</List.Item>
              )}
              {workContactSummary && <List.Item><strong>Telecom (from role):</strong> {workContactSummary}</List.Item>}
              {identifierSummary && <List.Item><strong>Identifier(s):</strong> {identifierSummary}</List.Item>}
              {availabilitySummary && (
                <List.Item><strong>Weekly availability:</strong> {availabilitySummary}</List.Item>
              )}
              {practitionerRole?.availabilityExceptions && (
                <List.Item><strong>Availability exceptions:</strong> {practitionerRole.availabilityExceptions}</List.Item>
              )}
              <List.Item>
                <strong>Status:</strong>{' '}
                <Badge color={practitionerRole?.active === false ? 'red' : 'green'} variant="light" size="sm">
                  {practitionerRole?.active === false ? 'Inactive' : 'Active'}
                </Badge>
              </List.Item>
            </List>
          </Card>

          <Group justify="flex-end" mt="md">
            <Button onClick={() => navigate('/admin')}>Return to Staff Management</Button>
          </Group>
        </Stack>
      )}

      {/* Confirm account creation */}
      <Modal opened={confirmAccountModalOpen} onClose={() => setConfirmAccountModalOpen(false)} title="Create account?" centered>
        <Stack>
          <Text size="sm">
            This creates a login for <strong>{firstName} {lastName}</strong> ({email}). They won't have any system
            access until you assign a role in the next step.
          </Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={() => setConfirmAccountModalOpen(false)}>Cancel</Button>
            <Button onClick={() => { confirmCreateAccount().catch((err) => console.error(err)); }}>
              Create Account
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Confirm role assignment */}
      <Modal opened={confirmRoleModalOpen} onClose={() => setConfirmRoleModalOpen(false)} title="Assign role & access?" centered>
        <Stack>
          <Text size="sm">
            This assigns{' '}
            <strong>
              {makeAdmin ? 'Hospital Admin' : selectedRoles.length > 0 ? selectedRoles.map(roleLabel).join(', ') : 'no role'}
            </strong>{' '}
            to <strong>{createdName}</strong> and determines what they can access in the system.
          </Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={() => setConfirmRoleModalOpen(false)}>Cancel</Button>
            <Button onClick={() => { confirmAssignRole().catch((err) => console.error(err)); }}>
              Assign Role & Access
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}