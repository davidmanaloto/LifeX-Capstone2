import { useState, useEffect } from 'react';
import type { JSX } from 'react';
import { useMedplum, ResourceForm } from '@medplum/react';
import { useNavigate } from 'react-router';
import type { CodeableConcept, PractitionerRole, ProjectMembership } from '@medplum/fhirtypes';
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
  Select,
  MultiSelect,
  Textarea,
  Card,
  List,
} from '@mantine/core';
import { useAdminAccess } from '../../hooks/useAdminAccess';
import { useOrganizations } from '../../hooks/useOrganizations';
import { ROLE_OPTIONS, ROLES_WITH_SPECIALTY, buildRoleCodes, roleLabel, type RoleValue } from '../../utils/practitionerRoles';
import { resolveAccessPolicyForRoles, resolveHospitalAdminAccessPolicy } from '../../utils/accessPolicies';

type Step = 'user' | 'role' | 'details' | 'review';

export function NewUserPage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const isAdmin = useAdminAccess();
  const { organizations, loading: orgsLoading } = useOrganizations();

  const [step, setStep] = useState<Step>('user');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: user details (collected only, not submitted yet)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(false);

  // Step 2: role details (collected, then used to submit invite + role together)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<RoleValue[]>(['doctor']);
  const [specialtyText, setSpecialtyText] = useState('');
  const [availabilityExceptions, setAvailabilityExceptions] = useState('');
  const showSpecialtyField = selectedRoles.some((r) => ROLES_WITH_SPECIALTY.has(r));

  // Set after the invite + PractitionerRole are actually created
  const [practitionerRef, setPractitionerRef] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState('');
  const [practitionerRole, setPractitionerRole] = useState<PractitionerRole | null>(null);

  useEffect(() => {
    if (makeAdmin) {
      setSelectedRoles([]);
      setSpecialtyText('');
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

  // Step 1 → Step 2: just validates and advances, no API call yet.
  function handleContinueFromUser(): void {
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('First name, last name, and email are all required.');
      return;
    }
    setStep('role');
  }

  // Step 2 → Step 3: THIS is where the actual invite + AccessPolicy + PractitionerRole
  // all happen together, now that we know both the admin flag AND the selected roles.
  async function handleContinueFromRole(): Promise<void> {
    const project = medplum.getProject();
    if (!project?.id) {
      setError('Could not determine the current project.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const accessPolicy = makeAdmin
        ? await resolveHospitalAdminAccessPolicy(medplum)
        : await resolveAccessPolicyForRoles(medplum, selectedRoles);

      const membership = (await medplum.post(`admin/projects/${project.id}/invite`, {
        resourceType: 'Practitioner',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        sendEmail: false,
        scope: 'project',
        membership: {
          admin: makeAdmin || undefined,
          accessPolicy,
        },
      })) as ProjectMembership;

      const ref = membership.profile?.reference ?? null;
      if (!ref) {
        setError('User created, but profile reference was missing.');
        setSubmitting(false);
        return;
      }

      setPractitionerRef(ref);
      setCreatedName(`${firstName.trim()} ${lastName.trim()}`);

      const org = organizations.find((o) => o.id === selectedOrgId) ?? organizations[0];
      const specialty: CodeableConcept[] | undefined =
        showSpecialtyField && specialtyText.trim() ? [{ text: specialtyText.trim() }] : undefined;

      const createdRole = await medplum.createResource<PractitionerRole>({
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: ref },
        organization: org?.id ? { reference: `Organization/${org.id}`, display: org.name } : undefined,
        code: selectedRoles.length > 0 ? buildRoleCodes(selectedRoles) : undefined,
        specialty,
        availabilityExceptions: availabilityExceptions.trim() || undefined,
      });

      setPractitionerRole(createdRole);
      setStep(makeAdmin ? 'review' : 'details');
    } catch (err) {
      console.error('Failed to create user and role', err);
      setError('Failed to create user. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container size="md" my="lg">
      <Text size="sm" c="dimmed" mb={4}>
        {step === 'user' && 'Step 1 of 4 — User details'}
        {step === 'role' && 'Step 2 of 4 — Role & assignment'}
        {step === 'details' && 'Step 3 of 4 — Additional details (optional)'}
        {step === 'review' && 'Step 4 of 4 — Review & confirm'}
      </Text>
      <Title order={2} mb="lg">New user</Title>

      {error && <Alert color="red" title="Error" mb="md">{error}</Alert>}

      {step === 'user' && (
        <Stack>
          <TextInput label="First name" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} required />
          <TextInput label="Last name" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} required />
          <TextInput label="Email" placeholder="jane.doe@example.com" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
          <Checkbox label="Also make this user a project admin" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.currentTarget.checked)} />
          <Group justify="space-between" mt="md">
            <Button variant="subtle" onClick={() => navigate('/admin')}>Cancel</Button>
            <Button onClick={handleContinueFromUser}>Continue</Button>
          </Group>
        </Stack>
      )}

      {step === 'role' && (
        <Stack gap="md">
          <Text size="sm">Set up {firstName} {lastName}'s role and organization.</Text>

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

          {showSpecialtyField && (
            <TextInput label="Specialty" placeholder="e.g. Cardiology" value={specialtyText} onChange={(e) => setSpecialtyText(e.currentTarget.value)} />
          )}

          <Textarea
            label="Availability Exceptions"
            placeholder="e.g. Except public holidays and emergency on-call days"
            value={availabilityExceptions}
            onChange={(e) => setAvailabilityExceptions(e.currentTarget.value)}
          />

          <Group justify="space-between" mt="md">
            <Button variant="subtle" onClick={() => setStep('user')}>Back</Button>
            <Button onClick={() => { handleContinueFromRole().catch((err) => console.error(err)); }} loading={submitting}>
              Create User
            </Button>
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
              setStep('review');
            }}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setStep('review')}>
              Skip for now
            </Button>
          </Group>
        </Stack>
      )}

      {step === 'review' && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">Please review before returning to Staff Management.</Text>

          <Card withBorder padding="md">
            <List spacing="xs" size="sm">
              <List.Item><strong>Name:</strong> {createdName}</List.Item>
              <List.Item><strong>Email:</strong> {email}</List.Item>
              <List.Item><strong>Admin access:</strong> {makeAdmin ? 'Yes' : 'No'}</List.Item>
              <List.Item>
                <strong>Organization:</strong>{' '}
                {organizations.find((o) => o.id === selectedOrgId)?.name ?? '—'}
              </List.Item>
              <List.Item>
                <strong>Role(s):</strong>{' '}
                {makeAdmin
                  ? 'Hospital Admin (full access policy — no clinical role)'
                  : selectedRoles.length > 0
                    ? selectedRoles.map(roleLabel).join(', ')
                    : 'None set'}
              </List.Item>
              {!makeAdmin && specialtyText && <List.Item><strong>Specialty:</strong> {specialtyText}</List.Item>}
              {availabilityExceptions && (
                <List.Item><strong>Availability exceptions:</strong> {availabilityExceptions}</List.Item>
              )}
            </List>
          </Card>

          <Group justify="flex-end" mt="md">
            <Button onClick={() => navigate('/admin')}>Confirm & Return to Staff Management</Button>
          </Group>
        </Stack>
      )}
    </Container>
  );
}