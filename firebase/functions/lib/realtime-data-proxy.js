"use strict";
/**
 * Realtime Data Proxy — keeps API keys server-side only.
 *
 * The frontend calls this single endpoint with { action, params },
 * and this function dispatches to the appropriate external API.
 */
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
exports.realtimeDataProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const realtime_data_1 = require("./realtime-data");
const openweatherKey = (0, params_1.defineSecret)('OPENWEATHER_API_KEY');
const alphavantageKey = (0, params_1.defineSecret)('ALPHAVANTAGE_API_KEY');
const aviationstackKey = (0, params_1.defineSecret)('AVIATIONSTACK_API_KEY');
const braveSearchKey = (0, params_1.defineSecret)('BRAVE_SEARCH_API_KEY');
exports.realtimeDataProxy = (0, https_1.onRequest)({
    cors: [
        'http://localhost:8080',
        'http://localhost:8081',
        'http://localhost:5173',
        'http://localhost:3000',
        'https://malleabite-97d35.web.app',
        'https://malleabite-97d35.firebaseapp.com',
        'https://malleabite.vercel.app',
        /\.vercel\.app$/,
    ],
    region: 'us-central1',
    secrets: [openweatherKey, alphavantageKey, aviationstackKey, braveSearchKey],
}, async (req, res) => {
    // Preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    // Auth — require a logged-in user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
    }
    try {
        await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
    const { action, params } = req.body;
    try {
        let data = null;
        switch (action) {
            case 'get_weather':
                data = await (0, realtime_data_1.getWeather)(params.location, openweatherKey.value());
                break;
            case 'get_stock_price':
                data = await (0, realtime_data_1.getStockPrice)(params.symbol, alphavantageKey.value());
                break;
            case 'get_flight_status':
                data = await (0, realtime_data_1.getFlightStatus)(params.flightNumber, aviationstackKey.value());
                break;
            case 'search_web':
                data = await (0, realtime_data_1.searchWeb)(params.query, braveSearchKey.value(), params.count);
                break;
            default:
                res.status(400).json({ error: `Unknown action: ${action}` });
                return;
        }
        res.status(200).json({ data });
    }
    catch (err) {
        console.error('[realtimeDataProxy] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=realtime-data-proxy.js.map