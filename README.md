# 🌌 Evalo - Adaptive AI Exam Intelligence

Evalo is a premium, state-of-the-art AI-powered examination platform. It leverages advanced Large Language Models and local NLP fallbacks to provide precise subjective and objective assessments, coupled with a high-integrity proctoring ecosystem.

![Evalo Logo](file:///Users/smacair/Downloads/My%20Projects/Evalo/Frontend/public/evalo-logo.png)

## ✨ Core Pillars

### 🧠 Adaptive AI Scoring Engine
Evalo doesn't just grade; it understands.
- **Hybrid Evaluation**: Utilizes **OpenAI** for high-precision contextual reasoning and **Local NLP** (Cosine Similarity, Jaccard Index, Keyword Coverage) for robust, instant grading.
- **Dynamic Difficulty**: The system automatically adjusts question levels (Beginner → Intermediate → Advanced) based on student performance in real-time.
- **Subjective & Objective**: Support for MCQs, long-form subjective answers, and mixed-mode examinations.

### 🛡️ High-Integrity Proctoring
Maintain absolute exam integrity with our multi-layered security suite:
- **Live Risk Scoring**: Real-time behavior analysis that calculates a "Risk Score" based on user actions.
- **Event Logging**: Detailed tracking of tab switches, window blurs, and unauthorized attempts.
- **Fullscreen Enforcement**: Mandatory fullscreen mode to prevent external distractions or resource access.
- **Global Security Controls**: Admins can toggle sensitive features like **Copy-Paste** across the entire platform instantly.

### 💎 Premium User Experience
Built with a "Design-First" philosophy:
- **Glassmorphic UI**: A breathtaking interface featuring 5D-simulated logos, smooth Framer Motion animations, and a **Premium System Dashboard** footer.
- **Clean Feedback**: Optimized notification system with intelligent toast deduplication for a focused user experience.
- **Role-Centric Hubs**:
  - **Admin Hub**: Global system auditing, user lifecycle management, and security toggles.
  - **Teacher Hub**: RAG-based book indexing, automated test generation, and manual score overrides.
  - **Student Dashboard**: Real-time score synchronization, intuitive exam interfaces, and detailed performance reports.

## 📊 Analytics & Reporting
- **Question-wise Analysis**: Every answer received deep AI feedback, helping students understand *why* they scored what they did.
- **PDF Generation**: Professional, 3-column performance reports (Student Info, AI Score, Teacher Score) generated via jsPDF.
- **Teacher Insights**: Comprehensive analytics including average scores, completion rates, and risk distribution charts.

## 🛠️ Technical Architecture

### Tech Stack
- **Frontend**: React 18, Vite, Framer Motion, Three.js (for the 5D logo), jsPDF.
- **Backend**: Node.js, Express, Multer (File Processing), Natural (NLP).
- **Persistence**: Dual-support for **MongoDB** (Production-ready) or **Local JSON Storage**.
- **Containerization**: Fully **Dockerized** for seamless development and deployment.
- **AI**: OpenAI API integration for advanced subjective analysis.

## 🚀 Setup & Installation

### Option 1: Docker (Preferred - Zero Configuration)
Run the entire stack (Frontend, Backend, and MongoDB) with a single command:

1. Ensure **Docker Desktop** is running.
2. In the project root, run:
   ```bash
   docker-compose up --build
   ```
3. Access the app:
   - **Frontend**: `http://localhost:5173`
   - **Backend API**: `http://localhost:5050/api`

### Option 2: Manual Setup

#### 📂 Repository Structure
```
Evalo/
├── Backend/   # Express.js Server
└── Frontend/  # Vite + React Client
```

#### 🚀 Backend Setup
1. Navigate to: `cd Backend`
2. Install: `npm install`
3. Configure `.env` (see `.env.example`).
4. Start: `npm run dev` (Port: `5050`)

#### 💻 Frontend Setup
1. Navigate to: `cd Frontend`
2. Install: `npm install`
3. Start: `npm run dev` (URL: `http://localhost:5173`)

---

> [!TIP]
> **Default Admin Credentials**: `admin@evalo.ai` / `admin123`

*Self-evolving intelligence for modern education.*
