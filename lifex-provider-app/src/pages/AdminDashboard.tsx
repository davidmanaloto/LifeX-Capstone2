import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import type { Practitioner, Patient } from '@medplum/fhirtypes';
import { Tabs, Table, Loader, Text, Title, Container, Alert } from '@mantine/core';
import { useAdminAccess } from '../hooks/useAdminAccess';

export function AdminDashboard(): JSX.Element {
  const medplum = useMedplum();
  const isAdmin = useAdminAccess();

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  // Only fetch admin data if the user actually has access
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function loadData(): Promise<void> {
      const [practitionerResults, patientResults] = await Promise.all([
        medplum.searchResources('Practitioner'),
        medplum.searchResources('Patient'),
      ]);
      setPractitioners(practitionerResults);
      setPatients(patientResults);
      setLoading(false);
    }

    loadData().catch((err) => {
      console.error('Failed to load admin dashboard data', err);
      setLoading(false);
    });
  }, [isAdmin, medplum]);

  // Gate: non-admins see an access-denied message, nothing else
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
        Hospital Admin Dashboard
      </Title>

      <Tabs defaultValue="practitioners">
        <Tabs.List>
          <Tabs.Tab value="practitioners">Practitioners ({practitioners.length})</Tabs.Tab>
          <Tabs.Tab value="patients">Patients ({patients.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="practitioners" pt="md">
          {practitioners.length === 0 ? (
            <Text c="dimmed">No practitioners found.</Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>ID</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {practitioners.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      {p.name?.[0]?.given?.join(' ')} {p.name?.[0]?.family}
                    </Table.Td>
                    <Table.Td>{p.id}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="patients" pt="md">
          {patients.length === 0 ? (
            <Text c="dimmed">No patients found.</Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>ID</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {patients.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      {p.name?.[0]?.given?.join(' ')} {p.name?.[0]?.family}
                    </Table.Td>
                    <Table.Td>{p.id}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}