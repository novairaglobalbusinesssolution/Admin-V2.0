# 🚀 Novaira Admin V2.0

![Version](https://img.shields.io/badge/Version-2.0.3-blue.svg)
![Electron](https://img.shields.io/badge/Platform-Electron-47848f.svg)
![React](https://img.shields.io/badge/Frontend-React+Vite-61dafb.svg)
![NodeJS](https://img.shields.io/badge/Backend-Node.js-339933.svg)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ecf8e.svg)

Novaira Admin V2.0 is a highly optimized, full-stack desktop application built to manage the Novaira Earning platform. It combines a blazing-fast React (Vite) frontend with an embedded Node.js backend, packaged together as a single executable Windows application (`.exe`) via Electron.

---

## ✨ Key Features & Highlights

### 📊 Real-Time Dashboard
* **Dynamic Metrics:** Fetches 100% real-time data from Supabase for Total Users, Published Apps, Bulkers, and Clients.
* **Live Feeds:** Instantly view the latest registered users and recently published apps in a beautifully aligned, responsive flexbox layout.

### 🔔 Advanced Push Notification System
* **Firebase Cloud Messaging (FCM):** Send bulk or individual Multicast Push Notifications directly to Android devices.
* **Targeted Delivery:** Select specific users using a dynamic autocomplete multiselect dropdown (bypassing RLS safely via backend Admin API), or send to *All Users* at once.
* **Rich Notifications:** Supports Custom Titles, Messages, actionable Deep Links (System, Wallet, Tasks), and Image Attachments.

### 📧 Bulk Email & Cron Automation
* **Live Checking Mails:** Integrated Zoho SMTP to send bulk checking emails to dynamic receiver lists.
* **Database Driven:** SMTP configurations and receiver lists are managed directly from the Supabase database (`live_list_settings`).
* **Automated Cron Jobs:** Embedded Node.js worker runs background intervals to automatically dispatch bulk emails at user-defined schedules, even while the admin panel is minimized.

### 👥 Comprehensive User & Data Management
* **Material UI DataTables:** Fully featured management tables for Individuals, Bulkers, Providers, and Clients.
* **Server-Side Pagination:** Replaced basic pagination with advanced TablePagination, showing accurate total record counts and dynamic rows-per-page.
* **Task Assignment:** Seamless API integration to assign, copy, open, and return user tasks seamlessly.

### 🖥️ 1-Click Desktop Integration
* **Unified Startup:** The Electron `main.cjs` process is engineered to natively `require()` and launch the Express backend concurrently with the React frontend.
* **Auto-Updater:** Built with NSIS Installer. Simply running a new setup file updates the existing software without losing data or configurations.

---

## 🛠️ Technology Stack

**Frontend:**
* React.js (via Vite)
* Material UI (MUI) & Tailwind CSS (for layout and styling)
* Axios (API calls)
* Supabase JS Client

**Backend (Embedded in Electron):**
* Node.js & Express.js
* Firebase Admin SDK (FCM Notifications)
* Nodemailer (Zoho SMTP Mailer)
* dotenv & CORS

**Packaging & Build:**
* Electron & Electron-Builder
* Custom ASAR patch to bypass Windows Defender EPERM locks during extraction.

---

## ⚙️ Installation & Setup (For Developers)

### 1. Clone the Repository
```bash
git clone https://github.com/novairaglobalbusinesssolution/Admin-V2.0.git
cd Admin-V2.0/frontend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the App
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## 📁 Project Structure

- `src/` – React frontend app
- `backend/` – Express API and database helpers
- `electron/` – Electron desktop shell
- `public/` – static assets and icons
- `dist/` – production build output

---

## 🔐 Notes

This project uses Supabase for data access and Firebase Admin for push notifications. Keep environment variables and service account keys private and never commit them to Git.

