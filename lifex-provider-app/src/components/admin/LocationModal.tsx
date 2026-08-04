import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { Modal, TextInput, Button, Stack, Alert, Select } from '@mantine/core';
import type { Location, Organization } from '@medplum/fhirtypes';

const PHYSICAL_TYPES = [
  { value: 'bu', label: 'Building' },
  { value: 'wi', label: 'Wing' },
  { value: 'wa', label: 'Ward' },
  { value: 'lvl', label: 'Floor / Level' },
  { value: 'co', label: 'Corridor' },
  { value: 'ro', label: 'Room' },
  { value: 'bd', label: 'Bed' },
];

interface LocationModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  location?: Location;
  organizations: Organization[];
  locations: Location[];
}

export function LocationModal({
  opened,
  onClose,
  onSuccess,
  location,
  organizations,
  locations,
}: LocationModalProps): JSX.Element {
  const medplum = useMedplum();
  const isEditMode = Boolean(location);

  const [name, setName] = useState('');
  const [physicalType, setPhysicalType] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [partOfId, setPartOfId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setName(location?.name ?? '');
      setPhysicalType(location?.physicalType?.coding?.[0]?.code ?? null);
      setOrganizationId(
        location?.managingOrganization?.reference?.replace('Organization/', '') ?? organizations[0]?.id ?? null
      );
      setPartOfId(location?.partOf?.reference?.replace('Location/', '') ?? null);
      setDescription(location?.description ?? '');
      setError(null);
    }
  }, [opened, location, organizations]);

  async function handleSubmit(): Promise<void> {
    if (!name.trim()) {
      setError('Please enter a location name.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const physicalTypeConcept = physicalType
        ? {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
                code: physicalType,
                display: PHYSICAL_TYPES.find((t) => t.value === physicalType)?.label,
              },
            ],
          }
        : undefined;

      const payload: Partial<Location> = {
        resourceType: 'Location',
        name: name.trim(),
        physicalType: physicalTypeConcept,
        managingOrganization: organizationId ? { reference: `Organization/${organizationId}` } : undefined,
        partOf: partOfId ? { reference: `Location/${partOfId}` } : undefined,
        description: description.trim() || undefined,
      };

      if (isEditMode && location) {
        await medplum.updateResource({ ...location, ...payload });
      } else {
        await medplum.createResource({ ...payload, status: 'active' } as Location);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} location`, err);
      setError('Something went wrong. Check the console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  // Exclude the location itself (can't be its own parent) from the "Part of" options.
  const partOfOptions = locations
    .filter((l) => l.id !== location?.id)
    .map((l) => ({ value: l.id ?? '', label: l.name ?? 'Unnamed' }));

  return (
    <Modal opened={opened} onClose={onClose} title={isEditMode ? 'Edit location' : 'New location'} centered>
      <Stack>
        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        <TextInput
          label="Name"
          placeholder="e.g. Emergency Ward, Room 204, ICU Bed 4"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Select
          label="Type"
          placeholder="Select a type"
          data={PHYSICAL_TYPES}
          value={physicalType}
          onChange={setPhysicalType}
        />

        <Select
          label="Organization"
          data={organizations.map((org) => ({ value: org.id ?? '', label: org.name ?? 'Unnamed' }))}
          value={organizationId}
          onChange={setOrganizationId}
        />

        {partOfOptions.length > 0 && (
          <Select
            label="Part of (optional)"
            placeholder="e.g. which building/floor this belongs to"
            data={partOfOptions}
            value={partOfId}
            onChange={setPartOfId}
            clearable
          />
        )}

        <TextInput
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />

        <Button onClick={handleSubmit} loading={submitting} fullWidth mt="sm">
          {isEditMode ? 'Save Changes' : 'Create'}
        </Button>
      </Stack>
    </Modal>
  );
}