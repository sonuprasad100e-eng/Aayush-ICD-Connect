# Care Sync

Care Sync is a frontend prototype for an AYUSH and ICD-11 dual-coding platform. It presents a healthcare workspace for managing patients, reviewing diagnoses, mapping diseases between coding systems, and viewing reports.

## Features

- Login screen with email/ABHA ID and password visibility toggle
- Dashboard with patient, diagnosis, and mapping summaries
- Patient list and patient record overview
- Disease mapping workspace for AYUSH and ICD-11 codes
- Diagnosis tracking view
- Reports and analytics view
- Settings and clinic profile view
- Responsive sidebar navigation with a mobile menu
- Shared scroll-reveal and navigation interactions

## Pages

| Page | File | Purpose |
| --- | --- | --- |
| Login | `index.html` | Entry screen for the Care Sync workspace |
| Dashboard | `dashboard.html` | Overview of patients, diagnoses, mappings, and recent activity |
| Patients | `patients.html` | Browse patient records |
| Disease Mapping | `mapping.html` | Map AYUSH diagnoses to ICD-11 codes |
| Diagnoses | `diagnoses.html` | Review recorded diagnoses |
| Reports | `reports.html` | View healthcare reports and analytics |
| Settings | `settings.html` | Manage profile and application settings |

## Getting Started

### Requirements

- A modern web browser
- An internet connection for CDN-hosted stylesheets, fonts, scripts, and images

### Run locally

1. Clone or download this repository.
2. Open the project folder in VS Code.
3. Open `index.html` in a browser, or serve the folder with any static web server.

For example, with Python installed:

```bash
python -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000) and select the login screen.

## Project Structure

```text
Aayush-ICD-Connect/
├── index.html       # Login screen
├── dashboard.html   # Dashboard
├── patients.html    # Patient management
├── mapping.html     # Disease mapping
├── diagnoses.html   # Diagnosis records
├── reports.html     # Reports and analytics
├── settings.html    # Application settings
├── script.js        # Shared browser interactions
└── style.css        # Shared styles
```

## Technology

- HTML5
- CSS3
- JavaScript
- Bootstrap 5.3.3 via CDN
- Font Awesome 6.5.1 via CDN
- Google Fonts: Poppins and Inter

## Current Scope

This repository contains a static frontend demonstration. The forms, navigation, statistics, and records are currently presentation-oriented and do not connect to a backend, database, authentication provider, FHIR server, or live coding API.

## License

No license has been specified for this project yet.
