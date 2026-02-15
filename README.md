# Evalo - Adaptive AI Exam Platform (3D UI + Proctoring)

This project is structured exactly in two folders:

- `Frontend`
- `Backend`

## What it does

- App branding and main UI upgraded to **Evalo** with large glassmorphism layout.
- Animated **3D background** + **5D-style layered animated Evalo logo**.
- Signup/Login modal UI (glassmorphism) that re-prompts periodically.
- Role-based system:
  - `admin`: manage users and set role (`student` / `teacher` / `admin`)
  - `teacher`: upload books and create tests
  - `student`: join test and answer subjective questions
- Upload **1 or more books** (PDF/TXT, up to 5 files).
- Test creation supports:
  - total marks (marks per question computed automatically)
  - custom duration
  - custom question count
  - initial difficulty level
- Unique student question flow with adaptive difficulty progression.
- Subjective answer scoring in percentage using NLP-style metrics:
  - cosine similarity
  - keyword coverage
  - jaccard overlap
- Proctoring workflow on test join:
  - fullscreen request
  - camera + mic permission request
  - copy/paste/context menu restrictions
  - AI-style risk scoring from suspicious events with live warnings

## Marks

- Teacher sets `Total Marks` during test creation.
- Backend computes `marksPerQuestion = totalMarks / questionCount` and returns marks earned per answer along with % correctness.

## Run backend

```bash
cd Backend
npm install
npm run dev
```

Backend default is `http://localhost:5050` (fallback to next port if busy).

Seeded admin credentials for first login:

- Email: `admin@evalo.ai`
- Password: `admin123`

## Persistence (User Data + History)

Evalo saves user/test/quiz data by user ID and keeps an activity history.

1. Default (works offline): file store
   - Stored at `Backend/data/store.json`
2. Optional: MongoDB
   - Configure `Backend/.env` with `MONGODB_URI`
   - Install dependencies and restart backend
   - When MongoDB is connected, `GET /api/health` returns `dbReady: true`

## Run frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend runs on Vite default `http://localhost:5173` and calls backend at `http://localhost:5050/api`.

If needed, set:

```bash
VITE_API_BASE=http://localhost:5050/api
```

## Notes

- Browsers cannot silently force camera/mic; Evalo requests permissions and raises proctoring risk warnings when denied.
- Fullscreen can also be exited by user/browser; this is tracked and flagged in proctoring events.
