import { Group, Stack, Text } from '@mantine/core';
import { calculateAgeString, formatAddress } from '@medplum/core';
import type { PatientSummarySectionConfig, SectionRenderContext } from '@medplum/react';
import { IconCake, IconEmpathize, IconLanguage, IconMapPin } from '@tabler/icons-react';
import type { JSX, ReactNode } from 'react';

function DemoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string | undefined }): JSX.Element {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      {icon}
      <Stack gap={0}>
        <Text size="xs" c="dimmed">{label}</Text>
        <Text size="sm" c={value ? undefined : 'dimmed'}>
          {value ?? `Add ${label}`}
        </Text>
      </Stack>
    </Group>
  );
}

// Same as Medplum's built-in DemographicsSection, minus the Race & Ethnicity
// row — not applicable outside the US regulatory context it was built for.
// Fully self-contained: no dependency on @medplum/react internals, since
// PatientInfoItem and its formatting helpers aren't publicly exported.
export const DemographicsSectionNoRaceEthnicity: PatientSummarySectionConfig = {
  key: 'demographics',
  title: 'Demographics',
  component: ({ patient }: SectionRenderContext) => {
    const preferredLanguage = patient.communication?.find((c) => c.preferred)?.language;
    const languageDisplay = preferredLanguage?.coding?.[0]?.display ?? preferredLanguage?.text;

    return (
      <Stack gap="sm" py={8}>
        <DemoRow
          icon={<IconCake size={16} stroke={2} color="var(--mantine-color-gray-6)" />}
          label="Birthdate & Age"
          value={patient.birthDate ? `${patient.birthDate} (${calculateAgeString(patient.birthDate)})` : undefined}
        />
        <DemoRow
          icon={<IconEmpathize size={16} stroke={2} color="var(--mantine-color-gray-6)" />}
          label="Gender"
          value={patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : undefined}
        />
        <DemoRow
          icon={<IconMapPin size={16} stroke={2} color="var(--mantine-color-gray-6)" />}
          label="Location"
          value={patient.address?.[0] ? formatAddress(patient.address[0]) : undefined}
        />
        <DemoRow
          icon={<IconLanguage size={16} stroke={2} color="var(--mantine-color-gray-6)" />}
          label="Language"
          value={languageDisplay}
        />
      </Stack>
    );
  },
};