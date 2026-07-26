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

- **Email:** admin@example.com
- **Password:** medplum_admin

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

- **Provider App:**
   ```bash
 the EHR interface built for doctors/nurses to view patients charts, document encounters and manage clinical task. 
