## Medplum documentation and guide
- **Welcome to Medplum** [Medplum Docs](https://www.medplum.com/docs)

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

**Another option** `if the copied docker-compose.yml did not run`
1. Full stack container backend running on docker:
   ```bash
   git clone https://github.com/medplum/medplum.git

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

## New

- **Recommended:** `click register on the admin console login, this lets you create a project. In that project go to Project and Users. Invite New User, create the user, make it project-scoped, yes admin no MFA and email send. Click Invite. In the Users again click the newly created User and manually change the password. You now have an account for Provider-app.`

## Running Patient Portal and Provider App

1. On both directories:
   ```bash
   npm install
2. Run:
   ```bash
   npm run dev

## Initializing connections

1. On both directories:
- **Change the:** `.env.defaults` to `.env` and modify
   ```bash
   MEDPLUM_BASE_URL=http://localhost:8103/
   MEDPLUM_CLIENT_ID=<client-ID>
   MEDPLUM_PROJECT_ID=<project-ID>
   
`Connects the frontend to the container`

## File Structure and Navigation

- **Provider App:** the EHR interface built for doctors/nurses to view patients charts, document encounters and manage clinical task. 
- **Patient Portal:** portal for patients to view health records, schedule appointments, fill questionares, and message care teams.

## Repository Structure Overview

<details>
<summary>📂 <b>Click to expand Project Directory Tree</b></summary>

```text
lifex-capstone2/
├── docker-compose.yml                     # Container orchestration for local backend
├── README.md                              # Repository root documentation
├── 📁 lifex-patient-portal/               # 🧑‍🤝‍🧑 PATIENT PORTAL (Vite + React + Medplum)
│   ├── .env                               # Environment variables (Portal Client ID, API URL)
│   ├── .env.defaults                      # Default/fallback environment variables
│   ├── .gitattributes                     # Git repository attributes
│   ├── .gitignore                         # Files ignored by Git
│   ├── index.html                         # Vite HTML template
│   ├── LICENSE.txt                        # Project license
│   ├── package-lock.json                  # Exact dependency tree
│   ├── package.json                       # Portal npm packages & scripts
│   ├── postcss.config.mjs                 # Mantine UI styling configuration
│   ├── README.md                          # Patient Portal documentation
│   ├── screenshot.png                     # Application preview image
│   ├── 📁 src/                            # Source code for the Patient experience
│   │   ├── App.test.tsx                   # Tests for root component
│   │   ├── App.tsx                        # Root React component (MedplumProvider)
│   │   ├── Router.tsx                     # React Router configurations
│   │   ├── main.tsx                       # App entry point (DOM rendering)
│   │   ├── test.setup.ts                  # Testing framework configuration
│   │   ├── vite-env.d.ts                  # Vite TypeScript declarations
│   │   ├── 📁 components/                 # Patient UI components
│   │   │   ├── Footer.module.css          # Footer styles
│   │   │   ├── Footer.tsx                 # Portal footer links
│   │   │   ├── Header.module.css          # Header styles
│   │   │   ├── Header.tsx                 # Patient top navigation bar
│   │   │   ├── InfoButton.module.css      # Info button styles
│   │   │   ├── InfoButton.tsx             # UI component for tooltips/info
│   │   │   ├── InfoSection.module.css     # Info section styles
│   │   │   ├── InfoSection.tsx            # Layout component for informational text
│   │   │   ├── LineChart.tsx              # Health data visualization chart
│   │   │   ├── Loading.tsx                # Loading state indicator
│   │   │   ├── Logo.tsx                   # App branding
│   │   │   ├── SideMenu.module.css        # Side menu styles
│   │   │   └── SideMenu.tsx               # Navigation side menu
│   │   ├── 📁 img/                        # Image assets
│   │   │   ├── 📁 homePage/               # Dashboard imagery
│   │   │   └── 📁 landingPage/            # Marketing and public site imagery
│   │   ├── 📁 pages/                      # Patient page views
│   │   │   ├── GetCarePage.tsx            # View for requesting/scheduling care
│   │   │   ├── HomePage.module.css        # Dashboard styles
│   │   │   ├── HomePage.tsx               # Main health dashboard
│   │   │   ├── MessagesPage.module.css    # Messaging styles
│   │   │   ├── MessagesPage.tsx           # Direct messaging with care team
│   │   │   ├── ObservationPage.tsx        # Vitals and clinical observations view
│   │   │   ├── PatientIntakeQuestionnairePage.tsx # Intake forms for new patients
│   │   │   ├── QuestionnairePage.tsx      # General health forms
│   │   │   ├── RegisterPage.tsx           # New patient onboarding
│   │   │   ├── ScreeningQuestionnairePage.tsx # Medical screening assessments
│   │   │   ├── SignInPage.tsx             # Patient login screen
│   │   │   ├── SignOutPage.tsx            # Logout handler
│   │   │   ├── SmartHealthLinksPage.tsx   # SMART on FHIR integrations page
│   │   │   ├── 📁 account/                # Profile and account settings
│   │   │   ├── 📁 care-plan/              # Patient care plans and instructions
│   │   │   ├── 📁 health-record/          # Labs, medications, and history
│   │   │   └── 📁 landing/                # Public-facing introductory views
│   │   └── 📁 utils/                      # Helper functions
│   │       ├── communication-search.ts    # Logic for filtering messages
│   │       └── notifications.ts           # Alert and notification logic
│   ├── tsconfig.json                      # TypeScript configuration
│   ├── vercel.json                        # Deployment config for Patient Portal
│   └── vite.config.ts                     # Vite bundler & dev server config
├── 📁 lifex-provider-app/                 # 🧑‍⚕️ PROVIDER EHR APP (Vite + React + Medplum)
│   ├── .env                               # Environment variables (Provider Client ID, API URL)
│   ├── .env.defaults                      # Default/fallback environment variables
│   ├── .gitignore                         # Files ignored by Git
│   ├── index.html                         # Vite HTML template
│   ├── LICENSE.txt                        # Project license
│   ├── package-lock.json                  # Exact dependency tree
│   ├── package.json                       # Provider npm packages & scripts
│   ├── postcss.config.mjs                 # Mantine UI styling configuration
│   ├── 📁 public/                         # Static public assets
│   │   └── 📁 img/                        # Public images
│   │       └── 📁 integrations/           # Third-party integration logos
│   ├── README.md                          # Provider App documentation
│   ├── 📁 src/                            # Source code for the Clinical/EHR experience
│   │   ├── App.tsx                        # Root React component
│   │   ├── index.css                      # Global styles
│   │   ├── main.tsx                       # App entry point (DOM rendering)
│   │   ├── test.setup.ts                  # Testing framework configuration
│   │   ├── vite-env.d.ts                  # Vite TypeScript declarations
│   │   ├── 📁 components/                 # Provider UI components
│   │   │   ├── AlphaBanner.module.css     # Alpha warning banner styles
│   │   │   ├── AlphaBanner.tsx            # Banner indicating alpha/testing phase
│   │   │   ├── Calendar.module.css        # Calendar styles
│   │   │   ├── Calendar.test.tsx          # Tests for Calendar component
│   │   │   ├── Calendar.tsx               # Provider scheduling calendar UI
│   │   │   ├── DocsLink.tsx               # Link wrapper to EHR documentation
│   │   │   ├── IntegrationCard.module.css # Integration card styles
│   │   │   ├── IntegrationCard.tsx        # UI for third-party service connections
│   │   │   ├── MessageWithLinks.tsx       # Component for rendering links in secure messages
│   │   │   ├── PerformingLabInput.test.tsx# Tests for Lab Input
│   │   │   ├── PerformingLabInput.tsx     # Selector for clinical labs
│   │   │   ├── ResourceFormWithRequiredProfile.tsx # FHIR resource form builder
│   │   │   ├── utils.test.ts              # Component utility tests
│   │   │   ├── utils.ts                   # UI helper functions
│   │   │   ├── 📁 admin/                  # Practice administration UI elements
│   │   │   ├── 📁 ChargeItem/             # Billing and pricing components
│   │   │   ├── 📁 Conditions/             # Patient diagnoses/condition components
│   │   │   ├── 📁 encounter/              # Clinical visit/SOAP note components
│   │   │   ├── 📁 fax/                    # E-faxing UI components
│   │   │   ├── 📁 insurance/              # Insurance and coverage components
│   │   │   ├── 📁 labs/                   # Lab order and result components
│   │   │   ├── 📁 meds/                   # Medication and prescription components
│   │   │   ├── 📁 patient/                # Patient chart and banner components
│   │   │   ├── 📁 pharmacy/               # Pharmacy integration components
│   │   │   ├── 📁 plandefinition/         # Clinical workflow and care plan components
│   │   │   ├── 📁 schedule/               # Appointment scheduling components
│   │   │   ├── 📁 spaces/                 # Contextual clinical workspace elements
│   │   │   └── 📁 tasks/                  # Provider task list components
│   │   ├── 📁 config/                     # Provider app configurations
│   │   ├── 📁 data/                       # Static clinical data or constants
│   │   ├── 📁 hooks/                      # Custom React hooks for provider logic
│   │   ├── 📁 pages/                      # Clinical page views
│   │   │   ├── AdminDashboard.tsx         # Practice management overview
│   │   │   ├── RegisterPage.test.tsx      # Tests for provider registration
│   │   │   ├── RegisterPage.tsx           # Provider/Staff onboarding form
│   │   │   ├── SearchPage.module.css      # Search styles
│   │   │   ├── SearchPage.test.tsx        # Tests for advanced search
│   │   │   ├── SearchPage.tsx             # Advanced patient & FHIR resource search
│   │   │   ├── SignInPage.test.tsx        # Tests for provider login
│   │   │   ├── SignInPage.tsx             # Provider login screen
│   │   │   ├── 📁 admin/                  # Administrative settings pages
│   │   │   ├── 📁 encounter/              # Active patient consultation views
│   │   │   ├── 📁 fax/                    # Fax management inbox/outbox
│   │   │   ├── 📁 getstarted/             # Onboarding tutorials for staff
│   │   │   ├── 📁 integrations/           # App marketplace/integration setup
│   │   │   ├── 📁 labs/                   # Lab management dashboard
│   │   │   ├── 📁 meds/                   # Medication management views
│   │   │   ├── 📁 messages/               # Secure provider-to-patient messaging
│   │   │   ├── 📁 patient/                # Full patient chart pages
│   │   │   ├── 📁 resource/               # Dynamic FHIR resource viewer
│   │   │   ├── 📁 schedule/               # Daily schedule and calendar views
│   │   │   ├── 📁 smart/                  # SMART on FHIR app launches
│   │   │   ├── 📁 spaces/                 # Workspace contextual pages
│   │   │   ├── 📁 tasks/                  # Provider daily task lists
│   │   │   └── 📁 ...                     # Further nested clinical views
│   │   ├── 📁 test-utils/                 # Global test helpers and mocks
│   │   ├── 📁 types/                      # TypeScript definitions for FHIR/EHR data
│   │   └── 📁 utils/                      # Helper functions for clinical logic
│   ├── tsconfig.json                      # TypeScript configuration
│   ├── vercel.json                        # Deployment config for Provider App
│   └── vite.config.ts                     # Vite bundler & dev server config
```
</details>

## Medplum's Portal and Provider local host URL config

- **Admin Interface:** `localhost:3000/`
- **Provider Interface:** `localhost:3001/ or what your system provides`
- **Patient Interface:** `localhost:3002/ or what your system provides`

## Understanding Medplum

- **Admin Interface-** `this acts more like a console for FHIR than a usable UI, you only need this to make and modify "Projects", "Organizations", "Hospital Admins", "Access Policy", "JSON related inputs" (to be expanded)`

- **Provider Interface-** `this is the main interface hospital staffs uses. This will house the Hospital Admin, Clinical Staffs such as Docotors and Nurses. This should entirely be interactive UI, no FHIR code to be seen.`

- **Patient Interface-** `very straightforward interface for patients to view their medical data. In medplum's docs, they can also talk to care teams and sechedule an apointment. Take and add what ever fits the LifeX project.`

- **Project-** `this is the top-level container. Used for multi-tenancy, this isolates data and resource from other healthcare organizations`

- **User-** `this represents a global identity (project-scoped locked within a project/ server-scoped global user). Each user can house multiple roles and membership.`

- **ProjectMembership-** `the bridge that connects the User and the Project. Grants specific User access to the project. This also where in FHIR the User is identified as Patient, Practitioner, or RelatedPerson, and assigned a specific Access Policy.`

- **AccessPolicy-** `a fined-grained control mechanism that dictates exactly whatt a user can do within a project.`

- **FHIR-** `the standard for exchanging healthcare information electronically.`

- **HL7-** `a set of international standards for the transfer of clinical and administrative data between software applications.`

- **ICD-10-** `a standard system used by physicians to classify and code all diagnoses, symptoms, and procedures. Used within the likes of Condition or Encounter in Medpum system.`

`To be expanded more after Patient Portal exploration`