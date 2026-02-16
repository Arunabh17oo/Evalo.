# Evalo - Adaptive AI Exam Platform (OpenAI + Proctoring)

Evalo is a premium, AI-powered examination platform designed for subjective and objective assessment with intelligent proctoring, real-time result synchronization, and robust administrative controls.

## 🚀 Core Features

- **Hybrid AI Scoring Engine**: 
  - **OpenAI Integration**: High-precision subjective answer evaluation with contextual reasoning and sentiment analysis.
  - **Local NLP Fallback**: Robust local similarity metrics (Cosine, Jaccard, Keyword Coverage) for offline or fallback grading.
- **Premium UI/UX**: 
  - Glassmorphic design with a 3D-simulated logo and dynamic animations.
  - Responsive layout optimized for both student examination and teacher administration.
- **Strict Role-Based Ecosystem**:
  - **Admin**: Dedicated **Admin Hub** for user creation/deletion, role assignment, system auditing, and **Global Security Settings**.
  - **Teacher**: **Teacher Hub** for book indexing (RAG foundation), test creation, bulk publication, and manual result overrides.
  - **Student**: Intuitive exam interface with **Mandatory Roll Number** registration and real-time **Score Synchronization**.
- **Advanced Proctoring & Integrity**:
  - **Dynamic Copy-Paste Control**: Admin can globally enable/disable pasting via password-protected toggle.
  - **Single Attempt Enforcement**: Students are strictly limited to one attempt per test session.
  - Fullscreen enforcement and camera/mic tracking with live behavior risk scoring.

## 🛡️ Security & Access Control

- **Admin Account Protection**: Administrators are protected from deletion or role changes to maintain system integrity.
- **Manual User Management**: Admins can directly add, delete, and approve users within the Admin Hub. The backend now ensures **Synchronized Persistence**, automatically fetching and caching users from the database during admin actions.
- **Approval Workflow**: New signups are gated by a "Pending Approval" view. Users can use the **Refresh Status** button to gain instant access once approved by an admin.
- **Improved UI Feedback**: High-priority **Toast Notifications** with increased visibility and layered z-index ensure administrative feedback is never missed.
- **Specific Validations**: Clear error messaging (e.g., *"Already registered user sign in instead"*) for better user onboarding.

## 🔄 Results & Synchronization

Evalo ensures students see their results the moment they are ready:
- **Background Polling**: Student result dashboards automatically refresh every 30 seconds if marks are pending.
- **Manual Sync**: A "Refresh Scores" button is available for instant synchronization.
- **Bulk Publish**: Teachers can publish scores for multiple students at once.

## 📊 Analytics & Reporting

- **Roll Number Identification**: Students are identified via unique Roll Numbers across all teacher reports and reviews.
- **Question-wise Analysis**: Detailed AI feedback for every student response.
- **PDF Reports**: Professional 3-column PDF reports generated for every individual attempt.

## 🛠️ Getting Started

### Backend Setup
```bash
cd backend
npm install
npm run dev
```
- **Default Port**: `5050`
- **Authentication**: JWT-based. Seeded admin: `admin@evalo.ai` / `admin123`.
- **Database**: Supports local `store.json` persistence or MongoDB (configured via `.env`).

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- **Default URL**: `http://localhost:5174` (check terminal for active port)
- **Tech Stack**: React, Vite, Framer Motion, Axios, jsPDF.

---

