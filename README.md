# Hybrid Video Conferencing System

This project is a comprehensive Hybrid Video Conferencing application featuring a Rust-based backend, a React/Vite frontend, and a Python AI pipeline for transcriptions, summaries, and MOMs (Minutes of Meeting) generation.

---

## Prerequisites & Requirements

To run this system locally, the following tools and environments are required:
- **Rust** (v1.75+ recommended): For compiling and running the Backend (`kiit_backend`).
- **Node.js** (v18+ recommended): For the React Frontend and package management (`npm`).
- **Python** (v3.10+ recommended): For running the AI Services pipeline.
- **Docker & Docker Compose**: Essential for spinning up the PostgreSQL database, Zookeeper, and Kafka.
- **Kafka / Zookeeper**: Used as the event streaming backbone connecting the backend to AI services.

---

## Codebase Structure & File Explanations

### Backend (`/Backend`)
The central API and WebSocket server built with Rust (Axum) and SQLx.
- **`Cargo.toml`**: The main configuration file containing all Rust dependencies (e.g., axum, tokio, sqlx, rdkafka).
- **`src/` directory**: Contains the core logic and entry points (`main.rs`) for the backend application.
- **`docker-compose.yml`**: A required file used to start up the local Postgres database and Confluent Kafka cluster.
- **`run.ps1`**: The main execution script for safely compiling and running the backend server locally on Windows.
- **`migrations/`**: Contains the SQL schema files necessary for setting up the initial database tables.
- **`seed_analytics.sql`**: A **testing/utility file** meant to populate the database with dummy analytics data for testing the dashboards.

### Frontend (`/Frontend`)
The user interface built using React, Vite, LiveKit (for WebRTC), Tailwind CSS, and Radix UI.
- **`package.json`**: Defines all required UI libraries and scripts (`npm run dev`, `npm run build`).
- **`src/main.tsx`**: The main React entry point of the application.
- **`src/app/App.tsx` & `src/app/routes.tsx`**: Core routing files determining how pages connect.
- **`src/app/pages/`**: Contains the main dashboard views, code segments, and meeting room interfaces. 
- **`vite.config.ts`**: Tooling configuration to handle the local development server and build process.

### AI Pipeline (`/AI`)
Background workers for dealing with live transcriptions, summarization, and task extraction.
- **`requirements.txt`**: The crucial dependency list (includes `boto3`, `openai-whisper`, `confluent-kafka`).
- **`run_all_ai.ps1`**: The main execution script that launches all 5 independent AI Python services at once (STT, Transcript, Summary, MOM, Semantic) in separate terminals.
- **`common.py`, `kafka_io.py`, `storage.py`**: Shared utility modules required by all individual AI processes to interact with Kafka and databases uniformly.

---

## LMS Integration (Single Sign-On & Dashboards)

To integrate this system seamlessly with a Learning Management System (LMS) without needing a secondary login:

### 1. Connection Method (SSO)
- **Token Exchange:** The LMS generates a standard JWT (JSON Web Token) or an OAuth2 access token containing the user's session data (Name, Email, Role, LMS ID) upon LMS login.
- **Handshake:** When the user clicks "Join Meeting" or "Dashboard" within the LMS, the LMS redirects them to this application, passing the token via URL parameters or securely setting a Cross-Origin Cookie.
- **Validation:** The Rust Backend intercepts this token, verifies it against a shared secret or public key (using the `jsonwebtoken` library already present), and authenticates the user instantly.

### 2. Role-Based Redirection
The data sent from the LMS must include a **Role** identifier to route users correctly:
- **Teacher Dashboard:** If the LMS flags the user as a Teacher/Instructor, the frontend automatically bypasses login and routes them to the Teacher Dashboard. It will display teacher-specific privileges like scheduling meetings, seeing overall analytics, managing students, and starting sessions.
- **Student Dashboard:** If the LMS flags the user as a Student, they are routed directly to the specific Student Dashboard. They will have a focused view showing their upcoming scheduled classes, transcript records, and MOMs, but will be restricted from creating meetings.

---

## How to Run the System Locally

To spin up the entire hybrid application, follow these steps in sequential order.

### Step 1: Start Infrastructure
You need Docker running for this. In the `Backend` directory, start the database and Kafka:
```bash
cd Backend
docker-compose up -d
```

### Step 2: Start the Backend (Rust)
Once Docker containers are healthy, open a new terminal in the `Backend` directory and execute the run script:
```powershell
.\run.ps1
```

### Step 3: Start the AI Services (Python)
In a separate terminal, navigate to the `AI` folder, set up your Python environment, and start the processing pipeline:
```bash
cd AI
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```
Run all services parallelly using the provided PowerShell script:
```powershell
.\run_all_ai.ps1
```

### Step 4: Start the Frontend (Node.js)
Open a final terminal in the `Frontend` directory to launch the User Interface:
```bash
cd Frontend
npm install
npm run dev
```

The system will now be fully operational on your local machine.
