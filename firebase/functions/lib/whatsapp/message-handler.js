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
exports.handleIncomingMessage = handleIncomingMessage;
/**
 * Core message handler — routes incoming WhatsApp messages to the appropriate action.
 * Supports: text commands, interactive button replies, list selections, and group @mentions.
 */
const admin = __importStar(require("firebase-admin"));
const meta_api_1 = require("./meta-api");
const account_linking_1 = require("./account-linking");
const db = () => admin.firestore();
// ─── Main Entry Point ─────────────────────────────────────────────────────────
async function handleIncomingMessage(ctx, message) {
    const send = {
        phoneNumberId: ctx.phoneNumberId,
        accessToken: ctx.accessToken,
        to: ctx.from,
    };
    // Mark as read immediately
    await (0, meta_api_1.markAsRead)({ phoneNumberId: ctx.phoneNumberId, accessToken: ctx.accessToken }, ctx.messageId).catch(() => { }); // non-critical
    // Extract text from different message types
    let text = '';
    let interactiveId = '';
    if (message.type === 'text') {
        text = message.text?.body?.trim() || '';
    }
    else if (message.type === 'interactive') {
        if (message.interactive?.type === 'button_reply') {
            interactiveId = message.interactive.button_reply.id;
            text = message.interactive.button_reply.title;
        }
        else if (message.interactive?.type === 'list_reply') {
            interactiveId = message.interactive.list_reply.id;
            text = message.interactive.list_reply.title;
        }
    }
    else {
        // Unsupported message type
        await (0, meta_api_1.sendTextMessage)(send, '🤖 I can handle text messages and button selections. Try sending me a text!');
        return;
    }
    // Strip bot mention tag in group messages (e.g., "@Mally create event...")
    if (ctx.isGroup) {
        text = text.replace(/@\S+\s*/i, '').trim();
    }
    const textLower = text.toLowerCase();
    // ─── Check if user is linked ──────────────────────────────────────────────
    const userId = await (0, account_linking_1.getLinkedUserId)(ctx.from);
    // Handle link code attempts (6-digit number from unlinked users)
    if (!userId && /^\d{6}$/.test(text)) {
        const result = await (0, account_linking_1.redeemLinkCode)(ctx.from, text);
        if (result.success) {
            await (0, meta_api_1.sendTextMessage)(send, '✅ Account linked successfully! You can now use Mally on WhatsApp.\n\nType *menu* to see what I can do.');
            return;
        }
        else {
            await (0, meta_api_1.sendTextMessage)(send, `❌ ${result.error}`);
            return;
        }
    }
    // Not linked — prompt to link
    if (!userId) {
        await (0, meta_api_1.sendButtonMessage)(send, 'Welcome to Mally! 🗓️\n\nTo get started, you need to link your Malleabite account.\n\n1. Open the Malleabite app\n2. Go to Settings → WhatsApp\n3. Click "Generate Link Code"\n4. Send the 6-digit code here', [{ id: 'help_link', title: '❓ How to link' }], 'Link Your Account');
        return;
    }
    // ─── Handle interactive button/list replies ─────────────────────────────────
    if (interactiveId) {
        await handleInteractiveReply(send, userId, interactiveId);
        return;
    }
    // ─── Handle text commands ───────────────────────────────────────────────────
    if (textLower === 'menu' || textLower === 'help' || textLower === 'start') {
        await sendMainMenu(send);
        return;
    }
    if (textLower === 'today' || textLower === 'schedule') {
        await sendTodaySchedule(send, userId);
        return;
    }
    if (textLower === 'todos' || textLower === 'tasks') {
        await sendTodoLists(send, userId);
        return;
    }
    if (textLower === 'unlink') {
        const { unlinkAccount } = await Promise.resolve().then(() => __importStar(require('./account-linking')));
        await unlinkAccount(ctx.from);
        await (0, meta_api_1.sendTextMessage)(send, '🔓 Account unlinked. Send a new link code anytime to reconnect.');
        return;
    }
    // ─── Fallback: Send to Mally AI ────────────────────────────────────────────
    await handleAIMessage(send, userId, text);
}
// ─── Main Menu ────────────────────────────────────────────────────────────────
async function sendMainMenu(send) {
    await (0, meta_api_1.sendListMessage)(send, '👋 Hey! I\'m Mally, your calendar & productivity assistant on WhatsApp.\n\nWhat would you like to do?', 'See Options', [
        {
            title: '📅 Calendar',
            rows: [
                { id: 'menu_today', title: "Today's Schedule", description: 'See your events for today' },
                { id: 'menu_tomorrow', title: "Tomorrow's Schedule", description: 'See what\'s planned for tomorrow' },
                { id: 'menu_create_event', title: 'Create Event', description: 'Add a new calendar event' },
            ],
        },
        {
            title: '✅ Tasks',
            rows: [
                { id: 'menu_todos', title: 'View Todos', description: 'See your todo lists' },
                { id: 'menu_add_todo', title: 'Add Todo', description: 'Create a new task' },
            ],
        },
        {
            title: '🤖 AI Assistant',
            rows: [
                { id: 'menu_ai', title: 'Chat with Mally', description: 'Ask Mally anything' },
            ],
        },
        {
            title: '⚙️ Account',
            rows: [
                { id: 'menu_unlink', title: 'Unlink Account', description: 'Disconnect WhatsApp from Malleabite' },
            ],
        },
    ], 'Mally on WhatsApp', 'Type anything to chat with Mally AI');
}
// ─── Interactive Reply Router ─────────────────────────────────────────────────
async function handleInteractiveReply(send, userId, replyId) {
    switch (replyId) {
        case 'menu_today':
            await sendTodaySchedule(send, userId);
            break;
        case 'menu_tomorrow':
            await sendTomorrowSchedule(send, userId);
            break;
        case 'menu_create_event':
            await (0, meta_api_1.sendTextMessage)(send, '📅 To create an event, just describe it naturally!\n\nExamples:\n• "Meeting with Sarah tomorrow at 2pm"\n• "Dentist appointment March 15 at 10am"\n• "Weekly standup every Monday at 9am"');
            break;
        case 'menu_todos':
            await sendTodoLists(send, userId);
            break;
        case 'menu_add_todo':
            await (0, meta_api_1.sendTextMessage)(send, '✅ To add a todo, just tell me!\n\nExamples:\n• "Add buy groceries to my shopping list"\n• "Todo: finish the report"\n• "Remind me to call Mom"');
            break;
        case 'menu_ai':
            await (0, meta_api_1.sendTextMessage)(send, '🤖 Just type anything and I\'ll respond as Mally!\n\nI can help with:\n• Scheduling & calendar management\n• Creating todos & tasks\n• Answering questions about your schedule\n• General productivity advice');
            break;
        case 'menu_unlink':
            await (0, meta_api_1.sendButtonMessage)(send, 'Are you sure you want to unlink your Malleabite account?', [
                { id: 'confirm_unlink', title: '🔓 Yes, unlink' },
                { id: 'cancel_unlink', title: '↩️ Cancel' },
            ]);
            break;
        case 'confirm_unlink': {
            const { unlinkAccount } = await Promise.resolve().then(() => __importStar(require('./account-linking')));
            // need the phone number — derive from send.to
            await unlinkAccount(send.to);
            await (0, meta_api_1.sendTextMessage)(send, '🔓 Account unlinked. Send a new link code anytime to reconnect.');
            break;
        }
        case 'cancel_unlink':
            await (0, meta_api_1.sendTextMessage)(send, '👍 No changes made.');
            break;
        case 'help_link':
            await (0, meta_api_1.sendTextMessage)(send, '🔗 *How to link your account:*\n\n1. Open malleabite.vercel.app\n2. Log in to your account\n3. Go to Settings → WhatsApp\n4. Click "Generate Link Code"\n5. Copy the 6-digit code\n6. Send it to me here\n\nThe code expires in 10 minutes.');
            break;
        default:
            // Handle dynamic todo list selection (e.g., "todolist_<listId>")
            if (replyId.startsWith('todolist_')) {
                const listId = replyId.replace('todolist_', '');
                await sendTodoItems(send, userId, listId);
            }
            else {
                await (0, meta_api_1.sendTextMessage)(send, 'I didn\'t recognize that option. Type *menu* to see available commands.');
            }
    }
}
// ─── Calendar Helpers ─────────────────────────────────────────────────────────
async function sendTodaySchedule(send, userId) {
    const events = await getEventsForDate(userId, new Date());
    if (events.length === 0) {
        await (0, meta_api_1.sendTextMessage)(send, '📅 *Today\'s Schedule*\n\nNo events today! 🎉 Enjoy your free time.\n\nType *menu* for more options.');
        return;
    }
    const formatted = formatEvents(events);
    await (0, meta_api_1.sendTextMessage)(send, `📅 *Today's Schedule*\n\n${formatted}\n\n_Type anything to chat with Mally_`);
}
async function sendTomorrowSchedule(send, userId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const events = await getEventsForDate(userId, tomorrow);
    if (events.length === 0) {
        await (0, meta_api_1.sendTextMessage)(send, '📅 *Tomorrow\'s Schedule*\n\nNothing planned for tomorrow.\n\nType *menu* for more options.');
        return;
    }
    const formatted = formatEvents(events);
    await (0, meta_api_1.sendTextMessage)(send, `📅 *Tomorrow's Schedule*\n\n${formatted}`);
}
async function getEventsForDate(userId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const snapshot = await db()
        .collection('calendar_events')
        .where('user_id', '==', userId)
        .where('start_date', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
        .where('start_date', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
        .orderBy('start_date', 'asc')
        .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
function formatEvents(events) {
    return events
        .map((e) => {
        const start = e.start_date?.toDate?.();
        const end = e.end_date?.toDate?.();
        const time = start
            ? `${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}${end ? ' - ' + end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}`
            : 'All day';
        return `• *${e.title}* — ${time}`;
    })
        .join('\n');
}
// ─── Todo Helpers ─────────────────────────────────────────────────────────────
async function sendTodoLists(send, userId) {
    const snapshot = await db()
        .collection('todo_lists')
        .where('userId', '==', userId)
        .get();
    if (snapshot.empty) {
        // Check for default todos collection
        const todosSnapshot = await db()
            .collection('todos')
            .where('user_id', '==', userId)
            .where('completed', '==', false)
            .limit(20)
            .get();
        if (todosSnapshot.empty) {
            await (0, meta_api_1.sendTextMessage)(send, '✅ *Your Todos*\n\nNo todos yet! Tell me something to add, like:\n"Add buy milk to my list"');
            return;
        }
        const todos = todosSnapshot.docs.map((d) => d.data());
        const formatted = todos.map((t) => `• ${t.completed ? '~~' + t.text + '~~' : t.text}`).join('\n');
        await (0, meta_api_1.sendTextMessage)(send, `✅ *Your Todos*\n\n${formatted}`);
        return;
    }
    const rows = snapshot.docs.map((doc) => ({
        id: `todolist_${doc.id}`,
        title: (doc.data().name || 'Untitled').slice(0, 24),
        description: `${doc.data().itemCount || 0} items`,
    }));
    await (0, meta_api_1.sendListMessage)(send, '✅ *Your Todo Lists*\n\nSelect a list to see its items:', 'View Lists', [{ title: 'Todo Lists', rows }]);
}
async function sendTodoItems(send, userId, listId) {
    const snapshot = await db()
        .collection('todo_items')
        .where('listId', '==', listId)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
    if (snapshot.empty) {
        await (0, meta_api_1.sendTextMessage)(send, '📋 This list is empty. Tell me what to add!');
        return;
    }
    const items = snapshot.docs.map((d) => d.data());
    const formatted = items
        .map((t) => `${t.completed ? '✅' : '⬜'} ${t.text}`)
        .join('\n');
    await (0, meta_api_1.sendTextMessage)(send, `📋 *List Items*\n\n${formatted}`);
}
// ─── Mally AI Handler ─────────────────────────────────────────────────────────
async function handleAIMessage(send, userId, text) {
    try {
        // Send typing indicator via reaction
        await (0, meta_api_1.sendReaction)(send, '', '🤔').catch(() => { });
        // Call the processAIRequest function internally
        // We'll import and call the AI processing logic directly
        const { processAIRequestInternal } = await Promise.resolve().then(() => __importStar(require('./ai-processor')));
        const response = await processAIRequestInternal(userId, text);
        if (response.error) {
            await (0, meta_api_1.sendTextMessage)(send, `⚠️ ${response.error}`);
            return;
        }
        // Send the AI response
        let reply = response.text || 'I processed your request!';
        // If the AI created something, add a confirmation
        if (response.actions && response.actions.length > 0) {
            const actionSummary = response.actions
                .map((a) => {
                if (a.type === 'create_event')
                    return `📅 Created event: *${a.title}*`;
                if (a.type === 'create_todo')
                    return `✅ Added todo: *${a.text}*`;
                if (a.type === 'create_alarm')
                    return `⏰ Set alarm: *${a.label}*`;
                return `✓ ${a.type}`;
            })
                .join('\n');
            reply += `\n\n${actionSummary}`;
        }
        // WhatsApp max message length is 4096
        if (reply.length > 4000) {
            reply = reply.slice(0, 3997) + '...';
        }
        await (0, meta_api_1.sendTextMessage)(send, reply);
    }
    catch (error) {
        console.error('AI handler error:', error);
        await (0, meta_api_1.sendTextMessage)(send, '🤖 Sorry, I had trouble processing that. Try again, or type *menu* for quick actions.');
    }
}
//# sourceMappingURL=message-handler.js.map