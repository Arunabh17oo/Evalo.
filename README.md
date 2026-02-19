# 🌌 Evalo - Adaptive AI Exam Intelligence

Evalo is a premium, state-of-the-art AI-powered examination platform. It leverages advanced Large Language Models and local NLP fallbacks to provide precise subjective and objective assessments, coupled with a high-integrity proctoring ecosystem.

![Evalo Logo](Frontend/public/evalo-logo.png)

## ✨ Core Pillars

### 🧠 Adaptive AI Scoring Engine
Evalo doesn't just grade; it understands.
- **Hybrid Evaluation**: Utilizes **OpenAI** for high-precision contextual reasoning and **Local NLP** (Cosine Similarity, Jaccard Index, Keyword Coverage) for robust, instant grading.
- **Dynamic Difficulty**: The system automatically adjusts question levels (Beginner → Intermediate → Advanced) based on student performance in real-time.
- **Multi-Format Support**: Seamless handling of MCQs, long-form subjective answers, and mixed-mode examinations.

### 🛡️ High-Integrity Proctoring
Maintain absolute exam integrity with our multi-layered security suite:
- **Live Risk Scoring**: Real-time behavior analysis that calculates a "Risk Score" based on user actions.
- **Event Logging**: Detailed tracking of tab switches, window blurs, and unauthorized attempts.
- **Fullscreen Enforcement**: Mandatory fullscreen mode to prevent external distractions.
- **Global Security Controls**: Admins can toggle sensitive features like **Copy-Paste** across the entire platform instantly.

### 💎 Premium User Experience
Built with a "Design-First" philosophy, featuring a fully immersive environment:
- **Role-Based 3D Backgrounds**:
  - 🌌 **Guest ("The Void")**: A minimalist, deep-space environment for calm exploration.
  - 🔮 **Student ("The Nexus")**: A high-energy scene with floating crystals and dynamic rings to stimulate focus.
  - 🏛️ **Teacher ("The Architecture")**: A structured, analytical grid with golden accents, representing control and oversight.
- **Glassmorphic UI**: Breathtaking interface with real-time blur effects, smooth gradients, and **Framer Motion** animations.
- **Premium Typography**: Typographically verified with the **Outfit** font family for a modern, clean aesthetic.
- **Smart Notifications**: Intelligent toast system with deduplication and animated entry/exits.

### 📊 Analytics & Reporting
- **Question-wise Analysis**: Every answer receives deep AI feedback, helping students understand *why* they scored what they did.
- **PDF Generation**: Professional, 3-column performance reports (Student Info, AI Score, Teacher Score) generated via jsPDF.
- **Teacher Insights**: Comprehensive analytics including average scores, completion rates, and risk distribution charts.

## 🛠️ Technical Architecture

### Tech Stack
- **Frontend**: React 18, Vite, Framer Motion, Three.js (`@react-three/fiber`), jsPDF.
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


