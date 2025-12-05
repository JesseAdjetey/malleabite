"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAIRequest = void 0;
var functions = require("firebase-functions");
var admin = require("firebase-admin");
// Initialize Firebase Admin
admin.initializeApp();
// CORS configuration
var corsOptions = {
    origin: true, // Allow all origins in development
    credentials: true,
};
/**
 * Process AI requests for intelligent scheduling
 * This is a placeholder that returns intelligent responses based on the user's message
 */
exports.processAIRequest = functions.https.onRequest(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, message, userId, context, lowerMessage, response, titleMatch, title, tomorrow, today, timeMatch, startTime, hours, minutes, period, endTime;
    var _b;
    return __generator(this, function (_c) {
        // Enable CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return [2 /*return*/];
        }
        try {
            _a = req.body.data || req.body, message = _a.message, userId = _a.userId, context = _a.context;
            if (!message || !userId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: message and userId'
                });
                return [2 /*return*/];
            }
            lowerMessage = message.toLowerCase();
            response = {
                success: true,
                response: '',
                eventData: null,
                conflicts: []
            };
            // Greeting detection
            if (lowerMessage.match(/\b(hi|hello|hey|greetings)\b/)) {
                response.response = "Hello! I'm Mally, your intelligent scheduling assistant. I can help you create calendar events, check your schedule, and manage your time effectively. Try asking me to 'schedule a meeting tomorrow at 2 PM' or 'what's on my calendar today?'";
                res.json(response);
                return [2 /*return*/];
            }
            // Schedule/Create event detection
            if (lowerMessage.match(/\b(schedule|create|add|book|set up)\b.*\b(meeting|event|appointment|call|session)\b/)) {
                titleMatch = lowerMessage.match(/(?:schedule|create|add|book|set up)\s+(?:a\s+)?(?:meeting|event|appointment|call|session)\s+(?:called|named|titled)?\s*["']?([^"']+?)["']?\s*(?:at|for|on|tomorrow|today|next)/i);
                title = titleMatch ? titleMatch[1].trim() : 'New Event';
                tomorrow = lowerMessage.includes('tomorrow');
                today = lowerMessage.includes('today');
                timeMatch = lowerMessage.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?/i);
                startTime = new Date();
                if (tomorrow) {
                    startTime.setDate(startTime.getDate() + 1);
                }
                if (timeMatch) {
                    hours = parseInt(timeMatch[1]);
                    minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                    period = (_b = timeMatch[3]) === null || _b === void 0 ? void 0 : _b.toLowerCase();
                    if (period === 'pm' && hours < 12)
                        hours += 12;
                    if (period === 'am' && hours === 12)
                        hours = 0;
                    startTime.setHours(hours, minutes, 0, 0);
                }
                else {
                    startTime.setHours(14, 0, 0, 0); // Default to 2 PM
                }
                endTime = new Date(startTime);
                endTime.setHours(endTime.getHours() + 1); // Default 1-hour duration
                response.response = "I've prepared a calendar event for \"".concat(title, "\" on ").concat(startTime.toLocaleDateString(), " at ").concat(startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ". The event will be created when you confirm.");
                response.eventData = {
                    title: title,
                    startsAt: startTime.toISOString(),
                    endsAt: endTime.toISOString(),
                    description: "Created by Mally AI from: \"".concat(message, "\""),
                    color: '#3b82f6'
                };
                res.json(response);
                return [2 /*return*/];
            }
            // View schedule detection
            if (lowerMessage.match(/\b(show|view|check|what|what's|whats)\b.*\b(schedule|calendar|events|appointments)\b/)) {
                response.response = "To view your schedule, check the calendar view on your dashboard. I can see that you currently have no events scheduled. Would you like me to create one for you?";
                res.json(response);
                return [2 /*return*/];
            }
            // Default response
            response.response = "I'm here to help you manage your schedule! You can ask me to:\n• Schedule meetings or events\n• Check your calendar\n• Find available time slots\n• Manage your appointments\n\nTry saying something like 'schedule a team meeting tomorrow at 3 PM'";
            res.json(response);
        }
        catch (error) {
            console.error('Error processing AI request:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        return [2 /*return*/];
    });
}); });
