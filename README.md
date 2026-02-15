# Evalo - Adaptive AI Exam Platform (OpenAI + Proctoring)

Evalo is a premium, AI-powered examination platform designed for subjective and objective assessment with intelligent proctoring and real-time result synchronization.

## 🚀 Core Features

- **Hybrid AI Scoring Engine**: 
  - **OpenAI Integration**: High-precision subjective answer evaluation with contextual reasoning and sentiment analysis.
  - **Local NLP Fallback**: Robust local similarity metrics (Cosine, Jaccard, Keyword Coverage) for offline or fallback grading.
- **Premium UI/UX**: 
  - Glassmorphic design with a 3D-simulated logo.
  - Responsive layout optimized for both student examination and teacher administration.
- **Strict Role-Based Ecosystem**:
  - **Admin**: Dedicated **Admin Control Center** for user role management, system auditing, and platform maintenance.
  - **Teacher**: **Teacher Hub** for book indexing (RAG foundation), test creation, bulk publication, and manual result overrides.
  - **Student**: Intuitive exam interface with real-time **Score Synchronization** (polling + manual sync) once marks are published.
- **Advanced Proctoring Suite**:
  - Fullscreen enforcement and camera/mic tracking.
  - Prevention of copy/paste, right-click, and tab switching.
  - Live AI risk scoring based on suspicious behavior detection.

## 🔄 Results & Synchronization
Evalo ensures students see their results the moment they are ready:
- **Background Polling**: Student result dashboards automatically refresh every 30 seconds if marks are pending.
- **Manual Sync**: A "Refresh Scores" button is available for instant synchronization.
- **Bulk Publish**: Teachers can publish scores for multiple students at once, making large-scale grading efficient.

## 📊 Analytics & Reporting
- **Question-wise Analysis**: Detailed AI feedback for every student response.
- **Teacher Dashboard**: High-level overview of class performance and attempt statuses.
- **PDF Reports**: Professional 3-column PDF reports (Name, AI Score, Teacher Score) generated using `jspdf-autotable`.

## 🛠️ Getting Started

### Backend Setup
```bash
cd Backend
npm install
npm run dev
```
- **Default Port**: `5050`
- **Authentication**: JWT-based. Seeded admin: `admin@evalo.ai` / `admin123`.
- **Database**: Supports local `store.json` persistence or MongoDB (configured via `.env`).

### Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```
- **Default URL**: `http://localhost:5173`
- **Tech Stack**: React, Vite, Framer Motion, Axios, jsPDF.

## 🔒 Security & Persistence
- **State Preservation**: LocalStorage-based draft saving for test creation and exam progress.
- **Environment Variables**: Use `.env` for `OPENAI_API_KEY`, `MONGODB_URI`, and `JWT_SECRET`.
- **Proctoring Integrity**: Server-side validation of proctoring events and attempt time-stamping.

---
*Self-evolving intelligence for modern education.*
