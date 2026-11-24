# SkipSense v1.1 – AI-Powered Skipping Counter

SkipSense is a local-first, privacy-focused, AI-powered skipping counter web application. It uses real-time human pose estimation running entirely inside your mobile browser to track full-body skeletal movement, count completed jumps on confirmed landings, automatically manage workout state, and persist workout sessions to a local SQLite database.

### 🚀 What's New in v1.1 (Jump Accuracy & Sensitivity Optimization)
- **Dynamic Grounded Baseline**: Adapts automatically as the user skips on the balls of their feet, preventing the static baseline trap that previously caused missed landing detections.
- **Tuned for Real Skipping Cycles**: Lowered takeoff (`0.045`) and airborne (`0.080`) thresholds to reliably detect small rapid skipping jumps (2-5cm) at 120-180+ RPM.
- **Low-Latency Movement Smoother**: Increased EMA alpha to `0.65` and upgraded velocity derivative to eliminate phase lag and peak attenuation.
- **Comprehensive Real-Time Debug Panel**: Developer overlay displaying live FPS, inference rates, dynamic baseline, velocities, airborne duration, movement direction (UP/DOWN/STABLE), and historical state transitions with rejection reasons.
- **Debounced Tracking Loss**: 4-frame grace window protects against momentary motion blur dropouts during fast rope revolutions.
- **Centralized Jump Configuration**: All parameters exposed in `frontend/src/config/jumpConfig.ts`.

---

## 🌟 Key Features

- **100% On-Device AI Inference**: All computer vision and pose estimation runs in real-time inside your iPhone browser via MediaPipe Tasks Vision. No video or camera streams are sent to the backend or cloud.
- **Landing-Based Jump Counting**: Jump counting triggers strictly on verified ground landing following a confirmed airborne phase. Eliminates double-counting and takeoff false-positives.
- **False-Detection Rejection**: Filters out walking, bending knees, arm waving, body sway, and camera adjustment.
- **5-Second Auto-Pause & Auto-Resume**: Automatically pauses the workout timer when you stop jumping for 5 seconds without resetting the session. Automatically resumes counting when jumping restarts.
- **Apple Fitness Dark Aesthetic**: Clean UI featuring high-contrast neon green (`#39E66B`), dark obsidian background (`#090B0D`), and large legible typography.
- **Local Network & HTTPS**: Configured with `mkcert` and local IPv4 binding so you can open the application on your iPhone from anywhere on your home Wi-Fi network.
- **Offline Capable**: Pretrained MediaPipe `pose_landmarker_lite.task` and WebAssembly binaries are bundled locally in the project repository.
- **Workout Analytics & History**: Tracks active duration, rest duration, cadence (jumps/minute), peak pace, and saves full workout history in SQLite (`data/skipsense.db`).

---

## 🏗️ System Architecture

```
[ iPhone / Mobile Safari ]
  ├── Front-facing camera (1280x720 / 640x480)
  ├── MediaPipe Pose Landmarker (33 Body Landmarks)
  ├── Canvas Skeleton Overlay
  ├── Landing-Based State Machine (GROUNDED -> TAKEOFF -> AIRBORNE -> LANDING -> COUNTED)
  └── Workout UI & Auto-Pause Timer
            │
            │ Local Wi-Fi (HTTPS on port 5173)
            ▼
[ Windows Laptop Server ]
  ├── Vite Frontend Server (Port 5173)
  │     └── Reverse Proxy /api ──► FastAPI (Port 8000)
  ├── FastAPI Python 3.13 Backend (Uvicorn)
  └── SQLite Database (data/skipsense.db)
```

---

## 📋 Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Lucide Icons, Canvas API, WebRTC / `getUserMedia`
- **Computer Vision**: Google MediaPipe Tasks Vision (`@mediapipe/tasks-vision`), Pose Landmarker Lite
- **Backend**: Python 3.13, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2
- **Database**: SQLite
- **Security / Network**: `mkcert` Local Root CA & HTTPS Certificates, Vite Proxy
- **Testing**: Vitest (17 frontend unit & lifecycle tests), Pytest (6 backend API & database tests)

---

## 🚀 Quick Start Guide

### 1. Prerequisites

Ensure the following are installed on your Windows machine:
- **Python 3.13** (or 3.10+)
- **Node.js** (v18+) and **npm**
- **mkcert** (installed automatically or via `winget install FiloSottile.mkcert`)

### 2. Start SkipSense

Simply double-click `start.bat` in the project root (or run from PowerShell):

```cmd
start.bat
```

The script will:
1. Verify Python and Node.js environments.
2. Initialize the Python virtual environment (`.venv`) and install dependencies if needed.
3. Detect your laptop's current active Wi-Fi LAN IPv4 address.
4. Generate mkcert SSL certificates for `localhost` and your LAN IP.
5. Launch the FastAPI backend and Vite HTTPS frontend.
6. Display the exact URLs for both laptop and iPhone access.

Example startup banner:
```
====================================
          SKIPSENSE SERVER          
====================================

Backend API:
  http://127.0.0.1:8000

Frontend (Laptop):
  https://localhost:5173

iPhone Access (Same Wi-Fi):
  https://192.168.0.7:5173

Status: RUNNING
====================================
```

### 3. Stop SkipSense

To shut down all backend and frontend services safely, double-click `stop.bat` or run:

```cmd
stop.bat
```

---

## 📱 iPhone Wi-Fi & HTTPS Setup

Mobile Safari requires a secure context (HTTPS) to allow camera access through `navigator.mediaDevices.getUserMedia`.

### Step 1: Connect to Same Wi-Fi
Make sure your iPhone and your Windows laptop are connected to the same Wi-Fi network.

### Step 2: Install Local CA Certificate on iPhone
1. On your iPhone Safari, visit `https://<LAPTOP_LAN_IP>:5173/rootCA.pem` (or AirDrop `certificates/rootCA.pem` from laptop to iPhone).
2. Tap **Allow** when prompted: *"This website is trying to download a configuration profile"*.
3. Go to iPhone **Settings** -> **Profile Downloaded** (or **Settings** -> **General** -> **VPN & Device Management**).
4. Tap **mkcert...** and tap **Install** in the top right corner.
5. Go to iPhone **Settings** -> **General** -> **About** -> **Certificate Trust Settings**.
6. Under **Enable full trust for root certificates**, switch the **mkcert** toggle to **ON**.

### Step 3: Open SkipSense on iPhone
1. Open Safari on iPhone and navigate to:
   ```
   https://<LAPTOP_LAN_IP>:5173
   ```
2. When prompted, tap **Allow** to grant access to the front-facing camera.
3. Tap **START WORKOUT**.
4. Stand back so your full body is visible in the frame.
5. Once your position is calibrated, a 3-second countdown will start, the border will turn **neon green**, and you can begin skipping!

---

## 🔥 Windows Firewall Troubleshooting

If your iPhone cannot connect to the laptop IP address:
1. Open Windows PowerShell as Administrator.
2. Allow incoming connections on port 5173 and 8000:
   ```powershell
   New-NetFirewallRule -DisplayName "SkipSense Frontend" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "SkipSense Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
   ```
3. Ensure your Wi-Fi network profile in Windows is set to **Private Network** (Settings -> Network & Internet -> Wi-Fi -> Properties).

---

## 🧪 Testing and Verification

### Frontend Unit Tests (Vitest)

The jump detection algorithm and workout manager are thoroughly tested with 17 automated tests covering simulated real-world scenarios:

```cmd
cd frontend
npm test
```

Tested Scenarios:
- ✅ Standing still for 10 seconds: 0 jumps
- ✅ Walking (alternating leg lifts with level torso): 0 jumps
- ✅ Bending knees / squatting: 0 jumps
- ✅ Moving / waving arms: 0 jumps
- ✅ One complete jump: exactly 1 jump
- ✅ Ten consecutive jumps: exactly 10 jumps
- ✅ Twenty consecutive jumps: exactly 20 jumps
- ✅ Fast consecutive jumps: refractory period prevents duplicate counts
- ✅ Missing ankle landmarks: suspends detection
- ✅ Low-confidence landmarks: suspends detection
- ✅ Camera tracking loss: preserves count without resetting
- ✅ Landing confirmation: counts strictly on landing, not takeoff or airborne
- ✅ Workout timer active / rest tracking
- ✅ 3-second countdown transition
- ✅ 5-second inactivity auto-pause
- ✅ Automatic resume on next jump

### Backend API Tests (Pytest)

Run the backend test suite:

```cmd
$env:PYTHONPATH="."
.\.venv\Scripts\pytest.exe -v
```

Tested Endpoints & Operations:
- ✅ Health check (`/api/health`)
- ✅ Workout creation (`POST /api/workouts`)
- ✅ Workout retrieval by ID (`GET /api/workouts/{id}`)
- ✅ List all workouts (`GET /api/workouts`)
- ✅ Aggregate lifetime statistics (`GET /api/stats`)
- ✅ Workout deletion (`DELETE /api/workouts/{id}`)
- ✅ Input validation & 404/422 error handling

---

## 🛠️ Project Structure

```
SkipSense/
├── backend/
│   ├── database.py              # SQLite engine & session setup
│   ├── models.py                # SQLAlchemy WorkoutSession model
│   ├── schemas.py               # Pydantic schemas (WorkoutCreate, WorkoutResponse, StatsResponse)
│   ├── routers/
│   │   ├── workouts.py          # CRUD endpoints (/api/workouts)
│   │   └── stats.py             # Performance stats endpoint (/api/stats)
│   ├── tests/
│   │   └── test_backend.py      # Pytest backend test suite
│   ├── main.py                  # FastAPI application entry point
│   └── requirements.txt         # Python dependencies
│
├── frontend/
│   ├── public/
│   │   ├── models/
│   │   │   └── pose_landmarker_lite.task  # Pretrained MediaPipe model (bundled locally)
│   │   ├── wasm/                          # MediaPipe Vision WebAssembly binaries
│   │   ├── favicon.svg
│   │   └── rootCA.pem                     # CA Certificate for direct mobile download
│   │
│   ├── src/
│   │   ├── camera/
│   │   │   └── cameraManager.ts           # Front camera, getUserMedia & error handling
│   │   ├── pose/
│   │   │   ├── poseDetector.ts            # MediaPipe PoseLandmarker service
│   │   │   ├── poseProcessor.ts           # Body positioning, bounds & stability checks
│   │   │   └── skeletonRenderer.ts        # Canvas 33-landmark skeleton renderer
│   │   ├── counter/
│   │   │   ├── movementSmoother.ts        # EMA smoothing & velocity estimation
│   │   │   ├── stateMachine.ts            # Jump state machine (GROUNDED -> AIRBORNE -> LANDING)
│   │   │   ├── jumpDetector.ts            # Landing-based jump detection algorithm
│   │   │   └── __tests__/                 # Vitest jump detector unit tests
│   │   ├── workout/
│   │   │   ├── workoutTimer.ts            # Active / rest timer & cadence calculation
│   │   │   ├── workoutManager.ts          # State coordination & 5-second auto-pause
│   │   │   ├── workoutService.ts          # API & LocalStorage offline sync
│   │   │   └── __tests__/                 # Workout lifecycle tests
│   │   ├── components/
│   │   │   ├── DebugPanel.tsx             # Developer debug panel overlay
│   │   │   └── DeleteModal.tsx            # Confirmation modal for record deletion
│   │   ├── pages/
│   │   │   ├── HomePage.tsx               # Screen A: Apple Fitness dashboard & stats
│   │   │   ├── WorkoutPage.tsx            # Screen B: Live camera, skeleton & huge counter
│   │   │   ├── SummaryPage.tsx            # Screen C: Workout completion summary
│   │   │   └── HistoryPage.tsx            # Screen D: Workout history list & details
│   │   ├── styles/
│   │   │   └── theme.css                  # Apple Fitness color theme & animations
│   │   ├── types/
│   │   │   ├── pose.ts                    # Landmark definitions & debug types
│   │   │   └── workout.ts                 # Session and stats data types
│   │   ├── App.tsx                        # Screen routing & state coordinator
│   │   └── main.tsx                       # React application bootstrap
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts                     # HTTPS config & FastAPI proxy route
│
├── certificates/                          # mkcert SSL certificates (cert.pem, key.pem, rootCA.pem)
├── data/                                  # Persistent SQLite storage (skipsense.db)
├── scripts/
│   ├── start_server.ps1                   # Startup PowerShell orchestrator
│   └── stop_server.ps1                    # Shutdown PowerShell script
├── start.bat                              # One-click Windows startup
├── stop.bat                               # One-click Windows stop
├── .gitignore
└── README.md
```

---

## 🔒 Privacy & Local-First Guarantee

- All AI vision models and WebAssembly modules run locally within the browser engine on your device.
- Video streams and individual camera frames are NEVER sent over the network or saved to disk.
- Only numerical workout metadata (timestamps, jump counts, durations, and calculated cadence) is stored in the local SQLite database on your laptop.

---

## 📄 License

MIT License. Designed and developed for fitness enthusiasts and developers.

