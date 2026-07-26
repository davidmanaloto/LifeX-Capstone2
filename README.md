## Prerequisites

- **Windows:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux / macOS:** [Docker](https://docs.docker.com/get-docker/)

## Getting Started

1. Create and navigate to your project directory:
   ```bash
   mkdir <folder-name>
   cd <folder-name>
2. Clone repository:
   ```bash
   git clone <repository-url>

## Running Medplum

- **On a terminal**
1. Run container:
   ```bash
   docker compose up -d
2. Stop container:
   ```bash
   docker compose down

## Default Admin Credentials

- **Email:** `admin@example.com`
- **Password:** `medplum_admin`

## Running Patient Portal and Provider App

1. On both directories:
   ```bash
   npm install
2. Run:
   ```bash
   npm run dev

## Initializing connections

1. On both directories:
- **Change the:** .env.defaults to .env and modify
   ```bash
   MEDPLUM_BASE_URL=http://localhost:8103/
Connects the frontend to the container

## File Structure and Navigation

- **Provider App:** the EHR interface built for doctors/nurses to view patients charts, document encounters and manage clinical task. 
- **Patient Portal:** portal for patients to view health records, schedule appointments, fill questionares, and message care teams.

## Repository Structure Overview

<details>
<summary>📂 <b>Click to expand Project Directory Tree</b></summary>

```text
LIFEX-CAPSTONE/
├── 📁 lifex-patient-portal/               # 🧑‍🤝‍🧑 PATIENT PORTAL (Vite + React + Medplum)
│   ├── 📁 public/                         # Static icons, favicons, public assets
│   ├── 📁 src/                            # Source code for the Patient experience
│   │   ├── 📁 components/                 # Patient UI components (Header, PatientNav, HealthCards)
│   │   │   ├── Header.tsx                 # Patient top navigation bar & profile menu
│   │   │   ├── Footer.tsx                 # Portal footer links
│   │   │   └── Layout.tsx                 # Patient AppShell wrapper
│   │   ├── 📁 pages/                      # Patient page views
│   │   │   ├── HomePage.tsx               # Health dashboard & care summary
│   │   │   ├── AppointmentsPage.tsx       # Self-scheduling & upcoming visits
│   │   │   ├── MessagesPage.tsx           # Direct messaging with care team
│   │   │   ├── HealthRecordPage.tsx       # Labs, medications, and immunization history
│   │   │   ├── SignInPage.tsx             # Patient login screen
│   │   │   └── RegisterPage.tsx           # New patient onboarding form
│   │   ├── App.tsx                        # Root React component (MedplumProvider, MantineProvider)
│   │   ├── AppRoutes.tsx                  # React Router definitions for Patient routes
│   │   ├── main.tsx                       # App entry point (DOM rendering)
│   │   └── main.css                       # Styles & CSS overrides
│   ├── .env                               # Environment variables (Portal Client ID, API URL)
│   ├── .env.defaults                      # Default/fallback environment variables
│   ├── index.html                         # Vite HTML template
│   ├── package.json                       # Portal npm packages & scripts
│   ├── postcss.config.mjs                 # Mantine UI styling configuration
│   ├── tsconfig.json                      # TypeScript config
│   ├── vercel.json                        # Deployment config for Patient Portal
│   └── vite.config.ts                     # Vite bundler & dev server config
│
├── 📁 lifex-provider-app/                 # 🧑‍⚕️ PROVIDER EHR APP (Vite + React + Medplum)
│   ├── 📁 public/                         # Static icons, branding assets
│   ├── 📁 src/                            # Source code for the Clinical/EHR experience
│   │   ├── 📁 components/                 # Provider UI components (PatientBanner, ChartTabs)
│   │   │   ├── Header.tsx                 # Provider top bar (global patient search, profile)
│   │   │   ├── SideMenu.tsx               # Left clinical navigation menu (Queue, Patients, Calendar)
│   │   │   └── Layout.tsx                 # Clinical AppShell layout container
│   │   ├── 📁 pages/                      # Clinical page views
│   │   │   ├── HomePage.tsx               # Daily provider schedule & task list
│   │   │   ├── PatientPage.tsx            # Dynamic patient chart view (`/Patient/:id/*`)
│   │   │   ├── EncounterPage.tsx          # Active consultation documentation (SOAP notes)
│   │   │   ├── ResourcePage.tsx           # Dynamic FHIR resource viewer/editor
│   │   │   └── SearchPage.tsx             # Advanced patient search & filtering
│   │   ├── App.tsx                        # Root React component (MedplumProvider, MantineProvider)
│   │   ├── AppRoutes.tsx                  # React Router definitions for Provider routes
│   │   ├── main.tsx                       # App entry point (DOM rendering)
│   │   └── main.css                       # Styles & CSS overrides
│   ├── .env                               # Environment variables (Provider Client ID, API URL)
│   ├── .env.defaults                      # Default/fallback environment variables
│   ├── index.html                         # Vite HTML template
│   ├── package.json                       # Provider npm packages & scripts
│   ├── postcss.config.mjs                 # Mantine UI styling configuration
│   ├── tsconfig.json                      # TypeScript config
│   ├── vercel.json                        # Deployment config for Provider App
│   └── vite.config.ts                     # Vite bundler & dev server config
│
├── docker-compose.yml                     # Local backend or container orchestration
└── README.md                              # Repository root documentation
```
</details>

## Medplum's Portal and Provider local host URL config

- **Admin Interface:** `localhost:3000/`
- **Provider Interface:** `localhost:3001/ or what your system provides`
- **Note that "Provider" expects the following:** `localhost:3001/signin?project=<project-ID>`