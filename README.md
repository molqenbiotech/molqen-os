# 🧬 MOLQEN OS

**Academic Biotechnology Research Core & Electronic Lab Operating System**

[![React](https://img.shields.io/badge/React-19.x-61dafb.svg?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28.svg?logo=firebase&logoColor=black)](https://firebase.google.com)
[![GLP Audit](https://img.shields.io/badge/Compliance-21%20CFR%20Part%2011%20Ready-2d6a4f.svg)](#glp-compliance--security)
[![Oxlint Clean](https://img.shields.io/badge/Oxlint-0%20Warnings-10b981.svg)](https://oxc.rs)

MOLQEN OS is an end-to-end laboratory information and operational suite engineered specifically for academic biotech cores, university institutes, and wet-lab research facilities. It unifies chemical inventory tracking, instrument reservation, electronic lab notebooks (ELN), 96-well plate design, scientific calculations, and live AI bench copilot assistance into a unified, tactile workspace.

---

## 🌟 Key Features

### 1. 🧪 Bench Operations
* **Chemical & Reagent Management**: Real-time inventory tracking with CAS registry lookups, storage temperatures, min-stock thresholds, and automatic PubChem SDS links.
* **Optical QR & Barcode Scanner**: In-browser camera scanning to instantly identify bottles, log deductions, and print custom barcode stickers.
* **Equipment Scheduler**: Calendar and reservation slots for high-demand equipment (Autoclaves, HPLC, Real-Time PCR, Centrifuges).
* **96-Well Plate Designer**: Interactive microplate grid matrix with concentration gradient fills, replicates mapping, and assay layout export.
* **Electronic Lab Notebook (ELN)**: Structured protocol logging with reaction MasterMix auto-scalers, environmental telemetry, and 21 CFR Part 11 compliant digital cryptographic locking.
* **Voice Protocol Reader (Sterile Mode)**: Hands-free step-by-step audio protocol reader powered by the Web Speech API for laminar flow hoods and sterile cleanrooms.

### 2. ⚗️ In-Silico & Analytics
* **Molarity & Dilution Calculator**: Mass-volume molarity, $C_1V_1 = C_2V_2$ serial dilution suites, and unit conversions.
* **Curve Fitting & Regression Studio**: Interactive Chart.js plotting with linear regression, polynomial trendlines, $R^2$ determination, and publication-ready export.
* **MOLQEN AI Copilot**: Streaming scientific assistant trained on molecular biology protocols, thermocycler programs, and reaction formulations.

### 3. 👥 Administration & GLP Compliance
* **Live Presence Monitoring**: Heartbeat telemetry showing active bench researchers across connected terminals.
* **Multi-Lab Switching**: Instant workspace isolation with 6-character accession codes for faculty PIs, postdocs, and student interns.
* **Manuscripts & DOI Tracker**: Track manuscripts from drafting to revision, sync CrossRef DOIs, and export Word documents.
* **Grant Ledger & Burn-Rate**: Monitor grant budgets, track consumable burn rates, and forecast procurement needs.
* **Vendor & Procurement Manager**: Vendor directory with one-click purchase order requisition generators.
* **Archival & Handover**: Complete institutional knowledge transfer when lab scholars graduate.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19, JSX, React Strict Mode |
| **Build & Bundler** | Vite 8 + Rolldown engine with optimized vendor code-splitting |
| **Database & Auth** | Google Firebase Firestore (Real-time snapshot streams) + Firebase Authentication |
| **AI Bench Engine** | Google Gemini API (Interactions streaming) + Local Memory Feedback |
| **Data & Visuals** | Chart.js, React-ChartJS-2, KaTeX math typesetting, Mammoth, Docx, SheetJS (XLSX) |
| **Micro-Interactions** | Tactile mechanical spring physics, Nordic Sage design language |
| **Quality & Linting** | Oxlint (0 warnings, 0 errors) |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/labnexus.git
cd labnexus

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` to explore the workspace.

---

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env.local
```

Configure your API credentials:

```ini
# Firebase Authentication & Database
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef

# Google Gemini API for MOLQEN Scientific AI
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GEMINI_MODEL=gemini-3.8-flash

# Cloudinary Cloud Storage for Gel Images, Microscopy & Protocol Attachments
VITE_CLOUDINARY_CLOUD_NAME=k4qswf4f
VITE_CLOUDINARY_UPLOAD_PRESET=molqen_uploads
```

---

## 📦 Production Build & Optimization

MOLQEN OS is pre-configured with multi-chunk vendor splitting:

```bash
# Verify code health with oxlint
npm run lint

# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

### Bundle Chunk Profile
* `vendor-firebase`: Isolated Firebase authentication & Firestore client
* `vendor-charts`: Chart.js & data visualization runtime
* `vendor-markdown-math`: KaTeX math typesetting & markdown parsing
* `vendor-docs`: Docx & SheetJS document parsers
* `index`: Core application logic

---

## 🛡️ GLP Compliance & Security

* **Cryptographic Sign-Off**: Once locked, electronic lab notebook entries compute an immutable signature hash with signer metadata to prevent retroactive alterations.
* **Role-Based Isolation**: Faculty PIs maintain administrative authority over stock deletion, membership admission, and hazardous chemical permissions.
* **Defensive Error Boundary**: Session isolation ensures client-side render anomalies in complex modules do not disrupt synchronized bench data or crash other open modules.

---

## 📄 License

Proprietary Academic & Commercial License. All rights reserved.
Developed for modern biotechnology, genetics, and pharmaceutical research institutions.
