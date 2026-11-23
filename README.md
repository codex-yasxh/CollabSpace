# CollabSpace

Real-time collaborative document editor.

## Prerequisites

- **Node.js** (v20+ recommended)
- **Docker & Docker Compose** (ensure Docker Desktop is running before starting dev servers)

> **Important**: Every time you reboot your machine, start Docker Desktop before running `npm run dev`.

## Environment & Canonical Dev URL

- **Canonical dev URL**: `http://localhost:5173`
- Both `http://localhost:5173` and `http://127.0.0.1:5173` are supported in dev and configured in `ALLOWED_ORIGINS`.
- **Note on multiple windows**: Always use the **same** host (`http://localhost:5173`) across demo windows. Mixing `localhost` and `127.0.0.1` will separate cookie jars and fail session sharing.

## Quick Start

1. Start Postgres:
   ```bash
   docker compose up -d
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run database migrations:
   ```bash
   npm run migrate
   ```

4. Start both client and server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure & Architecture

- `client/`: React + Vite + TypeScript single-page application
- `server/`: Express + TypeScript backend (REST API & Yjs collaboration server)
- `server/migrations/`: SQL migration files
