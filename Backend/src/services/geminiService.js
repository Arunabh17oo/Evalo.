const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Gets a response from Google Gemini AI.
 * Dynamically checks for API key to ensure it picks up environment changes.
 */
async function getGeminiResponse(userMessage, history = [], systemPrompt = "") {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("Gemini API key missing.");
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Using 'gemini-flash-latest' which is verified to work with the provided key.
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const contents = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...history.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            })),
            { role: 'user', parts: [{ text: userMessage }] }
        ];

        const result = await model.generateContent({ contents });
        const response = await result.response;
        return {
            content: response.text(),
            role: "assistant"
        };
    } catch (error) {
        console.error("[Gemini Service Error]:", error.message);
        throw error;
    }
}

module.exports = { getGeminiResponse };
