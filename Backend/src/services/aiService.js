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

module.exports = { evaluateSubjectiveAnswer };
