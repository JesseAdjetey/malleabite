"use strict";
/**
 * vapiLlm — OpenAI-compatible chat completions endpoint for VAPI custom LLM.
 *
 * VAPI sends a standard OpenAI `POST /chat/completions` request (with streaming).
 * We forward the messages to Gemini and stream back an OpenAI-compatible SSE response
 * so VAPI can use our Gemini backend for voice conversations.
 *
 * VAPI auth: VAPI sends `Authorization: Bearer <vapi-server-secret>` — we verify this
 * against the VAPI_SERVER_SECRET Firebase secret to prevent unauthorized access.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vapiLlm = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const generative_ai_1 = require("@google/generative-ai");
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
const vapiServerSecret = (0, params_1.defineSecret)('VAPI_SERVER_SECRET');
// Convert OpenAI message roles to Gemini roles
function toGeminiHistory(messages) {
    const history = [];
    for (const msg of messages) {
        if (msg.role === 'system')
            continue; // system handled separately as instruction
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const text = typeof msg.content === 'string'
            ? msg.content
            : (msg.content?.[0]?.text ?? '');
        if (!text)
            continue;
        history.push({ role, parts: [{ text }] });
    }
    return history;
}
// Extract system prompt from messages array
function extractSystemPrompt(messages) {
    return messages
        .filter(m => m.role === 'system')
        .map(m => (typeof m.content === 'string' ? m.content : m.content?.[0]?.text ?? ''))
        .join('\n\n');
}
// Extract last user message
function extractLastUserMessage(messages) {
    const userMsgs = messages.filter(m => m.role === 'user');
    const last = userMsgs[userMsgs.length - 1];
    if (!last)
        return '';
    return typeof last.content === 'string' ? last.content : last.content?.[0]?.text ?? '';
}
// Build one SSE chunk in OpenAI delta format
function sseChunk(id, delta, finish = null) {
    const payload = {
        id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'gemini-2.5-flash',
        choices: [
            {
                index: 0,
                delta: finish ? {} : { role: 'assistant', content: delta },
                finish_reason: finish,
            },
        ],
    };
    return `data: ${JSON.stringify(payload)}\n\n`;
}
exports.vapiLlm = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    secrets: [geminiApiKey, vapiServerSecret],
}, async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    // Verify VAPI server secret
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const secret = vapiServerSecret.value();
    if (secret && token !== secret) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const { messages = [], stream = true } = req.body;
    if (!messages.length) {
        res.status(400).json({ error: 'No messages provided' });
        return;
    }
    const systemPrompt = extractSystemPrompt(messages);
    const userMessage = extractLastUserMessage(messages);
    // History = everything except system messages and the last user message
    const historyMessages = messages.filter((m) => m.role !== 'system').slice(0, -1);
    const geminiHistory = toGeminiHistory(historyMessages);
    const genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt || undefined,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
        },
    });
    const completionId = `chatcmpl-${Date.now()}`;
    if (!stream) {
        // Non-streaming fallback (VAPI usually uses streaming but just in case)
        try {
            const chat = model.startChat({ history: geminiHistory });
            const result = await chat.sendMessage(userMessage);
            const text = result.response.text();
            res.json({
                id: completionId,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'gemini-2.5-flash',
                choices: [
                    {
                        index: 0,
                        message: { role: 'assistant', content: text },
                        finish_reason: 'stop',
                    },
                ],
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Gemini error' });
        }
        return;
    }
    // Streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    try {
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessageStream(userMessage);
        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
                res.write(sseChunk(completionId, text));
            }
        }
        res.write(sseChunk(completionId, '', 'stop'));
        res.write('data: [DONE]\n\n');
    }
    catch (err) {
        console.error('[vapiLlm] Gemini error:', err);
        res.write(sseChunk(completionId, 'Sorry, I ran into an issue. Please try again.', 'stop'));
        res.write('data: [DONE]\n\n');
    }
    finally {
        res.end();
    }
});
//# sourceMappingURL=vapi-llm.js.map