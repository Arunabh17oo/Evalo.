# 🌌 Evalo - Adaptive AI Exam Intelligence

Evalo is a premium, state-of-the-art AI-powered examination platform. It leverages advanced Large Language Models and local NLP fallbacks to provide precise subjective and objective assessments, coupled with a high-integrity proctoring ecosystem.

![Evalo Logo](Frontend/public/evalo-logo.png)

## ✨ Core Pillars

### 🧠 Adaptive AI Scoring Engine
Evalo doesn't just grade; it understands.
- **Hybrid Evaluation**: Utilizes **OpenAI** for high-precision contextual reasoning and **Local NLP** (Cosine Similarity, Jaccard Index, Keyword Coverage) for robust, instant grading.
- **Dynamic Difficulty**: The system automatically adjusts question levels (Beginner → Intermediate → Advanced) based on student performance in real-time.
- **Multi-Format Support**: Seamless handling of MCQs, long-form subjective answers, and mixed-mode examinations.

### 🛡️ High-Integrity Proctoring & Cyber Security
Maintain absolute exam integrity with our multi-layered security suite:
- **Live Risk Scoring**: Real-time behavior analysis that calculates a "Risk Score" based on user actions.
- **AI Computer Vision (Coco-SSD)**: Integrated **TensorFlow.js** for real-time detection of multiple faces and mobile phones during exams.
- **Forensic AI Content Detection**: Every subjective response is analyzed for GPT-style markers and unnatural structures, flagging suspected AI-written content with specialized **Integrity Badges**.
- **Real-time Audio Analysis**: Integrated Web Audio API monitors ambient noise and detects suspicious verbal communication during the session.
- **Event Logging & Narrative**: Detailed tracking of tab switches and camera behavior, summarized into a human-readable **AI Integrity Narrative** for teachers.

#### Advanced Security Infrastructure
- **Dynamic Watermarking**: Translucent, repositioning overlays mapping to student credentials to deter screen capturing and photography.
- **Browser Fingerprinting**: Cryptographic hashing of hardware and environment properties to prevent mid-exam session hijacking.
- **Fullscreen Enforcement**: Mandatory fullscreen mode with automated proctoring alerts upon exit.

### 🤖 Eva - Your AI Knowledge Assistant
The platform now features **Eva**, a dedicated glassmorphic AI chatbot:
- **Knowledge Sync**: Clicking any 3D node in the Knowledge Orbit automatically triggers Eva with a pre-filled study focus tailored to that topic.
- **Project Intelligence**: Eva is trained on the Evalo architecture and can assist users with platform queries, proctoring rules, and technical support.

### 💎 Premium User Experience
Built with a "Design-First" philosophy, featuring a fully immersive environment:
- **🕸️ Knowledge Orbit**: A stunning interactive 3D topic mastery visualization. Students and Admins can explore their performance in 3D space, with nodes serving as direct entry points for AI-guided study.
- **Role-Based 3D Backgrounds**:
  - 🌌 **Guest ("The Void")**: A minimalist, deep-space environment for calm exploration.
  - 🔮 **Student ("The Nexus")**: A high-energy scene with floating crystals and dynamic rings to stimulate focus.
  - 🏛️ **Teacher ("The Architecture")**: A structured, analytical grid with golden accents.
- **Glassmorphic UI**: Breathtaking interface with real-time blur effects, smooth gradients, and **Framer Motion** animations.
- **Mcq Readability Suite**: Professionally indexed options (A, B, C, D) with improved extraction logic for zero-clutter reading.
- **Premium Typography**: Typographically verified with the **Outfit** font family for a modern, clean aesthetic.
- **Light & Dark Mode Parity**: Fully optimized backgrounds and component themes that ensure 100% legibility and premium aesthetics in both light and dark environments.
- **Smart Notifications**: Intelligent toast system with animated entry/exits and "Copy-to-Clipboard" shortcuts for all test join codes.

### 📊 Analytics & Reporting
- **Question-wise Analysis**: Every answer receives deep AI feedback, helping students understand *why* they scored what they did.
- **PDF Generation**: Professional, 3-column performance reports (Student Info, AI Score, Teacher Score) generated via jsPDF.
- **Teacher Insights**: Comprehensive analytics including average scores, completion rates, and risk distribution charts.

## 🛠️ Technical Architecture

### Tech Stack
- **Frontend**: React 18, Vite, Framer Motion, Three.js (`@react-three/fiber`), TensorFlow.js, jsPDF.
- **Backend**: Node.js, Express, Multer (File Processing), Natural (NLP), OpenAI API.
- **Persistence**: Dual-support for **MongoDB** (Production-ready) or **Local JSON Storage**.
- **Containerization**: Fully **Dockerized** for seamless development and deployment.

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
