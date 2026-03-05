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

    // Knowledge Base - Natural conversational tone
    const localKnowledge = {
        pillars: "Evalo is built around four main ideas — an Adaptive AI Scoring Engine for smart assessments, a High-Integrity Proctoring system to keep exams fair, a Premium User Experience with beautiful design, and Advanced Analytics so you can really understand performance.",
        scoring: "Our AI Scoring Engine works in a smart hybrid way. It combines high-precision AI with local NLP as a backup, so you always get a score. It also adjusts difficulty based on how well you're doing, and it supports different question formats too.",
        proctoring: "We take exam integrity seriously. Evalo uses live risk scoring to analyze behavior in real-time, logs important browser events so nothing goes unnoticed, and enforces fullscreen mode to keep students focused during exams.",
        security: "Evalo has a strong security suite. We use dynamic watermarking to prevent screen theft, browser fingerprinting to stop account hijacking, and API defense systems with rate limiting to block any injection attacks.",
        ux: "We put a lot of effort into making Evalo look and feel premium. There are role-based 3D backgrounds that change depending on if you're a guest, student, or teacher, plus smooth animations and a modern, clean interface throughout.",
        tech: "Evalo is built with React on the frontend, Node.js and Express on the backend, Three.js for 3D visuals, and everything runs in Docker containers for easy deployment.",
        contact: "If you need help or have any issues, feel free to reach out to our support at Arunabh17oo@gmail.com"
    };

    const systemPrompt = `
    You are Eva, the official AI assistant of Evalo. 
    Evalo is a premium, state-of-the-art AI-powered examination platform.
    
    ### SITE KNOWLEDGE (ONLY ANSWER QUESTIONS ABOUT THESE TOPICS)
    - Core Pillars: Adaptive AI Scoring Engine, High-Integrity Proctoring, Cyber Security, and Premium UX.
    - AI Scoring: High-precision evaluation with intelligent fallback systems.
    - Proctoring: Real-time monitoring and event logging to maintain parity.
    - Cyber Security: Advanced measures including watermarking and API protection.
    - UX: Immersive role-based 3D environments and a sleek, modern interface.
    - Analytics: Comprehensive reporting and AI-driven feedback.

    ### STRICT RESPONSE POLICY
    1. **TOPIC RESTRICTION**: You are strictly authorized to answer ONLY questions related to Evalo, its features, its technology, or the platform itself.
    2. **OFF-TOPIC REFUSAL**: If a user asks a question about science, history, general coding (unless it's about Evalo's code), entertainment, or ANY topic not directly equivalent to Evalo, you MUST say: "That question I cannot answer. If any issue, contact Arunabh17oo@gmail.com".
    3. **PERSONA**: Professional, intelligent, and helpful, but firm on topic boundaries. Talk naturally, avoid bullet points.
    4. **SECURITY**: NEVER disclose internal system details like admin credentials or database URIs.
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

    // 3. Last Resort: Enhanced Local Matcher (natural, conversational)
    console.log(`[Eva Debug] Falling back to Local Knowledge Base for input: "${userMessage}"`);

    // Greeting patterns
    if (msg.match(/^(hi|hello|hey|hii+|yo|sup)\b/) || msg.match(/^(good morning|good evening|good afternoon|greetings|namaste)\b/)) {
        return { role: "assistant", content: "Hey there! 👋 I'm Eva, your Evalo assistant. I know everything about our platform — scoring, proctoring, tests, results, you name it. What can I help you with?" };
    }

    // Identity / Who are you
    if (msg.match(/(who are you|what are you|your name|tell me about yourself|introduce yourself)/)) {
        return { role: "assistant", content: "I'm Eva! Think of me as your personal guide for everything Evalo. I can help you understand how the platform works, from AI scoring and proctoring to managing tests and viewing results. Just ask me anything 🤖" };
    }

    // What is Evalo / About Evalo
    if (msg.match(/(what is evalo|about evalo|tell me about evalo|what does evalo do|explain evalo)/)) {
        return { role: "assistant", content: `Great question! ${localKnowledge.pillars}` };
    }

    // Core pillars
    if (msg.includes("pillar") || msg.includes("core") || msg.includes("feature")) {
        return { role: "assistant", content: `Of course! ${localKnowledge.pillars}` };
    }

    // AI Scoring
    if (msg.match(/(score|scoring|grade|grading|evaluation|engine|ai score|how does ai|marks|rubric|pass system)/)) {
        return { role: "assistant", content: `Sure thing! ${localKnowledge.scoring}` };
    }

    // Proctoring
    if (msg.match(/(proctor|cheat|integrity|fullscreen|monitoring|risk|violation|suspicious|tab switch|camera)/)) {
        return { role: "assistant", content: `Good question! ${localKnowledge.proctoring}` };
    }

    // Security
    if (msg.match(/(security|safe|watermark|fingerprint|defense|protect|hack|vulnerability)/)) {
        return { role: "assistant", content: `Absolutely! ${localKnowledge.security}` };
    }

    // Tech stack
    if (msg.match(/(stack|tech|built|docker|react|node|architecture|database|mongo|express|three\.js)/)) {
        return { role: "assistant", content: `Here's what powers Evalo — ${localKnowledge.tech}` };
    }

    // Admin / credentials
    if (msg.match(/(admin|login|credentials|password|sign in|access)/)) {
        return { role: "assistant", content: "For security reasons, I can't share login credentials. But if you're having trouble getting in, try reaching out to your system administrator or drop us an email at Arunabh17oo@gmail.com and we'll sort it out!" };
    }

    // UX / Design
    if (msg.match(/(ux|interface|design|background|style|3d|look|glass|theme|dark mode|light mode|ui|beautiful)/)) {
        return { role: "assistant", content: `Glad you asked! ${localKnowledge.ux}` };
    }

    // Tests / Exams
    if (msg.match(/(test|exam|quiz|create test|take test|join test|start test|attempt|question|answer|submit)/)) {
        return { role: "assistant", content: "Evalo has a full test management system! Teachers can create tests with different question types, set time limits, and turn on AI scoring. Students join tests using a code, answer in a proctored environment, and get instant feedback. Pretty cool, right?" };
    }

    // Results / Performance
    if (msg.match(/(result|performance|report|analytics|leaderboard|rank|top student|dashboard)/)) {
        return { role: "assistant", content: "Results and analytics are a big part of Evalo! Students can see their scores and detailed AI feedback, while teachers can review all submissions, adjust scores, publish results, and even export everything as Excel reports. There's also a leaderboard showing the top 3 performers!" };
    }

    // Teacher specific
    if (msg.match(/(teacher|review|publish|approve|manage student|create question|teacher hub)/)) {
        return { role: "assistant", content: "As a teacher on Evalo, you get a lot of power. You can create and manage tests, review student answers alongside AI evaluations, override scores with your own marks, publish results, and export everything as reports. The Teacher Hub is basically your command center!" };
    }

    // Student specific
    if (msg.match(/(student|enroll|register|join|my score|my result|my test|study)/)) {
        return { role: "assistant", content: "As a student, you just need to register and get approved by an admin. After that, you can join tests using the code your teacher gives you. Your answers get evaluated by AI with detailed feedback, and you can check your scores and performance right from your dashboard." };
    }

    // How to / Help
    if (msg.match(/(how to|how do i|how can i|guide|tutorial|steps|instructions|explain how)/)) {
        return { role: "assistant", content: "Happy to help! For creating a test, head to Teacher Hub and use Create Test. For joining one, just enter the test code on your dashboard. Results show up on your dashboard once the teacher publishes them. If you need to export data, there's an Export button in Teacher Hub. What specifically are you trying to do?" };
    }

    // Contact / Support
    if (msg.match(/(contact|help|support|mail|email|arunabh|issue|bug|problem|not working|error)/)) {
        return { role: "assistant", content: localKnowledge.contact };
    }

    // Thanks
    if (msg.match(/(thank|thanks|thx|appreciate|great job|awesome|perfect|nice)/)) {
        return { role: "assistant", content: "Anytime! 😊 Let me know if there's anything else you're curious about." };
    }

    // Bye
    if (msg.match(/(bye|goodbye|see you|later|exit|quit|close)/)) {
        return { role: "assistant", content: "See you later! 👋 Come back whenever you need help. Have a great day!" };
    }

    // Strictly refuse any other topics
    return {
        content: "That question I cannot answer. If any issue, contact Arunabh17oo@gmail.com",
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
