# 🚀 TeamSpace — Enterprise Collaborative Workspace & Operations Hub

<div align="center">

<img src="public/logo.png" alt="TeamSpace Logo" width="120" style="border-radius: 24px; box-shadow: 0 8px 32px rgba(108, 99, 255, 0.35);" />

### *Zero-Trust Collaborative Platform for Engineering Teams, Agile Workgroups & Student Cohorts*

[![Production Status](https://img.shields.io/badge/Production-Live%20on%20Cloudflare-success?style=for-the-badge&logo=cloudflare&logoColor=white)](https://teamspace204.asutoshm359.workers.dev)
[![Security](https://img.shields.io/badge/Security-Zero--Trust%20Edge%20%26%20RLS-7c3aed?style=for-the-badge&logo=shield&logoColor=white)](#-security--zero-trust-architecture)
[![Android App](https://img.shields.io/badge/Android%20App-Download%20APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/AsutoshMishra-Engineer/Team-Space/releases/latest)
[![GitHub Releases](https://img.shields.io/badge/Releases-Latest%20Build-blue?style=for-the-badge&logo=github&logoColor=white)](https://github.com/AsutoshMishra-Engineer/Team-Space/releases)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%26%20RLS-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20Edge%20API-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Grok AI](https://img.shields.io/badge/Grok%20AI-LPU%20Intelligence%20Engine-FF6F00?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com/)

**[🌐 Live Production Website](https://teamspace204.asutoshm359.workers.dev)** • **[📱 Download Android App (.apk)](https://github.com/AsutoshMishra-Engineer/Team-Space/releases/latest)** • **[📦 All Releases](https://github.com/AsutoshMishra-Engineer/Team-Space/releases)**

</div>

---

## 📖 Overview

**TeamSpace** is a security-hardened, all-in-one collaborative workspace engineered to streamline team execution. It unifies real-time WebSocket chat, private signed cloud file storage with an in-browser preview lightbox, compulsory-deadline announcements with auditable member sign-offs, a 6-state agile task pipeline, leader-governed attendance tracking, and a server-proxied AI Work Studio inside a Progressive Web Application (PWA) and Native Android App.

Deployed globally on the **Cloudflare Workers Edge Network**, backed by **Supabase PostgreSQL with column-protected Row Level Security (RLS)**, and delivered to mobile devices via **W3C Web Push (VAPID)** and **Google Firebase Cloud Messaging (FCM HTTP v1)**.

---

## 🔗 Quick Links & Downloads

| Platform | Access Link | Description |
| :--- | :--- | :--- |
| **Production Web App** | [teamspace204.asutoshm359.workers.dev](https://teamspace204.asutoshm359.workers.dev) | Globally accelerated PWA on Cloudflare Workers with CSP & HSTS headers |
| **Android APK (Latest)** | [Download Latest APK](https://github.com/AsutoshMishra-Engineer/Team-Space/releases/latest) | Hardened Kotlin WebView + FCM push notifications & native file picker |
| **GitHub Releases** | [Releases & Changelogs](https://github.com/AsutoshMishra-Engineer/Team-Space/releases) | Full build history, release assets, and version summaries |
| **GitHub Source Code** | [GitHub Repository](https://github.com/AsutoshMishra-Engineer/Team-Space) | Complete source code for React SPA, Cloudflare Worker, SQL & Android |

---

## ✨ Core Feature Highlights

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             TEAMSPACE ECOSYSTEM                             │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ 📢 Announcements     │ 📋 Smart Tasks       │ ⚡ AI Work Studio             │
│ • Mandatory Sign-Off │ • 6-State Lifecycle  │ • Authenticated /api/ai Proxy │
│ • Targeted Push      │ • DoD Checklists     │ • Client + Server Guardrails  │
│ • Leader Audit Table │ • Leader Review/Req  │ • Code & Schema Synthesis     │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ 👥 Attendance & Work │ 🔔 Smart Push Alerts │ 📁 Private Drive & Lightbox   │
│ • Leader-Exclusive   │ • Real Sender Names  │ • Private 300s Signed URLs    │
│ • Verified Notes     │ • Preference Filters │ • Local PDF, Video & Code View│
│ • Immutable Audit Log│ • Same-Origin Links  │ • Inspect Before Download     │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

### 1. 👤 Compulsory Member Identity & Real Names
* **Non-Dismissible Setup Modal:** Automatically detects any member without a verified name or whose name matches a raw User ID (e.g., `981EF23`), gating access until a real display name is set.
* **Live Initials Avatar & Notification Preview:** Renders dynamic initials avatars and a live mobile notification mockup during onboarding.
* **Compulsory Signup Registration:** New accounts capture full names upfront and sync seamlessly on PKCE email verification.

### 2. 🔔 Authenticated, Preference-Aware Push Architecture
* **Real Sender Name Headers:** Notifications show the author's verified name (`📢 Asutosh Mishra • TeamSpace`, `💬`, `📋`, `👀`, `⏱️`).
* **Per-User Preference Filtering & Targeted Delivery:** Server-side dispatch checks each member's `notification_preferences` opt-outs, excludes the sender on team broadcasts, targets 1-on-1 task alerts strictly to the assignee, and auto-prunes expired `404`/`410` subscriptions.
* **Dual Delivery Engine:** Supports W3C Web Push (ECDH P-256 VAPID) for browsers and native Google **FCM HTTP v1** for the Android APK, with strict same-origin `target_url` validation in both the Edge Worker and `sw.js`.

### 3. 📁 Private Team Drive & Social-Media Preview Lightbox
* **Private Access-Controlled Storage:** Uploads go directly to a private Supabase Storage bucket (`team-files`), accessible only via short-lived (300-second) signed URLs scoped to active team members.
* **Private In-Browser PDF & Media Inspection:** Preview images, HTML5 videos, audio, syntax-formatted code/text files, and PDFs (rendered locally via authenticated `blob:` URLs with zero third-party document viewer forwarding).
* **XSS-Safe Rendering:** Active vector/HTML formats (`.svg`, `.html`) are blocked from executing scripts in inline tabs.

### 4. 📢 Announcement Acknowledgement & Sign-Off System
* **Compulsory Deadlines & Priorities:** Supports *Normal*, *Important*, and *Mandatory Acknowledgement* alerts.
* **Leader Compliance Dashboard:** Real-time sign-off progress bars, timestamped member audit table, and a 1-click **"Send Push Reminder to Pending Members"** trigger.

### 5. 📋 Smart Task Management System (6-State Agile Pipeline)
* **6-State Engineering Workflow:**
  $$\text{Assigned} \longrightarrow \text{Accepted} \longrightarrow \text{In Progress} \longrightarrow \text{Review Pending} \longrightarrow \begin{cases} \text{Completed} \\ \text{Changes Requested} \end{cases}$$
* **Server-Enforced State Transitions:** Direct table status spoofing is blocked by PostgreSQL RLS; all member and leader transitions run through `transition_task_status` RPC with membership verification, `http(s)://` link validation, and automatic `task_activity_logs` auditing.

### 6. 👥 Leader-Exclusive Attendance & Contribution Tracking
* **Strict Role Enforcement:** Exclusively team leaders can create sessions (`Present`, `Partial`, `Absent`, `Excused`), attach verified contribution notes, and generate immutable `attendance_audit_logs`.

### 7. ⚡ AI Chatbot — Powered by Grok AI Engine (`/workspace/ai`)
* **Grok AI Critical Thinking:** Backed by Grok AI / Groq LPU high-speed inference (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`), engineered for concise, critical engineering analysis, edge-case detection, and SQL/code synthesis.
* **Zero-Trust Server Proxy (`/api/ai`):** API keys live strictly inside Cloudflare Worker Secrets (`env.GROQ_API_KEY`) and are never exposed in client JavaScript bundles. Requests require a valid Supabase Bearer JWT and pass both client-side and server-side work-only guardrails.
* **Export & Developer UX:** Single-page `100vh` chat console with Markdown (`.md`) transcript export and 1-click code block copy.

### 8. 🌐 Integrated Dashboard Google Search
* Integrated Google Search bar on the Workspace Dashboard (`/workspace`) for quick documentation lookup inside web and Android APK workflows.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18.3 + Vite 6.4 | Fast component architecture with `React.lazy()` route code splitting |
| **Edge Compute & Proxy** | Cloudflare Workers + Static Assets | Authenticated `/api/ai` & `/api/send-push` gateway, CSP/HSTS headers, SPA host |
| **AI Intelligence** | Grok AI / Groq LPU Engine | Server-proxied LLM reasoning for engineering, database design & agile sprints |
| **Database & Auth** | Supabase (PostgreSQL 15 + RLS) | Relational storage, PKCE Auth, atomic `SECURITY DEFINER` RPCs & column triggers |
| **Realtime Engine** | Supabase Realtime | WebSocket channels for live team chat and announcement broadcasts |
| **Private File Storage** | Supabase Storage (`team-files`) | Private team-scoped bucket with 300-second signed access URLs |
| **Push Infrastructure** | Web Push (VAPID) + FCM HTTP v1 | Closed-browser and native Android background push delivery |
| **Native Android App** | Kotlin, Android SDK 34 (minSdk 26) | Hardened WebView wrapper, FCM service, R8 shrinking & App Links |
| **Styling & Design System** | Pure Vanilla CSS (CSS3 Variables) | 7 Accent themes, 7 Background atmospheric themes, mobile-first layout |

---

## 🛡️ Security & Zero-Trust Architecture

TeamSpace is designed around defense-in-depth across every tier:

* **Zero Client-Side Secrets:** AI (`GROQ_API_KEY`), Web Push signing (`VAPID_PRIVATE_KEY`), and admin DB credentials (`SUPABASE_SERVICE_ROLE_KEY`) reside strictly in encrypted Cloudflare Worker Secrets—zero API keys are shipped in Vite bundles or committed to Git.
* **Authenticated Edge Gateway:** `/api/ai`, `/api/send-push`, and `/api/test-push` verify the caller's Supabase Bearer JWT via `auth.getUser()`, validate active team membership (`status = 'active'`) before dispatching pushes, allowlist valid HTTPS push domains (preventing SSRF), and strip stack traces from error responses.
* **Hardened PostgreSQL RLS & Triggers:**
  * `BEFORE UPDATE` trigger (`trg_protect_profile_sensitive_columns`) blocks non-admins from escalating `is_admin` or altering immutable identity fields.
  * `WITH CHECK` policies prevent pending invitees from self-approving or promoting themselves to `leader`.
  * Profile queries are scoped to self and shared teammates (`shares_team_with`), with minimal `lookup_user_for_invite` RPCs hiding private emails.
  * Push subscription RPCs (`get_team_push_subscriptions`, `save_push_subscription`) revoke `anon` access and enforce team membership.
  * Atomic RPCs (`create_team_with_leader`, `transfer_team_leadership`, `transition_task_status`) prevent partial-failure states and status spoofing.
* **Browser & XSS Protections:** Enforces `Content-Security-Policy` (no inline `<script>` tags), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict origin CORS, `getSafeExternalUrl()` (`http:`/`https:` allowlist on links/avatars), and same-origin Service Worker navigation.
* **Hardened Android APK:** Enforces exact `https` + host matching (`teamspace204.asutoshm359.workers.dev`) across WebView navigation, Intent extras, and FCM notification payloads; disables `allowFileAccess`, `allowContentAccess`, and `android:allowBackup`; quotes injected JS with `JSONObject.quote()`; strips raw token logs; and supports R8-minified, release-signed CI builds (`v1.0.2`).

---

## 📂 Project Directory Structure

```
├── android/                             # Native Android App (Kotlin + Gradle)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/teamspace/app/
│   │   │   │   ├── MainActivity.kt      # Hardened WebView host-allowlist & JS bridge
│   │   │   │   └── MyFirebaseMessagingService.kt # FCM background receiver & URL validation
│   │   │   ├── res/                     # Icons, drawables, layouts, network_security_config
│   │   │   └── AndroidManifest.xml      # Minimal permissions, allowBackup=false, App Links
│   │   ├── proguard-rules.pro           # R8 keep rules for @JavascriptInterface
│   │   └── build.gradle.kts             # SDK 34 config, R8 minification & release signing
│   └── gradle/wrapper/                  # Gradle wrapper binaries
│
├── public/
│   ├── .well-known/assetlinks.json      # Android Digital Asset Links verification
│   ├── logo.png                         # TeamSpace brand icon (512x512)
│   ├── sw.js                            # Service Worker with same-origin notification lock
│   └── manifest.json                    # Web App Manifest
│
├── src/
│   ├── components/                      # Modular UI Components
│   │   ├── CompulsoryNameModal.jsx      # Mandatory verified display name onboarding
│   │   ├── Announcements.jsx            # Announcements feed, priorities & alert controls
│   │   ├── AnnouncementAcknowledgement.jsx # Member sign-offs & leader audit modal
│   │   ├── TeamChat.jsx                 # Real-time WebSocket team chat with push dispatch
│   │   ├── SmartTasks.jsx               # 6-state agile task workflow & DoD checklist
│   │   ├── SharedFiles.jsx              # Private Supabase Storage drive & preview lightbox
│   │   ├── WorkAttendance.jsx           # Leader attendance & immutable audit trail
│   │   ├── PersonalTodos.jsx            # Private personal priority task list
│   │   ├── PersonalSettings.jsx         # Themes, display name & push preferences
│   │   ├── GoogleSearchBar.jsx          # Dashboard Google web search bar
│   │   ├── NotificationPreferences.jsx  # Category toggles & device push test
│   │   └── Layout.jsx                   # Global navbar, network status & footer
│   │
│   ├── context/AuthContext.jsx          # Supabase PKCE session, profile & theme state
│   ├── lib/
│   │   ├── supabase.js                  # Supabase client singleton
│   │   ├── pushService.js               # Native FCM + Web Push sync & authenticated dispatch
│   │   ├── groqService.js               # Authenticated /api/ai proxy client & guardrail
│   │   └── urlUtils.js                  # Strict http(s):// external URL sanitizer
│   ├── pages/                           # Lazy-loaded route pages (React.lazy)
│   ├── polyfill.js                      # CSP-safe Notification polyfill for WebView
│   ├── main.jsx                         # App entry & Service Worker registration
│   └── worker-shim.js                   # Cloudflare Worker (/api/ai, /api/send-push, CSP)
│
├── supabase/
│   ├── schema.sql                       # Base tables, RLS policies, storage bucket & triggers
│   ├── production-upgrade-complete.sql  # Tasks, attendance, acknowledgements & push RPCs
│   ├── security-hardening-step1.sql     # Zero-trust RLS locks, column triggers & atomic RPCs
│   └── functions/send-push/index.ts     # Authenticated Supabase Edge Function fallback
│
├── .github/workflows/build-apk.yml      # GitHub Actions CI for Android APK releases
├── wrangler.jsonc                       # Cloudflare Workers deployment config
├── vite.config.js                       # Vite + Rollup manualChunks config
└── package.json                         # Dependencies and build/deploy scripts
```

---

## 🚀 Local Development & Deployment Setup

### Prerequisites
* **Node.js** v18+ and **npm** v9+
* **Supabase Project** (run `supabase/schema.sql`, `supabase/production-upgrade-complete.sql`, and `supabase/security-hardening-step1.sql` in SQL Editor)
* **Cloudflare Account** (`wrangler` CLI)

### 1. Clone & Install
```bash
git clone https://github.com/AsutoshMishra-Engineer/Team-Space.git
cd Team-Space
npm install
```

### 2. Frontend Environment (`.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_VAPID_PUBLIC_KEY=your-public-vapid-key
```

### 3. Cloudflare Worker Secrets (Server-Side Only)
```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Optional for background native Android FCM delivery:
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

### 4. Run Locally or Deploy
```bash
npm run dev      # Local Vite dev server
npm run build    # Production bundle
npm run deploy   # Build + Deploy to Cloudflare Workers
```

---

## 📄 License & Attribution

Developed and maintained by **[Asutosh Mishra](https://github.com/AsutoshMishra-Engineer)**. All rights reserved.
