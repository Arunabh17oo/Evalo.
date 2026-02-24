const { OpenAI } = require("openai");

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Evaluates a subjective student answer against a reference context using OpenAI.
 * Uses a multi-criteria rubric (PASS - Proctor-Aware Semantic Scoring).
 */
async function evaluateSubjectiveAnswer(studentAnswer, questionPrompt, referenceContext, pointsPossible) {
    if (!openai) {
        throw new Error("OpenAI API key missing. Please set OPENAI_API_KEY in .env");
    }

    const prompt = `
    You are a Senior Academic Evaluator specializing in technical assessments.
    Your task is to provide a rigorous, fair, and evidence-based evaluation of a student's answer.

    ### ASSESSMENT DATA
    - **Question**: "${questionPrompt}"
    - **Reference Answer (Context)**: "${referenceContext}"
    - **Student Response**: "${studentAnswer}"
    - **Maximum Points**: ${pointsPossible}

    ### EVALUATION RUBRIC (0-100% scale per criteria)
    1. **Factual Accuracy (Weight: 50%)**: How many of the core technical facts from the reference are present and correct?
    2. **Completeness (Weight: 30%)**: Does the answer cover all parts of the question prompt?
    3. **Clarity & Logic (Weight: 20%)**: Is the response well-structured and free of contradictions?

    ### INSTRUCTIONS
    1. **Strict Grading**: Do not award full marks for "vague" but "mostly correct" answers. Be precise.
    2. **Deductive Reasoning**: Identify specific omissions or misconceptions.
    3. **Chain of Thought**: Internalize the reference first, then contrast with the student answer.
    4. **Confidence**: Ratio of how much of your final score is explicitly backed by the reference text.

    ### OUTPUT FORMAT (JSON ONLY)
    {
      "score": number, (0 to ${pointsPossible})
      "rubric": {
        "accuracy": number, (0-100)
        "completeness": number, (0-100)
        "clarity": number (0-100)
      },
      "feedback": "string", (Constructive, max 25 words)
      "reasoning": "string", (Strict evidence-based justification)
      "confidence": number (0 to 1)
    }
    `;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4-turbo",
            messages: [
                { role: "system", content: "You are a rigorous academic grading engine. You output ONLY valid JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);

        // Ensure score is within bounds
        result.score = Math.max(0, Math.min(pointsPossible, Number(result.score) || 0));

        return result;
    } catch (error) {
        console.error("PASS Evaluation Engine Error:", error);
        throw error;
    }
}

async function getEvaChatResponse(userMessage, history = []) {
    const msg = userMessage.toLowerCase();

    // Knowledge Base from README.md - Expanded for exact reporting
    const localKnowledge = {
        pillars: "Evalo is built on four core pillars: \n1. **Adaptive AI Scoring Engine**: For intelligent assessment.\n2. **High-Integrity Proctoring**: To maintain exam parity.\n3. **Premium User Experience**: For an immersive, state-of-the-art interface.\n4. **Advanced Analytics**: For deep performance insights.",
        scoring: "Evalo's AI Scoring Engine uses a hybrid approach:\n- **Hybrid Evaluation**: Combines OpenAI for precision with Local NLP (Cosine Similarity, Keyword Coverage) for fallbacks.\n- **Dynamic Difficulty**: Automatically adjusts levels (Beginner → Advanced) based on performance.\n- **Multi-Format**: Supports MCQs and subjective answers.",
        proctoring: "Evalo maintains absolute integrity through:\n- **Live Risk Scoring**: Real-time behavior analysis.\n- **Event Logging**: Tracks tab switches and window blur events.\n- **Fullscreen Enforcement**: Prevents external distractions.\n- **Global Controls**: Admins can toggle Copy-Paste and platform-wide security settings.",
        security: "Our cybersecurity suite includes:\n- **Dynamic Watermarking**: Anti-piracy overlays mapping to student credentials.\n- **Browser Fingerprinting**: Cryptographic device hashing to prevent hijacking.\n- **API Defense**: Rate limiting and NoSQLi/XSS prevention.",
        ux: "Evalo features a premium aesthetic with:\n- **Role-Based 3D Backgrounds**: Guest (The Void), Student (The Nexus), and Teacher (The Architecture).\n- **Glassmorphic UI**: Real-time blur effects and Framer Motion animations.\n- **Typography**: Uses the modern Outfit font family.",
        tech: "Technical stack: React 18, Node.js, Express, Vite, Three.js, jsPDF. Supports MongoDB and Local JSON storage. Fully Dockerized.",
        admin: "Default Admin Credentials for local testing: admin@evalo.ai / admin123.",
        contact: "For technical issues or advanced queries, please contact: Arunabh17oo@gmail.com"
    };

    console.log(`[Eva Debug] Incoming Message: "${userMessage}"`);
    console.log(`[Eva Debug] OpenAI Status: ${!!openai}`);

    if (!openai) {
        console.log(`[Eva Debug] Triggering Local Mode for: "${msg}"`);
        // Robust Local Fallback with more generous keyword matching
        if (msg.includes("pillar") || msg.includes("core")) return { role: "assistant", content: localKnowledge.pillars };

        // Match score, grading, engine, or how does... work
        if (msg.includes("score") || msg.includes("scoring") || msg.includes("grade") || msg.includes("grading") || msg.includes("evaluation") || msg.includes("engine") || msg.includes("ai score") || msg.includes("how does ai scoring")) {
            console.log(`[Eva Debug] Matched Scoring Pillar`);
            return { role: "assistant", content: localKnowledge.scoring };
        }

        if (msg.includes("proctor") || msg.includes("cheat") || msg.includes("integrity") || msg.includes("fullscreen") || msg.includes("log") || msg.includes("risk")) {
            console.log(`[Eva Debug] Matched Proctoring Pillar`);
            return { role: "assistant", content: localKnowledge.proctoring };
        }

        if (msg.includes("security") || msg.includes("safe") || msg.includes("watermark") || msg.includes("fingerprint") || msg.includes("api") || msg.includes("defense")) {
            console.log(`[Eva Debug] Matched Security Pillar`);
            return { role: "assistant", content: localKnowledge.security };
        }

        if (msg.includes("stack") || msg.includes("tech") || msg.includes("built") || msg.includes("docker") || msg.includes("react") || msg.includes("node") || msg.includes("js")) {
            console.log(`[Eva Debug] Matched Tech Pillar`);
            return { role: "assistant", content: localKnowledge.tech };
        }

        if (msg.includes("admin") || msg.includes("login") || msg.includes("credentials") || msg.includes("password")) {
            console.log(`[Eva Debug] Matched Admin Info`);
            return { role: "assistant", content: localKnowledge.admin };
        }

        if (msg.includes("ux") || msg.includes("interface") || msg.includes("design") || msg.includes("background") || msg.includes("style") || msg.includes("3d") || msg.includes("look") || msg.includes("glass")) {
            console.log(`[Eva Debug] Matched UX Pillar`);
            return { role: "assistant", content: localKnowledge.ux };
        }

        if (msg.includes("contact") || msg.includes("help") || msg.includes("support") || msg.includes("mail") || msg.includes("email") || msg.includes("arunabh")) {
            console.log(`[Eva Debug] Matched Contact Info`);
            return { role: "assistant", content: localKnowledge.contact };
        }

        console.log(`[Eva Debug] No specific keyword matched. Returning generic fallback.`);
        return {
            content: `I'm currently in high-performance local mode. I can help with information about our AI Scoring, Proctoring, Security, or Setup. For advanced account-specific issues, please contact Arunabh17oo@gmail.com.`,
            role: "assistant"
        };
    }

    const systemPrompt = `
    You are Eva, the official AI assistant of Evalo. 
    Evalo is a premium, state-of-the-art AI-powered examination platform.
    
    ### SITE KNOWLEDGE (REFERENCE FROM README.MD)
    - **Core Pillars**: Adaptive AI Scoring Engine, High-Integrity Proctoring, Cyber Security, and Premium UX.
    - **AI Scoring**: Uses OpenAI for precision and Local NLP (Cosine, Jaccard) for fallbacks. Supports Dynamic Difficulty (Beginner/Intermediate/Advanced).
    - **Proctoring**: Real-time Risk Scoring, Event Logging (tab switching, window blur), Fullscreen Enforcement.
    - **Cyber Security**: Dynamic Watermarking, Browser Fingerprinting, API Defense, Rate Limiting, NoSQLi/XSS prevention.
    - **UX**: Role-Based 3D Backgrounds (Guest: Void, Student: Nexus, Teacher: Architecture), Glassmorphic UI, Outfit font.
    - **Analytics**: PDF Reports (3-column), deep AI question feedback.
    - **Tech Stack**: React 18, Node.js, Express, Vite, Three.js, MongoDB/JSON storage, Dockerized.
    - **Default Admin**: admin@evalo.ai / admin123
    - **URLs**: Frontend (http://localhost:5173), Backend (http://localhost:5050/api).

    Your persona:
    - Highly intelligent, professional, yet friendly and helpful.
    - Clear and concise in your explanations.
    - If a user asks a question about the site, use the knowledge above to answer.
    
    ### IMPORTANT POLICY
    - **UNKOWN ANSWERS**: If you truly have no clue how to help with a specific request or technical issue, do NOT make things up. Instead, politely suggest the user contact development/support at: **Arunabh17oo@gmail.com**.
    `;

    try {
        const messages = [
            { role: "system", content: systemPrompt },
            ...history.slice(-6), // Keep last 6 messages
            { role: "user", content: userMessage }
        ];

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4-turbo",
            messages,
        });

        return {
            content: response.choices[0].message.content,
            role: "assistant"
        };
    } catch (error) {
        console.error("Eva Chat Error:", error);
        return {
            content: `I'm having a little trouble connecting to my central brain. However, for support or urgent issues, you can contact: Arunabh17oo@gmail.com.`,
            role: "assistant"
        };
    }
}

async function generateProctoringNarrative(proctorEvents) {
    if (!openai) {
        return "AI analysis unavailable. Integrity data recorded to system logs.";
    }

    if (!proctorEvents || proctorEvents.length === 0) {
        return "No proctoring violations or suspicious events recorded. High integrity maintained.";
    }

    const eventSummary = proctorEvents
        .slice(-20) // Analyze last 20 events
        .map(e => `${new Date(e.at).toLocaleTimeString()}: ${e.type} (Risk: ${e.riskScore}%)`)
        .join("\n");

    const prompt = `
    You are an Integrity Analyst for Evalo.
    Based on the following proctoring event log, provide a concise (max 40 words) professional narrative of the student's behavior.
    Focus on patterns (e.g., constant tab switching, mobile phone presence, or sudden disappearance).
    
    EVENT LOG:
    ${eventSummary}
    
    Output ONLY the narrative string.
    `;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4-turbo",
            messages: [{ role: "system", content: "You are a professional integrity investigator." }, { role: "user", content: prompt }]
        });
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error("Narrative Engine Error:", error);
        return "Error analyzing integrity narrative.";
    }
}

async function detectAIContent(studentAnswer) {
    if (!openai) {
        return { isAI: false, score: 0, reason: "AI Detection Unavailable" };
    }

    const prompt = `
    Analyze the following student response and determine the probability (0 to 1) that it was generated by an AI (like ChatGPT/LLM).
    Look for:
    - Highly standard/perfect grammar and punctuation.
    - Lack of personal voice or idiosyncratic errors.
    - Typical LLM structures (e.g., "In conclusion,", "Furthermore,").
    - Overly structured or generic explanations.

    STUDENT RESPONSE:
    "${studentAnswer}"

    OUTPUT FORMAT (JSON ONLY):
    {
      "isAI": boolean,
      "aiProbability": number, (0 to 1)
      "reason": "string" (max 15 words)
    }
    `;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4-turbo",
            messages: [
                { role: "system", content: "You are an AI Forensic Analyst. You output ONLY valid JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);
        return {
            isAI: result.aiProbability > 0.7,
            score: result.aiProbability,
            reason: result.reason
        };
    } catch (error) {
        console.error("AI Detection Error:", error);
        return { isAI: false, score: 0, reason: "Detection Failed" };
    }
}

module.exports = { evaluateSubjectiveAnswer, getEvaChatResponse, generateProctoringNarrative, detectAIContent };
