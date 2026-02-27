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

        // Use verified model IDs. gemini-2.0-flash is confirmed working with this key.
        const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-pro"];
        let lastError = null;

        for (const modelId of modelsToTry) {
            try {
                // Correctly format systemInstruction for the SDK
                const model = genAI.getGenerativeModel({
                    model: modelId,
                    systemInstruction: {
                        role: "system",
                        parts: [{ text: systemPrompt }]
                    }
                }, { apiVersion: "v1beta" });

                let validHistory = [];
                const firstUserIdx = history.findIndex(msg => msg.role === 'user');

                if (firstUserIdx !== -1) {
                    const slicedHistory = history.slice(firstUserIdx);
                    for (let i = 0; i < slicedHistory.length; i++) {
                        const expectedRole = (i % 2 === 0) ? 'user' : 'assistant';
                        if (slicedHistory[i].role === expectedRole) {
                            validHistory.push(slicedHistory[i]);
                        } else {
                            break;
                        }
                    }
                    if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
                        validHistory.pop();
                    }
                }

                const historyBuffer = validHistory.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }));

                const chat = model.startChat({
                    history: historyBuffer || [],
                });

                const result = await chat.sendMessage(userMessage);
                const response = await result.response;

                return {
                    content: response.text(),
                    role: "assistant"
                };
            } catch (error) {
                lastError = error;
                // Silent fallback for 404s, log others
                if (!error.message.includes("404") && !error.message.includes("not found")) {
                    console.error(`[Gemini Debug] Model ${modelId} failed:`, error.message);
                    break;
                }
            }
        }

        throw lastError;
    } catch (error) {
        throw error;
    }
}

module.exports = { getGeminiResponse };
