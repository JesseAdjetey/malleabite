"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeSpeech = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// Google Cloud TTS REST API endpoint
const TTS_API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
/**
 * Firebase Cloud Function that synthesizes speech using Google Cloud TTS.
 * Uses Application Default Credentials (ADC) — no API key needed since
 * Cloud Functions run in GCP with a service account.
 */
exports.synthesizeSpeech = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
    memory: '256MiB',
}, async (req, res) => {
    try {
        // Verify Firebase auth token
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        try {
            await admin.auth().verifyIdToken(idToken);
        }
        catch {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        const data = req.body.data || req.body;
        if (!data.text || data.text.trim().length === 0) {
            res.status(400).json({ error: 'Text is required' });
            return;
        }
        // Clean text for speech (remove markdown, URLs, emojis)
        const cleanText = data.text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links
            .replace(/[*_~`#]/g, '') // markdown formatting
            .replace(/https?:\/\/\S+/g, '') // URLs
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // emojis
            .trim();
        if (!cleanText) {
            res.status(400).json({ error: 'No speakable text after cleaning' });
            return;
        }
        // Get access token using ADC (Application Default Credentials)
        const accessToken = await admin.app().options.credential?.getAccessToken();
        if (!accessToken) {
            res.status(500).json({ error: 'Could not get access token' });
            return;
        }
        // Call Google Cloud TTS API
        const ttsResponse = await fetch(TTS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken.access_token}`,
            },
            body: JSON.stringify({
                input: { text: cleanText.substring(0, 5000) }, // Max 5000 chars
                voice: {
                    languageCode: data.languageCode || 'en-US',
                    name: data.voiceName || 'en-US-Neural2-F', // Natural female voice
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: data.speakingRate ?? 1.0,
                    pitch: data.pitch ?? 0.0,
                    effectsProfileId: ['handset-class-device'], // Optimized for mobile
                },
            }),
        });
        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            console.error('TTS API error:', errorText);
            res.status(ttsResponse.status).json({
                error: 'TTS API failed',
                details: errorText,
            });
            return;
        }
        const result = await ttsResponse.json();
        res.status(200).json({
            result: {
                audioContent: result.audioContent, // base64 MP3
            },
        });
    }
    catch (error) {
        console.error('synthesizeSpeech error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=tts.js.map