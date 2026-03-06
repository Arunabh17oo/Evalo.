# 🌌 Evalo - Adaptive AI Exam Intelligence

Evalo is a premium, state-of-the-art AI-powered examination platform designed for the modern educational landscape. It merges high-precision Large Language Models with a robust proctoring ecosystem and a breathtaking 3D user experience, redefining how integrity and intelligence meet in digital assessments.

![Evalo Logo](Frontend/public/evalo-logo.png)

## ✨ The Core Pillars

### 🔐 Authentication & Identity
Evalo uses a robust, hybrid identity system for seamless and secure access:
- **Social Integration**: One-tap **Sign in with Google** via Firebase Authentication.
- **Enterprise Ready**: Traditional Email/Password flows with salted Hashing.
- **Secure Token Bridge**: Firebase ID tokens are securely exchanged for Evalo JWTs via a custom backend verification layer using **Firebase Admin SDK**.
- **Role Mastery**: Permission-based access control for Students, Teachers, and Admins.

### 🧠 PASS - Proctor-Aware Semantic Scoring
Evalo doesn't just grade; it understands. Our proprietary **PASS Engine** provides rigorous, evidence-based evaluation.
- **Multi-Criteria Rubric**: Every subjective answer is scored across three dimensions: **Factual Accuracy (50%)**, **Completeness (30%)**, and **Clarity & Logic (20%)**.
- **Hybrid Intelligence**: Utilizes **OpenAI GPT-4 Turbo** or **Google Gemini** for deep contextual reasoning, with a local NLP fallback (Cosine Similarity, Jaccard Index) for zero-latency grading.
- **Dynamic Difficulty**: Real-time adjustment of question complexity (Beginner → Intermediate → Advanced) based on live student performance.
- **AI Feedback Loop**: Students receive constructive, 25-word feedback snippets and full reasoning justifications for every score.

### 🛡️ High-Integrity Proctoring & AI Forensics
Maintain absolute exam integrity with Evalo's multi-layered security and detection suite:
- **🕵️ AI Content Forensics**: Every subjective response is scanned for GPT-style markers and LLM-specific structures. Suspected AI-generated content is flagged with specialized **Integrity Badges**.
- **👁️ Computer Vision (TensorFlow.js)**: Integrated **Coco-SSD** models perform real-time detection of multiple faces, mobile phones, and suspicious peripherals directly in the browser.
- **📊 Live Risk Scoring**: A dynamic risk profile (0-100%) is calculated for every student based on tab switches, camera anomalies, and background noise.
- **📝 AI Integrity Narrative**: For teachers, Evalo summarizes hours of proctoring data into a concise, professional narrative, highlighting patterns and critical violations.
- **🔐 Cyber Suite**: Includes **Dynamic Watermarking** (credential-mapped overlays), **Browser Fingerprinting** (hashing environment properties), and mandatory **Fullscreen Enforcement**.

### 🤖 Eva - Glassmorphic AI Assistant
The platform features **Eva**, an intelligent, persona-driven chatbot trained on the Evalo architecture.
- **Contextual Synergy**: Clicking any node in the **3D Knowledge Orbit** automatically triggers Eva with a pre-filled study focus tailored to that specific topic.
- **Support-Ready**: From explaining proctoring rules to assisting with platform navigation, Eva provides a premium, helpful layer of interactivity.
- **Professional Guardrails**: Engineered to be helpful while maintaining strict security boundaries regarding internal system data.

### 💎 Immersive Premium UX
Built with a "Design-First" philosophy, Evalo offers a breathtaking environment that stimulates focus and engagement.
- **🕸️ 3D Knowledge Orbit**: A stunning interactive visualization of topic mastery. Explore performance in 3D space, where nodes serve as entry points for AI-guided study.
- **🎭 Role-Based 3D Scenes**:
  - 🌌 **The Void (Guest)**: A minimalist, deep-space environment for calm exploration.
  - 🔮 **The Nexus (Student)**: A high-energy scene with floating crystals and dynamic rings to stimulate focus.
  - 🏛️ **The Architecture (Teacher)**: A structured, analytical grid with golden accents for administrative tasks.
- **✨ Aesthetics**: Full glassmorphic UI with real-time blur effects, smooth **Framer Motion** transitions, and professional typography using the **Outfit** font family.
- **🎧 Soundscape Engine**: Integrated ambient audio for focused exam sessions.

## 📊 Analytics & Deep Insights
- **Question-wise Diagnostics**: Deep AI feedback on every answer helps students understand their learning gaps.
- **Professional PDF Reports**: Automated generation of 3-column performance reports (Student Info, AI Score, Teacher Score) via **jsPDF**.
- **System Audit Logs**: Comprehensive tracking of all administrative actions and system events for total transparency.

## 🛠️ Technical Architecture

### The Tech Stack
- **Frontend**: React 18, Vite, Three.js (`@react-three/fiber`), Framer Motion, TensorFlow.js, jsPDF, **Firebase Client SDK**.
- **Backend**: Node.js, Express, Multer, Natural (Local NLP), OpenAI/Gemini API, **Firebase Admin SDK**.
- **Persistence**: Dual-support for **MongoDB** (Production) or **Local JSON Storage** (Development).
- **Infrastrucute**: Fully **Dockerized** with orchestrated services.

## 🚀 Setup & Installation

### Environment Configuration
Create `.env` files in both directories before starting.

**Frontend (`Frontend/.env`)**:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Backend (`Backend/.env`)**:
```env
PORT=5050
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
FIREBASE_SERVICE_ACCOUNT={"type": "service_account", ...}
GEMINI_API_KEY=your_gemini_key
```

### Option 1: Docker (Zero Configuration)
The fastest way to deploy the entire Evalo stack (Frontend, Backend, MongoDB):

1. Ensure **Docker Desktop** is running.
2. In the project root, run:
   ```bash
   docker-compose up --build
   ```
3. Access the ecosystem:
   - **Frontend**: `http://localhost:5173`
   - **Backend API**: `http://localhost:5050/api`

### Option 2: Manual Setup

1. **Backend**:
   ```bash
   cd Backend && npm install && npm run dev
   ```
2. **Frontend**:
   ```bash
   cd Frontend && npm install && npm run dev
   ```

---

## 🚀 Future Vision & Roadmap

Evalo is designed to evolve. Our roadmap includes "Tricky but Easy" implementations that significantly enhance the platform's intelligence:

- **🔄 Dynamic Difficulty Branching**: Automated exam path adjustments. If a student shows mastery, Evalo branches into specialized, high-level question tracks.
- **🎭 Sentiment & Confidence Analysis**: Using NLP logic and response-pattern metadata to detect student stress or hesitation markers during exams.
- **👥 AI-Moderated Peer Review**: An anonymized student-to-student grading layer with Evalo's AI acting as the ultimate moderator and validator.
- **🌍 Universal Accessibility**: Real-time voice-to-text proctoring and multi-language exam translation for global inclusivity.

---

> [!IMPORTANT]
> **Default Admin Access**: `admin@evalo.ai` / `admin123`

*Self-evolving intelligence for modern education.*
