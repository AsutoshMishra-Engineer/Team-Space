# 🚀 TeamSpace — Enterprise Collaborative Workspace & Operations Hub

<div align="center">

<img src="public/logo.png" alt="TeamSpace Logo" width="120" style="border-radius: 24px; box-shadow: 0 8px 32px rgba(108, 99, 255, 0.35);" />

### *Modern All-in-One Collaborative Platform for Engineering Teams, Agile Workgroups & Student Cohorts*

[![Production Status](https://img.shields.io/badge/Production-Live%20on%20Cloudflare-success?style=for-the-badge&logo=cloudflare&logoColor=white)](https://teamspace204.asutoshm359.workers.dev)
[![Android App](https://img.shields.io/badge/Android%20App-Download%20APK%20(v1.0.1)-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/AsutoshMishra-Engineer/Team-Space/releases/download/v1.0.1-android/app-debug.apk)
[![GitHub Releases](https://img.shields.io/badge/Releases-v1.0.1--android-blue?style=for-the-badge&logo=github&logoColor=white)](https://github.com/AsutoshMishra-Engineer/Team-Space/releases)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%26%20RLS-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20Edge%20API-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Grok AI](https://img.shields.io/badge/Grok%20AI-LPU%20Intelligence%20Engine-FF6F00?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com/)

**[🌐 Live Production Website](https://teamspace204.asutoshm359.workers.dev)** • **[📱 Download Android App (.apk)](https://github.com/AsutoshMishra-Engineer/Team-Space/releases/download/v1.0.1-android/app-debug.apk)** • **[📦 All Releases](https://github.com/AsutoshMishra-Engineer/Team-Space/releases)**

</div>

---

## 📖 Overview

**TeamSpace** is an all-in-one collaborative workspace engineered to streamline team execution. It consolidates team messaging, multi-format media repositories, compulsory-deadline announcements with mandatory sign-offs, a 6-state agile task management pipeline, leader-governed attendance and contribution auditing, a social-media style media inspection lightbox, and a dedicated AI Work Studio into a single fast, responsive, and secure Progressive Web Application (PWA) alongside an official Native Android App.

Deployed globally on the **Cloudflare Workers Edge Network**, backed by **Supabase PostgreSQL with strict Row Level Security (RLS)**, and delivered to mobile devices via **Google Firebase Cloud Messaging (FCM)** and **W3C Web Push**.

---

## 🔗 Quick Links & Downloads

| Platform | Access Link | Description |
| :--- | :--- | :--- |
| **Production Web App** | [teamspace204.asutoshm359.workers.dev](https://teamspace204.asutoshm359.workers.dev) | Globally accelerated PWA on Cloudflare Workers edge network |
| **Android APK (Direct)** | [Download v1.0.1 APK (6.4 MB)](https://github.com/AsutoshMishra-Engineer/Team-Space/releases/download/v1.0.1-android/app-debug.apk) | Standalone Android package with background push notifications & file uploads |
| **GitHub Releases** | [Releases & Changelogs](https://github.com/AsutoshMishra-Engineer/Team-Space/releases) | Full build history, release assets, and release summaries |
| **GitHub Source Code** | [GitHub Repository](https://github.com/AsutoshMishra-Engineer/Team-Space) | Complete open codebase for Web and Android apps |

---

## ✨ Core Feature Highlights

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             TEAMSPACE ECOSYSTEM                             │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ 📢 Announcements     │ 📋 Smart Tasks       │ ⚡ AI Work Studio             │
│ • Mandatory Sign-Off │ • 6-State Lifecycle  │ • Full-Screen Single Page     │
│ • Push Reminders     │ • DoD Checklists     │ • Zero-Token Work Guardrail   │
│ • Leader Audit Table │ • Leader Review/Req  │ • Code & Schema Synthesis     │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ 👥 Attendance & Work │ 🔔 WhatsApp-Style    │ 📁 Drive & Media Lightbox     │
│ • Leader-Exclusive   │ • Real Sender Names  │ • In-Browser Social Preview   │
│ • Verified Notes     │ • Closed-App Delivery│ • Photos, Videos, Audio, PDFs │
│ • Monthly Analytics  │ • High-Priority Vibe │ • Inspect Before Download     │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

### 1. 👤 Compulsory Member Identity & Real Names
* **Non-Dismissible Setup Modal:** Automatically detects any member without a verified name or whose name is set to a raw user ID (e.g., `981EF23`), gating access until a real display name is provided.
* **Live Initials Avatar Generator:** Dynamically renders real-time circular avatar previews based on typed names (e.g. `AM` for *Asutosh Mishra*).
* **Live Notification Preview Card:** Displays a live WhatsApp / Android notification tray mockup showing members exactly how their announcements and messages will appear on teammates' phones.
* **Compulsory Signup Registration:** All new member sign-ups require full names upfront, immediately populating the user profile upon email verification.
* **Self-Service Updates:** Members can change their display name anytime in **Preferences → Account Details**.

### 2. 🔔 WhatsApp & Instagram-Style Push Notification Architecture
* **Real Sender Name Headers:** System notifications display the author's real name instead of raw IDs or generic placeholders:
  * **Announcements:** `📢 Asutosh Mishra • TeamSpace` with message body.
  * **Team Chat:** `💬 Asutosh Mishra • TeamSpace` with chat message text.
  * **Task Assignments:** `📋 Asutosh Mishra • TeamSpace` with task title, priority, and deadline.
  * **Review Submissions:** `👀 Asutosh Mishra • TeamSpace` with review status.
  * **Attendance Logs:** `⏱️ Asutosh Mishra • TeamSpace` with verified session title.
* **Closed-Browser Background Delivery:** Runs on Google Firebase Cloud Messaging (FCM) and Cloudflare Workers (`/api/send-push`), alerting members even when the browser or Android app is completely closed.
* **Android Notification Channels:** High-priority channel with custom vibration sequences (`[0, 300, 200, 300]`), heads-up alerts, and lock-screen display.

### 3. 📁 Social-Media Style File & Media Preview Lightbox
* **Inspect Before Downloading:** Eliminates blind downloads by allowing users to preview, read, watch, or listen to files directly in the browser or APK.
* **Photos & Images:** Full-resolution lightbox with zoom, uploader badge, upload date, and responsive file grid thumbnails.
* **Videos:** Native HTML5 video player with playback scrub bar, volume, and full-screen controls.
* **PDF Documents:** Embedded PDF viewer with page inspection, combined with a Google Docs Viewer embed and a direct `↗️ Open in New Tab` button.
* **Audio & Voice Notes:** Audio card with playback controls and track duration.
* **Code & Text Files (`.js`, `.py`, `.sql`, `.json`, `.txt`, `.md`):** Syntax-formatted code reader with line numbers and a 1-click `📋 Copy All` button.

### 4. 📢 Announcement Acknowledgement & Sign-Off System
* **Compulsory Deadlines & Priorities:** Every announcement requires an actionable deadline with options for *Normal*, *Important*, or *Mandatory Acknowledgement*.
* **Member Sign-Off Interface:** Clear acknowledgment button recording exact timestamps and member IDs to prevent disputes.
* **Leader Audit Dashboard:** Real-time sign-off progress bars, member-wise status tables (*Acknowledged* vs *Pending* with timestamps), and a 1-click **"Send Push Reminder to Pending Members"** action.

### 5. 📋 Smart Task Management System (6-State Agile Pipeline)
* **6-State Engineering Workflow:**
  $$\text{Assigned} \longrightarrow \text{Accepted} \longrightarrow \text{In Progress} \longrightarrow \text{Review Pending} \longrightarrow \begin{cases} \text{Completed} \\ \text{Changes Requested} \end{cases}$$
* **Definition of Done (DoD):** Interactive checklist items required before work can be submitted for review.
* **Submission & Review Cycle:** Members submit deliverable notes and repository links; team leaders review, approve, or reject with actionable feedback.
* **Priority & Deadline Alerts:** Automated visual cues for Overdue, Critical, and Approaching milestones.

### 6. 👥 Leader-Exclusive Attendance & Contribution Tracking
* **Strict Role Enforcement:** Exclusively team leaders can log, verify, or modify daily attendance records.
* **Operational Statuses:** `Present` (1.0), `Partial Contribution` (0.5), `Absent` (0.0), `Excused / Leave`.
* **Contribution & Task Notes:** Leaders log daily deliverables and tag records as verified.
* **Audit Trail & Analytics:** Automatic logging of who marked and modified attendance, accompanied by monthly attendance percentage summaries and date filters.

### 7. ⚡ AI Chatbot — Powered by Grok AI Engine (`/workspace/ai`)
* **Grok AI Critical Thinking:** Backed by Grok AI reasoning architecture and ultra-fast LPU inference (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`), engineered for critical evaluation, edge-case detection, and code synthesis.
* **Direct & Signal-Focused:** Answers strictly what is asked with zero conversational fluff, highlighting critical engineering observations in crisp, organized bullet points.
* **Single-Page Viewport Layout:** Matches modern conversational AI tools with `100vh` zero outer-scroll design, smooth internal message stream scrolling, and a pinned bottom input console.
* **Zero-Token Client Guardrail:** Intercepts casual or entertainment queries client-side before touching the network, preserving 100% of API tokens and returning an instant workplace refocus reminder.
* **Export & Tools:** 1-click Markdown (`.md`) export, session reset, and copyable syntax-highlighted code blocks.

### 8. 🌐 Integrated Dashboard Google Search
* Dedicated Google Search bar integrated directly into the Dashboard (`/workspace`) for rapid technical documentation lookup, web research, and external reference without leaving the app layout.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18.3 + Vite 6.4 | Fast component architecture, JSX rendering, and dev server |
| **Performance** | React.lazy() + Rollup manualChunks | Route-level code splitting (`LandingPage` 4.8 kB, `LoginPage` 6.2 kB) |
| **Edge Compute & Host** | Cloudflare Workers + Static Assets | Serverless edge API routing, push dispatch & single-page app hosting |
| **AI Intelligence** | Grok AI / Groq LPU Engine | High-speed LLM reasoning with critical thinking for engineering and code workflows |
| **Database & Auth** | Supabase (PostgreSQL 15) | Relational storage, Auth, RPC functions & strict Row Level Security |
| **Realtime Engine** | Supabase Realtime | WebSocket channels for live team chat and status broadcasts |
| **Media Cloud Storage** | Cloudinary / Supabase Storage | Encrypted upload, storage, and in-browser preview of files |
| **Push Notification Protocol** | Web Push API + VAPID (RFC 8291/8292) | Closed-browser Android and desktop push notification delivery |
| **Native Android Wrapper** | Kotlin, Android SDK 34 (minSdk 26) | Native WebView wrapper, FCM service, notification channels, file picker |
| **Styling & Design System** | Pure Vanilla CSS (CSS3 Variables) | Zero heavy UI frameworks, 7 Accent themes, 7 Background atmospheric themes |

---

## 📱 Native Android App Architecture

The repository includes a production-ready Android wrapper located in the [`android/`](android/) directory:

* **Package ID:** `com.teamspace.app`
* **Target SDK:** Android 14 (API 34) • **Minimum SDK:** Android 8.0 Oreo (API 26)
* **Custom WebView Engine ([`MainActivity.kt`](android/app/src/main/java/com/teamspace/app/MainActivity.kt)):**
  * `textZoom = 100` & `useWideViewPort = false` to eliminate font collision caused by Android system accessibility scaling.
  * WebChromeClient with `onShowFileChooser` enabling native Android file selection for drive uploads.
  * Swipe-to-refresh (`SwipeRefreshLayout`) and hardware back-button history navigation.
* **Background FCM Service ([`MyFirebaseMessagingService.kt`](android/app/src/main/java/com/teamspace/app/MyFirebaseMessagingService.kt)):**
  * Intercepts data and notification payloads from Cloudflare Workers.
  * Builds high-priority heads-up notifications with vibration patterns (`longArrayOf(0, 300, 200, 300)`).
  * Auto-caches registration tokens and bridges them to the web layer via `TeamSpaceNative.getNativeFcmToken()`.
* **Automated CI/CD Compilation ([`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml)):**
  * Builds unsigned debug APKs on GitHub Actions runners with Gradle 8.2 and JDK 17.
  * Automatically uploads build artifacts and publishes official GitHub Releases.

---

## 📂 Project Directory Structure

```
├── android/                             # Native Android App (Kotlin + Gradle)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/teamspace/app/
│   │   │   │   ├── MainActivity.kt      # WebView controller & JS interface bridge
│   │   │   │   └── MyFirebaseMessagingService.kt # FCM background notification service
│   │   │   ├── res/                     # Icons, drawables, layouts, and colors
│   │   │   └── AndroidManifest.xml      # App permissions, intents & FCM declaration
│   │   └── build.gradle.kts             # App dependencies & SDK versions
│   ├── gradle/wrapper/                  # Official Gradle 8.2 wrapper binaries
│   └── build.gradle.kts                 # Project-level Gradle build configuration
│
├── public/
│   ├── logo.png                         # TeamSpace brand icon (512x512)
│   ├── sw.js                            # PWA Service Worker for Web Push
│   └── manifest.json                    # Web App Manifest for mobile installation
│
├── src/
│   ├── components/                      # Modular UI Components
│   │   ├── CompulsoryNameModal.jsx      # Non-dismissible verified member name setup
│   │   ├── Announcements.jsx            # Announcements feed, priorities & sound chimes
│   │   ├── AnnouncementAcknowledgement.jsx # Member sign-offs & leader audit table
│   │   ├── TeamChat.jsx                 # Real-time WebSocket team chat with push dispatch
│   │   ├── SmartTasks.jsx               # 6-state agile task workflow & DoD checklist
│   │   ├── SharedFiles.jsx              # Cloud drive with social-media media preview lightbox
│   │   ├── WorkAttendance.jsx           # Leader attendance & contribution logging
│   │   ├── PersonalTodos.jsx            # Private personal task list with deadlines
│   │   ├── PersonalSettings.jsx         # 7 Accent themes, 7 Background themes & name editor
│   │   ├── GoogleSearchBar.jsx          # Dashboard Google web search bar
│   │   ├── NotificationPreferences.jsx  # Web Push subscription manager & diagnostic test
│   │   └── Layout.jsx                   # Global app navbar, network status & footer
│   │
│   ├── context/
│   │   └── AuthContext.jsx              # Supabase session, profile & theme state
│   ├── lib/
│   │   ├── supabase.js                  # Supabase client singleton
│   │   ├── pushService.js               # Web Push VAPID registration & Cloudflare dispatch
│   │   └── groqService.js               # AI inference client with work-only guardrail
│   ├── pages/                           # Route Pages (Lazy-loaded via React.lazy)
│   │   ├── LandingPage.jsx              # Public landing page with APK download link
│   │   ├── LoginPage.jsx                # Multi-mode login (User ID / Email)
│   │   ├── RegisterPage.jsx             # Compulsory name + email account registration
│   │   ├── AuthCallbackPage.jsx         # PKCE email verification & User ID display
│   │   ├── MyTeamsPage.jsx              # Dashboard listing user teams & Google search
│   │   ├── TeamWorkspacePage.jsx        # Team workspace tabs (Feed, Tasks, Attendance, Files)
│   │   ├── CreateTeamPage.jsx           # Team creation with auto-generated invite codes
│   │   ├── JoinTeamPage.jsx             # Team joining by 6-digit code or request
│   │   └── AIStudioPage.jsx             # Dedicated AI Work Studio workspace
│   │
│   ├── App.jsx                          # Route definitions, Suspense & ErrorBoundary
│   ├── index.css                        # 6,000+ lines of responsive mobile-first CSS
│   ├── main.jsx                         # React root entry & Notification polyfill
│   └── worker-shim.js                   # Cloudflare Worker backend API (/api/send-push)
│
├── supabase/                            # PostgreSQL Database Schemas & Migrations
│   ├── schema.sql                       # Complete table schemas, RLS policies & triggers
│   ├── add-profile-fields.sql           # Username, display name & avatar migrations
│   ├── add-work-attendance.sql          # Attendance sessions & audit logging tables
│   ├── add-acknowledgements.sql         # Announcement sign-off tables & RPC functions
│   └── fix-relationships.sql            # Foreign key relations for profiles join queries
│
├── .github/workflows/
│   └── build-apk.yml                    # Automated GitHub Actions workflow for APK builds
├── wrangler.jsonc                       # Cloudflare Workers deployment configuration
├── vite.config.js                       # Vite configuration with Rollup code-splitting chunks
└── package.json                         # Node dependencies and build scripts
```

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js:** v18.0.0 or higher
* **npm:** v9.0.0 or higher
* **Supabase Account:** Free project with PostgreSQL database

### 1. Clone Repository
```bash
git clone https://github.com/AsutoshMishra-Engineer/Team-Space.git
cd Team-Space
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# VAPID Web Push Key
VITE_VAPID_PUBLIC_KEY=your-public-vapid-key

# AI Engine Key (Optional)
VITE_GROQ_API_KEY=your-ai-api-key

# Cloudinary Storage (Optional)
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-upload-preset
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Production Build
```bash
npm run build
```

### 6. Deploy to Cloudflare Workers
```bash
npm run deploy
# or: npx wrangler deploy
```

---

## 🛡️ Security & Privacy Architecture

* **Database Row Level Security (RLS):** Every table in Supabase (`team_members`, `announcements`, `chat_messages`, `team_tasks`, `work_attendance_records`, `team_files`) is protected by strict PostgreSQL RLS policies ensuring users can only read and write data belonging to workspaces they are an active member of.
* **Role-Governed Actions:** Privileged operations (announcement deletion, task approvals, attendance logging, member removal) verify `isLeader` server-side via SQL RPC functions.
* **VAPID Cryptographic Verification:** All Web Push dispatches are signed using an ECDH P-256 keypair, preventing unauthorized push spoofing.
* **Client-Side Work Guardrail:** Zero-token filters intercept unauthorized or casual prompts before sending requests to external intelligence gateways.

---

## 📄 License & Attribution

This project is open-source and developed by [Asutosh Mishra](https://github.com/AsutoshMishra-Engineer). All rights reserved.
