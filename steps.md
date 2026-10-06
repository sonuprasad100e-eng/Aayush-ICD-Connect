# Care Sync (Aayush-ICD-Connect) — Complete Backend & Database Deployment Guide

This guide provides step-by-step instructions for running the backend locally, connecting it to a database (local MongoDB or free MongoDB Atlas in the cloud), and deploying the backend to production services like Render or Railway.

---

## Table of Contents
1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Quick Start (Local Run with Zero-Config In-Memory DB)](#2-quick-start-local-run-with-zero-config-in-memory-db)
3. [Connecting to MongoDB Atlas (Free Cloud Database)](#3-connecting-to-mongodb-atlas-free-cloud-database)
4. [Connecting to Local MongoDB](#4-connecting-to-local-mongodb)
5. [Database Seeding & Preloaded Demo Data](#5-database-seeding--preloaded-demo-data)
6. [Deploying Backend to Cloud (Render / Railway)](#6-deploying-backend-to-cloud-render--railway)
7. [Frontend & Backend Integration Details](#7-frontend--backend-integration-details)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Troubleshooting & FAQs](#9-troubleshooting--faqs)

---

## 1. Project Overview & Architecture

Care Sync bridges AYUSH clinical practice and modern healthcare using standardized dual-coding:
- **NAMASTE Codes** (National AYUSH Morbidity and Standardized Terminologies Electronic portal)
- **ICD-11 TM2 Codes** (Traditional Medicine Module 2)
- **ICD-11 Biomedicine Equivalents**
- **FHIR R4 Condition Resources**

### Project Layout
```
SEM 5 MiniProject/
├── specs.md                          # Technical specification
├── steps.md                          # This deployment guide
└── Aayush-ICD-Connect/
    ├── client/                       # Frozen frontend UI (HTML/CSS/JS)
    │   ├── index.html                # Login page
    │   ├── dashboard.html            # Main overview & metrics
    │   ├── patients.html             # Patient registry (CRUD & FHIR)
    │   ├── mapping.html              # AYUSH ↔ ICD-11 search & mapping
    │   ├── diagnoses.html            # AYUSH diagnosis catalog
    │   ├── reports.html              # Morbidity analytics & claims
    │   ├── settings.html             # Profile & doctor preferences
    │   ├── style.css                 # CSS styles (unchanged)
    │   └── script.js                 # Extended with authenticated API fetch calls
    └── server/                       # Production-grade Node.js / Express backend
        ├── package.json              # Backend dependencies
        ├── .env                      # Environment configuration
        ├── .env.example              # Sample environment file
        ├── uploads/                  # Local uploaded profile photos
        └── src/
            ├── app.js                # Express app configuration & middlewares
            ├── server.js             # HTTP server entry point & graceful shutdown
            ├── config/
            │   ├── db.js             # MongoDB connection (with in-memory fallback)
            │   ├── env.js            # Environment variable loader
            │   └── uploads.js         # Multer configuration for file uploads
            ├── middleware/
            │   ├── auth.js           # JWT verification middleware
            │   ├── validate.js       # express-validator result handler
            │   └── errorHandler.js   # Centralized error handler
            ├── models/
            │   ├── User.js           # Doctor account schema
            │   ├── Patient.js        # Patient records schema
            │   ├── Diagnosis.js      # AYUSH diagnosis library schema
            │   ├── Mapping.js        # Confirmed dual-coding mappings schema
            │   ├── Report.js         # Generated reports schema
            │   └── AnalyticsSnapshot.js # Analytics & morbidity breakdown schema
            ├── services/
            │   ├── authService.js    # Auth, bcrypt hashing, JWT issuance
            │   ├── patientService.js # Patient CRUD & search
            │   ├── diagnosisService.js # Diagnosis library search & filter
            │   ├── mappingService.js # AYUSH ↔ ICD-11 search & confidence
            │   ├── reportService.js  # Aggregation & trends
            │   ├── settingsService.js# Profile & preferences management
            │   └── fhirService.js    # Minimal FHIR R4 Condition builder
            ├── controllers/
            │   ├── authController.js
            │   ├── dashboardController.js
            │   ├── patientController.js
            │   ├── diagnosisController.js
            │   ├── mappingController.js
            │   ├── reportController.js
            │   └── settingsController.js
            ├── routes/
            │   ├── authRoutes.js
            │   ├── dashboardRoutes.js
            │   ├── patientRoutes.js
            │   ├── diagnosisRoutes.js
            │   ├── mappingRoutes.js
            │   ├── reportRoutes.js
            │   └── settingsRoutes.js
            └── seed/
                └── seedDemoData.js   # Seeds demo data matching original HTML
```

---

## 2. Quick Start (Local Run with Zero-Config In-Memory DB)

The backend features an **automatic in-memory MongoDB fallback** (`mongodb-memory-server`). If you do not have MongoDB installed or configured, the server starts an embedded database automatically and seeds all initial demo data on startup!

### Step 1: Open a Terminal & Navigate to Server Directory
```powershell
cd "c:\Users\Admin\OneDrive\Desktop\SEM 5 MiniProject\Aayush-ICD-Connect\server"
```

### Step 2: Install Dependencies (if not already installed)
```powershell
npm install
```

### Step 3: Start the Server
```powershell
npm start
```
*(Or use `npm run dev` for auto-reloading on code changes).*

### Step 4: Open the Application in Your Browser
Visit:
```
http://localhost:8000
```
The Express server serves the frontend files statically directly from the `client/` folder!

### Default Demo Credentials
- **Email:** `sonu@caresync.in` *(or `doctor@caresync.in`)*
- **Password:** `password123`
- **ABHA ID:** `12-3456-7890-1234`

---

## 3. Connecting to MongoDB Atlas (Free Cloud Database)

MongoDB Atlas provides a free cloud-hosted MongoDB database cluster (512 MB storage, M0 Sandbox tier) which is accessible from anywhere and ideal for deployment.

### Step 1: Create a Free MongoDB Atlas Account
1. Visit [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Sign up with Google or your email.

### Step 2: Build a Free Cluster
1. In the Atlas dashboard, click **"Create"** or **"Build a Database"**.
2. Select the **M0 Free (Shared)** tier.
3. Choose a provider and region closest to you (e.g., AWS / Mumbai `ap-south-1`).
4. Click **"Create Deployment"**.

### Step 3: Set Up Database User & Network Access
1. **Database Access**:
   - Create a database user (e.g., username `caresync_admin` and set a strong password like `CareSyncSecure2026!`).
   - Assign the built-in role **"Read and write to any database"**.
2. **Network Access**:
   - Go to **Network Access** in the left sidebar.
   - Click **"Add IP Address"**.
   - Select **"Allow Access from Anywhere"** (`0.0.0.0/0`) so that both your local machine and your cloud deployment (Render/Railway) can connect.
   - Click **Confirm**.

### Step 4: Get Your Connection String
1. Go to **Database Deployments** in the sidebar.
2. Click **"Connect"** next to your cluster.
3. Choose **"Drivers"** (Node.js).
4. Copy the connection string. It will look like:
   ```
   mongodb+srv://caresync_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
5. Replace `<password>` with the password you created in Step 3.1.
6. Add the database name `caresync` right before the query parameters:
   ```
   mongodb+srv://caresync_admin:CareSyncSecure2026!@cluster0.abcde.mongodb.net/caresync?retryWrites=true&w=majority
   ```

### Step 5: Configure the Server `.env` File
Open `Aayush-ICD-Connect/server/.env` and update `MONGODB_URI`:
```ini
PORT=8000
NODE_ENV=development
CLIENT_URL=http://localhost:8000

MONGODB_URI=mongodb+srv://caresync_admin:CareSyncSecure2026!@cluster0.abcde.mongodb.net/caresync?retryWrites=true&w=majority
JWT_SECRET=care_sync_super_secret_jwt_key_2026
```

### Step 6: Restart the Backend Server
```powershell
npm start
```
The server will print:
```
[DB] Attempting connection to MongoDB at: mongodb+srv://caresync_admin:****@cluster0...
[DB] Successfully connected to MongoDB.
[Seed] Seeding Care Sync demo data...
[Seed] Demo data seeding complete!
Care Sync Backend running at: http://localhost:8000
```
Your database is now cloud-hosted and persistent across server restarts!

---

## 4. Connecting to Local MongoDB

If you have MongoDB Community Server installed locally on your Windows machine:

1. Ensure the MongoDB service is running:
   ```powershell
   net start MongoDB
   ```
2. Open `Aayush-ICD-Connect/server/.env` and set:
   ```ini
   MONGODB_URI=mongodb://127.0.0.1:27017/caresync
   ```
3. Run the backend:
   ```powershell
   npm start
   ```

---

## 5. Database Seeding & Preloaded Demo Data

The backend includes a dedicated seed script (`src/seed/seedDemoData.js`) that automatically seeds:
- **1 Doctor Account**: Dr. Sonu (`sonu@caresync.in`, password `password123`)
- **5 Patients**:
  - `P001`: Snehan Naicker (Age 20, Cancer, `AYU-1187` ↔ `2A00`, Critical)
  - `P002`: Anuj Nadar (Age 22, Diabetes, `AYU-0568` ↔ `5A11`, Stable)
  - `P003`: Arjun Patil (Age 42, Prameha, `AYU-0042` ↔ `SP70`, Stable)
  - `P004`: Rekha Sharma (Age 35, Vata Imbalance, `AYU-0117` ↔ `SP71`, Review)
  - `P005`: Divya Nair (Age 29, Pitta Excess, `AYU-0093` ↔ `SP72`, Stable)
- **6 Standardized AYUSH Diagnoses**:
  - Jwara (Fever) — Ayurveda (`AYU-0011` ↔ `MG26`)
  - Kasa (Cough) — Ayurveda (`AYU-0034` ↔ `MD12`)
  - Prameha (Diabetes) — Ayurveda (`AYU-0042` ↔ `5A11`)
  - Vata Dosha Imbalance — Yoga & Naturopathy (`AYU-0117` ↔ `SP70`)
  - Su-e-Mizaj — Unani (`AYU-0205` ↔ `SP80`, Partial FHIR)
  - Vali Noi — Siddha (`AYU-0261` ↔ `SP85`)
- **Recently Mapped Codes**: Jwara, Kasa, Prameha, Pitta Excess, Ama
- **Reports & Analytics Snapshots**: Precomputed morbidity breakdown and monthly volume trends

To manually re-seed at any time:
```powershell
npm run seed
```

---

## 6. Deploying Backend to Cloud (Render / Railway)

### Method A: Deploy on Render.com (Recommended Free Tier)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Add Care Sync backend and database integration"
   git push origin main
   ```
2. **Create a Web Service on Render**:
   - Go to [https://render.com](https://render.com) and log in.
   - Click **"New +"** → **"Web Service"**.
   - Connect your GitHub repository.
3. **Configure Settings**:
   - **Name**: `caresync-api`
   - **Root Directory**: `Aayush-ICD-Connect/server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. **Add Environment Variables**:
   In the "Environment Variables" section on Render, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render handles this automatically)
   - `JWT_SECRET`: `your_random_secure_32_character_secret_key`
   - `MONGODB_URI`: `your_mongodb_atlas_connection_string_from_step_3`
   - `CLIENT_URL`: `https://your-app-name.onrender.com`
5. **Click "Create Web Service"**:
   Render will build the project and launch your backend with SSL (`https://...`).
   Because Express serves `client/` statically, your entire Care Sync web app will run live at `https://your-service-name.onrender.com/`!

---

### Method B: Deploy on Railway.app

1. Go to [https://railway.app](https://railway.app) and sign in with GitHub.
2. Click **"New Project"** → **"Deploy from GitHub repo"**.
3. Select your repository.
4. In **Settings**:
   - Set **Root Directory** to `Aayush-ICD-Connect/server`.
5. In **Variables**, add:
   - `MONGODB_URI`: (Your Atlas connection string)
   - `JWT_SECRET`: (Your secret key)
   - `NODE_ENV`: `production`
6. Click **Deploy**. Railway will assign a public domain (e.g. `caresync.up.railway.app`).

---

## 7. Frontend & Backend Integration Details

The frontend code (`Aayush-ICD-Connect/client/`) remains 100% faithful to the original visual design:
- HTML structure, CSS rules, classes, and layouts were **never modified**.
- `script.js` was cleanly extended with standard fetch wrappers that attach the JWT token:
  ```javascript
  const token = localStorage.getItem('careSyncToken');
  // Authorization: Bearer <token>
  ```
- **Login Flow**:
  - `POST /api/auth/login` returns `{ access_token, user }`.
  - Stored in `localStorage.careSyncToken` and `localStorage.careSyncUser`.
  - Automatically redirects to `dashboard.html`.
- **Protected Pages**:
  - If a user tries to access any protected page (`dashboard.html`, `patients.html`, etc.) without a valid token, they are immediately redirected to `index.html`.
- **Live Hydration**:
  - On page load, `script.js` fetches live data from the backend and populates the existing DOM elements, seamlessly replacing hardcoded static data with live records from MongoDB.

---

## 8. API Endpoints Reference

All endpoints (except login and health) require the HTTP header:
`Authorization: Bearer <access_token>`

### Authentication
| Method | Endpoint | Description | Public? |
|---|---|---|---|
| `POST` | `/api/auth/login` | Login with email or ABHA ID & password | Yes |
| `GET` | `/api/auth/me` | Get current doctor's profile | No |
| `POST` | `/api/auth/change-password` | Update doctor password | No |
| `POST` | `/api/auth/register` | Register new doctor (admin/testing) | Yes |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Live counts (patients, diagnoses, mappings) & recent patients |

### Patients
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/patients?search=&status=&page=&limit=` | Filterable & paginated patient list |
| `POST` | `/api/patients` | Create a new patient with dual codes |
| `GET` | `/api/patients/:id` | Get patient details by ID or patientCode |
| `PUT` | `/api/patients/:id` | Update patient record |
| `DELETE` | `/api/patients/:id` | Soft delete patient |
| `GET` | `/api/patients/:id/fhir` | **Minimal FHIR R4 Condition resource** |

### Diagnoses Library
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/diagnoses?system=&search=` | Browse catalog filtered by AYUSH system |
| `POST` | `/api/diagnoses` | Create diagnosis catalog entry |
| `GET` | `/api/diagnoses/:id` | Get single diagnosis |
| `PUT` | `/api/diagnoses/:id` | Update diagnosis |
| `DELETE` | `/api/diagnoses/:id` | Delete diagnosis |

### Disease Mapping
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/mapping/search?term=` | AYUSH-term search returning NAMASTE + TM2 + Biomedicine + Confidence |
| `POST` | `/api/mapping/confirm` | Confirm dual-coding and persist to database |
| `GET` | `/api/mapping/recent?limit=` | List of recently mapped dual codes |
| `GET` | `/api/mapping/stats` | Mapping stats (mapped count, unmapped, confidence) |
| `POST` | `/api/mapping/bulk-upload` | Multipart file upload for CSV/XLSX bulk mapping |

### Reports & Analytics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reports/overview` | Total diagnoses, approval/rejection rates, YTD codes |
| `GET` | `/api/reports/system-breakdown` | AYUSH system percentage distribution (for bar chart) |
| `GET` | `/api/reports/trend?months=` | Monthly dual-coding volume series (for trend chart) |
| `GET` | `/api/reports/files` | Downloadable reports list |

### Settings
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Get profile, 2FA, preferences, and notifications |
| `PUT` | `/api/settings/profile` | Update name, specialization, email, ABHA ID |
| `POST` | `/api/settings/photo` | Upload profile photo (JPG/PNG max 2MB) |
| `PUT` | `/api/settings/security` | Toggle 2FA on/off |
| `PUT` | `/api/settings/preferences` | Set language, default AYUSH system, dark mode |
| `PUT` | `/api/settings/notifications` | Toggle critical alerts, claim updates, weekly summary |

---

## 9. Troubleshooting & FAQs

### Q: The server started, but I see `[DB] No MONGODB_URI provided`?
**A:** This is completely normal and intentional. The backend has an automatic fallback to `mongodb-memory-server`. It starts an embedded MongoDB in RAM, seeds demo data, and runs without any configuration. To make your data persist permanently across server restarts, provide a `MONGODB_URI` from MongoDB Atlas in `.env`.

### Q: How do I test the FHIR R4 Condition endpoint?
**A:** With the server running, send a GET request with your token to:
`http://localhost:8000/api/patients/P001/fhir`
You will receive a valid HL7 FHIR R4 `Condition` JSON object containing coordinated coding systems for NAMASTE (`http://namaste.ayush.gov.in`) and ICD-11 (`http://id.who.int/icd/release/11/mms`).

### Q: Port 8000 is already in use?
**A:** You can change the port in `Aayush-ICD-Connect/server/.env` by setting `PORT=8080` (or any free port).

### Q: How to clear the session if login gets stuck?
**A:** In your browser, open Developer Tools (F12) → **Application** tab → **Local Storage** → delete `careSyncToken` and `careSyncUser`, then refresh the page.
