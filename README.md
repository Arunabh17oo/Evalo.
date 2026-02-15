# Evalo - Adaptive AI Exam Platform (3D UI + Proctoring)

This project is structured exactly in two folders:

- `Frontend`
- `Backend`

## What it does

- **Branding & Logo**: Integrated the official **Evalo Logo** (Lightbulb with question mark) across the platform:
  - Hero section on landing page
  - Fixed Top Navigation bar
  - Login/Signup Auth Modal
- **Animated UI**: Large glassmorphism layout with a simplified **Logo5D** (clean 3D text) and interactive background.
- **Role-based System**:
  - `admin`: Manage users and set roles (`student` / `teacher` / `admin`).
  - `teacher`: Upload books, create tests, review student answers, and download reports.
  - `student`: Join tests using codes and answer subjective questions.
- **AI Scoring System**: Automated grading based on three NLP metrics:
  - **Cosine Similarity (50%)**: Semantic alignment with reference.
  - **Keyword Coverage (30%)**: Technical term detection.
  - **Jaccard Score (20%)**: Vocabulary overlap analysis.
- **Proctoring Suite**:
  - Fullscreen enforcement and camera/mic tracking.
  - Prevention of copy/paste, right-click, and tab switching.
  - Live AI risk scoring based on suspicious behavior.

## NEW Features & Improvements

### Teacher Management Tools
- **Clear History**: Teachers can now clear all student attempt history for a specific test with one click (includes safety confirmation).
- **Recent Sessions**: The "Uploaded Book Sessions" list is now limited to the **Top 3 most recent** uploads for a cleaner workspace.
- **Finalized Hide**: Attempts published 3 times (Finalized) are automatically hidden from the active review list.

### Submission Workflow
- **Submission Status**: Clear pill indicators for both Teachers and Students:
  - 🟢 **Submitted**: Test completed by student.
  - 🔴 **Needs Review**: Awaiting teacher evaluation.
  - 🔵 **Published/Finalized**: Results released to student.
- **Improved CTA**: The "Get Started Free" button on the hero section now intelligently scrolls to the Features section, ensuring a smooth navigation flow for logged-in users.

### PDF Export (Student Reports)
- **One-Click Download**: Teachers can download a professional PDF report for any published attempt.
- **Simplified 3-Column Layout**: High-level summary featuring:
  - **Student Name**
  - **AI Score** (Total Marks + %)
  - **Teacher Score** (Total Marks + %)
- **Conditional Visibility**: The PDF download button appears only after the teacher has reviewed and published the test results.

## Quick Links
- **Documentation**: [AI Scoring System Details](file:///Users/smacair/.gemini/antigravity/brain/9b51d98e-898d-49bb-b5c8-7093b90b878c/ai_scoring_documentation.md)
- **Implementation Walkthrough**: [Recent Feature Updates](file:///Users/smacair/.gemini/antigravity/brain/9b51d98e-898d-49bb-b5c8-7093b90b878c/walkthrough.md)

## Run backend

```bash
cd Backend
npm install
npm run dev
```

Backend default is `http://localhost:5050`. Seeded admin: `admin@evalo.ai` / `admin123`.

## Run frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`. Uses `jspdf` and `jspdf-autotable` for report generation.

## Persistence
- **File Store**: Data saved locally at `Backend/data/store.json`.
- **MongoDB**: Optional support by configuring `.env` with `MONGODB_URI`.
