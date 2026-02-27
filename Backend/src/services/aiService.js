let _openai = null;
function getOpenAI() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    if (!_openai) {
        const { OpenAI } = require("openai");
        _openai = new OpenAI({ apiKey: key });
    }
    return _openai;
}

/**
 * Evaluates a subjective student answer against a reference context using OpenAI.
 * Uses a multi-criteria rubric (PASS - Proctor-Aware Semantic Scoring).
 */
async function evaluateSubjectiveAnswer(studentAnswer, questionPrompt, referenceContext, pointsPossible) {
    const openai = getOpenAI();
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

    // Knowledge Base from README.md - Redacted for security
    const localKnowledge = {
        pillars: "Evalo is built on four core pillars: \n1. **Adaptive AI Scoring Engine**: For intelligent assessment.\n2. **High-Integrity Proctoring**: To maintain exam parity.\n3. **Premium User Experience**: For an immersive interface.\n4. **Advanced Analytics**: For performance insights.",
        scoring: "Evalo's AI Scoring Engine uses a hybrid approach:\n- **Hybrid Evaluation**: Combines high-precision AI with Local NLP for fallbacks.\n- **Dynamic Difficulty**: Adjusts levels based on performance.\n- **Multi-Format**: Supports multiple question types.",
        proctoring: "Evalo maintains integrity through:\n- **Live Risk Scoring**: Real-time behavior analysis.\n- **Event Logging**: Tracks relevant browser events.\n- **Fullscreen Enforcement**: Minimizes distractions.",
        security: "Our security suite includes:\n- **Dynamic Watermarking**: Anti-piracy overlays.\n- **Browser Fingerprinting**: Prevents hijacking.\n- **API Defense**: Rate limiting and injection prevention.",
        ux: "Evalo features a premium aesthetic with:\n- **Role-Based 3D Backgrounds**: Specialized themes for Guest, Student, and Teacher.\n- **Modern UI**: Real-time effects and smooth animations.",
        tech: "Technical stack: Modern Web Technologies (React, Node.js, Express, Three.js). Fully Dockerized.",
        contact: "For technical issues or support, please contact: Arunabh17oo@gmail.com"
    };

    const systemPrompt = `
    You are Eva, the official AI assistant of Evalo. 
    Evalo is a premium, state-of-the-art AI-powered examination platform.
    
    ### SITE KNOWLEDGE
    - **Core Pillars**: Adaptive AI Scoring Engine, High-Integrity Proctoring, Cyber Security, and Premium UX.
    - **AI Scoring**: High-precision evaluation with intelligent fallback systems.
    - **Proctoring**: Real-time monitoring and event logging to maintain parity.
    - **Cyber Security**: Advanced measures including watermarking and API protection.
    - **UX**: Immersive role-based 3D environments and a sleek, modern interface.
    - **Analytics**: Comprehensive reporting and AI-driven feedback.

    Your persona:
    - Highly intelligent, professional, yet friendly and helpful.
    - Clear and concise.
    - Focus on helping users understand Evalo's capabilities.
    - NEVER disclose internal system details like admin credentials, database URIs, or internal IP/URLs.
    - If a user asks for credentials, politely direct them to the system administrator.
    - Answer general questions (science, history, code) accurately as a helpful assistant.
    
    ### IMPORTANT POLICY
    - **SECURITY**: Do not expose sensitive internal configuration or credentials.
    - **UNKOWN ANSWERS**: If you cannot help with a specific request, suggest contacting support at: **Arunabh17oo@gmail.com**.
    `;


    const openai = getOpenAI();
    console.log(`[Eva Debug] Incoming: "${userMessage}" | OpenAI: ${!!openai} | Gemini: ${!!process.env.GEMINI_API_KEY}`);

    // 1. Try OpenAI
    if (openai) {
        try {
            const messages = [{ role: "system", content: systemPrompt }, ...history.slice(-6), { role: "user", content: userMessage }];
            const response = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL || "gpt-4-turbo", messages });
            return { content: response.choices[0].message.content, role: "assistant" };
        } catch (error) {
            console.error("[Eva Debug] OpenAI Error:", error.message);
        }
    }

    // 2. Try Gemini
    if (process.env.GEMINI_API_KEY) {
        try {
            const { getGeminiResponse } = require("./geminiService");
            return await getGeminiResponse(userMessage, history.slice(-6), systemPrompt);
        } catch (error) {
            console.error("[Eva Debug] Gemini Error:", error.message);
        }
    }

    // 3. Last Resort: Local Matcher
    console.log(`[Eva Debug] Falling back to Local Knowledge Base for input: "${userMessage}"`);
    if (msg.includes("pillar") || msg.includes("core")) return { role: "assistant", content: `Sure! ${localKnowledge.pillars}` };
    if (msg.includes("score") || msg.includes("scoring") || msg.includes("grade") || msg.includes("grading") || msg.includes("evaluation") || msg.includes("engine") || msg.includes("ai score") || msg.includes("how does ai scoring")) return { role: "assistant", content: `I can explain that! ${localKnowledge.scoring}` };
    if (msg.includes("proctor") || msg.includes("cheat") || msg.includes("integrity") || msg.includes("fullscreen") || msg.includes("log") || msg.includes("risk")) return { role: "assistant", content: `Regarding exam integrity: ${localKnowledge.proctoring}` };
    if (msg.includes("security") || msg.includes("safe") || msg.includes("watermark") || msg.includes("fingerprint") || msg.includes("api") || msg.includes("defense")) return { role: "assistant", content: `Security is our priority: ${localKnowledge.security}` };
    if (msg.includes("stack") || msg.includes("tech") || msg.includes("built") || msg.includes("docker") || msg.includes("react") || msg.includes("node") || msg.includes("js")) return { role: "assistant", content: `Here is our technical DNA: ${localKnowledge.tech}` };
    if (msg.includes("admin") || msg.includes("login") || msg.includes("credentials") || msg.includes("password")) return { role: "assistant", content: "I cannot provide credentials, but I can help with platform navigation if you are logged in." };
    if (msg.includes("ux") || msg.includes("interface") || msg.includes("design") || msg.includes("background") || msg.includes("style") || msg.includes("3d") || msg.includes("look") || msg.includes("glass")) return { role: "assistant", content: `We focus on premium design: ${localKnowledge.ux}` };
    if (msg.includes("contact") || msg.includes("help") || msg.includes("support") || msg.includes("mail") || msg.includes("email") || msg.includes("arunabh")) return { role: "assistant", content: localKnowledge.contact };

    return {
        content: `I'm having a bit of trouble reaching my full intelligence module right now, but I'm still here to help! I can answer questions about AI Scoring, Proctoring, Security, or the 3D Experience. What would you like to know?`,
        role: "assistant"
    };
}




async function generateProctoringNarrative(proctorEvents) {
    const openai = getOpenAI();
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
    const openai = getOpenAI();
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
