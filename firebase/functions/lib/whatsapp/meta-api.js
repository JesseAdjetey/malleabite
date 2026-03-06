"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTextMessage = sendTextMessage;
exports.sendButtonMessage = sendButtonMessage;
exports.sendListMessage = sendListMessage;
exports.markAsRead = markAsRead;
exports.sendReaction = sendReaction;
/**
 * Meta Cloud API client for sending WhatsApp messages.
 * Handles text, interactive buttons, and list messages.
 */
const axios_1 = __importDefault(require("axios"));
const META_API_BASE = 'https://graph.facebook.com/v21.0';
// ─── Text Messages ────────────────────────────────────────────────────────────
async function sendTextMessage(opts, text) {
    await axios_1.default.post(`${META_API_BASE}/${opts.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: opts.to,
        type: 'text',
        text: { body: text },
    }, {
        headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            'Content-Type': 'application/json',
        },
    });
}
async function sendButtonMessage(opts, body, buttons, header, footer) {
    const interactive = {
        type: 'button',
        body: { text: body },
        action: {
            buttons: buttons.slice(0, 3).map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
        },
    };
    if (header)
        interactive.header = { type: 'text', text: header };
    if (footer)
        interactive.footer = { text: footer };
    await axios_1.default.post(`${META_API_BASE}/${opts.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: opts.to,
        type: 'interactive',
        interactive,
    }, {
        headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            'Content-Type': 'application/json',
        },
    });
}
async function sendListMessage(opts, body, buttonText, sections, header, footer) {
    const interactive = {
        type: 'list',
        body: { text: body },
        action: {
            button: buttonText.slice(0, 20),
            sections: sections.map((s) => ({
                title: s.title,
                rows: s.rows.map((r) => ({
                    id: r.id,
                    title: r.title.slice(0, 24),
                    description: r.description?.slice(0, 72),
                })),
            })),
        },
    };
    if (header)
        interactive.header = { type: 'text', text: header };
    if (footer)
        interactive.footer = { text: footer };
    await axios_1.default.post(`${META_API_BASE}/${opts.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: opts.to,
        type: 'interactive',
        interactive,
    }, {
        headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            'Content-Type': 'application/json',
        },
    });
}
// ─── Mark message as read ─────────────────────────────────────────────────────
async function markAsRead(opts, messageId) {
    await axios_1.default.post(`${META_API_BASE}/${opts.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
    }, {
        headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            'Content-Type': 'application/json',
        },
    });
}
// ─── Reaction Messages ────────────────────────────────────────────────────────
async function sendReaction(opts, messageId, emoji) {
    await axios_1.default.post(`${META_API_BASE}/${opts.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: opts.to,
        type: 'reaction',
        reaction: { message_id: messageId, emoji },
    }, {
        headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            'Content-Type': 'application/json',
        },
    });
}
//# sourceMappingURL=meta-api.js.map