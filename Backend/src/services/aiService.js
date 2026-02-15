const { OpenAI } = require("openai");

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Evaluates a subjective student answer against a reference context using OpenAI.
 * @param {string} studentAnswer 
 * @param {string} context 
 * @param {number} pointsPossible 
 */
async function evaluateSubjectiveAnswer(studentAnswer, context, pointsPossible) {
    if (!openai) {
        throw new Error("OpenAI API key missing. Please set OPENAI_API_KEY in .env");
    }

    const prompt = `
    You are an expert evaluator for subjective technical questions.
    Evaluate the student's answer based on the provided reference context.
    
    Context: "${context}"
    Student Answer: "${studentAnswer}"
    Total Points Possible: ${pointsPossible}
    
    Instructions:
    1. Compare the student's answer with the context for accuracy, depth, and completeness.
    2. Assign a fair score from 0 to ${pointsPossible}.
    3. Provide concise, constructive feedback for the student (max 2 sentences).
    4. Provide a confidence score (0-1) for your evaluation based on how clearly the context supports/refutes the answer.
    5. Briefly explain your reasoning (justification).
    
    Return the response in JSON format:
    {
      "score": number,
      "feedback": "string",
      "confidence": number,
      "reasoning": "string"
    }
  `;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4-turbo",
            messages: [
                { role: "system", content: "You are a professional academic grader assistant." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);

        // Ensure score is within bounds
        result.score = Math.max(0, Math.min(pointsPossible, Number(result.score) || 0));

        return result;
    } catch (error) {
        console.error("OpenAI Evaluation Error:", error);
        throw error;
    }
}

module.exports = { evaluateSubjectiveAnswer };
