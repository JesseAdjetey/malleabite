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
 * WhatsApp Message Handler
 *
 * UX Philosophy:
 *   WhatsApp = quick capture tool. Bot detects, proposes, user approves.
 *   Minimal viewing. App for everything else.
 *
 * Core flow:
 *   1. User sends text (or forwards a message)
 *   2. AI detects intent → proposes action (event / todo)
 *   3. User confirms with [Yes] / [No] (or adjusts)
 *   4. Bot creates + shows confirmation with [Edit] [Undo]
 */
const admin = __importStar(require("firebase-admin"));
const meta_api_1 = require("./meta-api");
const account_linking_1 = require("./account-linking");
const session_1 = require("./session");
const db = () => admin.firestore();
// ─── Formatting Helpers ───────────────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d) {
    return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function fmtTime(d) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function fmtRange(start, end) {
    return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start);
}
// ─── Main Entry Point ─────────────────────────────────────────────────────────
async function handleIncomingMessage(ctx, message) {
    const send = {
        phoneNumberId: ctx.phoneNumberId,
        accessToken: ctx.accessToken,
        to: ctx.from,
    };
    // Mark as read
    await (0, meta_api_1.markAsRead)({ phoneNumberId: ctx.phoneNumberId, accessToken: ctx.accessToken }, ctx.messageId).catch(() => { });
    // ─── Extract text & interactive IDs ───────────────────────────────────────
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
        await (0, meta_api_1.sendTextMessage)(send, 'I work best with text messages! Forward a message or type what you need.');
        return;
    }
    // Strip @mention in groups
    if (ctx.isGroup) {
        text = text.replace(/@\S+\s*/i, '').trim();
    }
    const lo = text.toLowerCase();
    // ─── Account Linking ──────────────────────────────────────────────────────
    const userId = await (0, account_linking_1.getLinkedUserId)(ctx.from);
    // 6-digit code from unlinked user
    if (!userId && /^\d{6}$/.test(text)) {
        const result = await (0, account_linking_1.redeemLinkCode)(ctx.from, text);
        if (result.success) {
            await (0, meta_api_1.sendTextMessage)(send, `✅ Account linked! Forward me any message to create events or todos.`);
            return;
        }
        await (0, meta_api_1.sendTextMessage)(send, `❌ ${result.error}`);
        return;
    }
    // Unlinked user
    if (!userId) {
        await (0, meta_api_1.sendButtonMessage)(send, `🗓️ *Mally* — Your calendar assistant\n\nLink your Malleabite account to get started:\n\n` +
            `→ malleabite.vercel.app → Settings → WhatsApp\n\n` +
            `Send the 6-digit code here when ready.`, [{ id: 'help_link', title: 'How to Link' }]);
        return;
    }
    // ─── Interactive Replies ──────────────────────────────────────────────────
    if (interactiveId) {
        await handleInteractive(send, ctx, userId, interactiveId);
        return;
    }
    // ─── Confirm / Deny pending action ────────────────────────────────────────
    const pending = await (0, session_1.getPendingAction)(ctx.from);
    if (pending && isConfirmation(lo)) {
        await executePendingAction(send, ctx.from, userId, pending);
        return;
    }
    if (pending && isDenial(lo)) {
        await (0, session_1.clearPendingAction)(ctx.from);
        await (0, meta_api_1.sendTextMessage)(send, '👍 Cancelled.');
        return;
    }
    // If there's a pending action and user sends something else,
    // clear it and process the new message normally
    if (pending) {
        await (0, session_1.clearPendingAction)(ctx.from);
    }
    // ─── Text Commands ────────────────────────────────────────────────────────
    if (['menu', 'help', '?'].includes(lo)) {
        return sendHelp(send);
    }
    if (['today', 'schedule'].includes(lo)) {
        return sendTodaySchedule(send, userId);
    }
    if (['todos', 'tasks'].includes(lo)) {
        return sendTodos(send, userId);
    }
    if (lo === 'undo' || lo === 'edit last') {
        return handleUndo(send, ctx.from);
    }
    if (lo === 'unlink') {
        await (0, meta_api_1.sendButtonMessage)(send, 'Are you sure you want to unlink your account?', [{ id: 'confirm_unlink', title: 'Yes, Unlink' }, { id: 'cancel_unlink', title: 'Cancel' }]);
        return;
    }
    // ─── Forwarded Messages ───────────────────────────────────────────────────
    if (ctx.isForwarded) {
        await (0, meta_api_1.sendButtonMessage)(send, `I see a forwarded message. What should I do with it?`, [
            { id: 'fwd_event', title: 'Event' },
            { id: 'fwd_todo', title: 'Todo' },
            { id: 'fwd_ignore', title: 'Ignore' },
        ]);
        // Store the forwarded text in session for later use
        await (0, session_1.setPendingAction)(ctx.from, { type: 'create_event', title: text, description: text });
        return;
    }
    // ─── General Chat / Greetings ─────────────────────────────────────────────
    if (['hi', 'hello', 'hey', 'yo', 'sup', 'gm', 'good morning', 'good evening', 'good afternoon'].includes(lo)) {
        const name = await loadUserName(userId);
        await (0, meta_api_1.sendTextMessage)(send, `Hey${name ? `, ${name}` : ''}! 👋 Got something to add to your calendar or todos? Forward a message or just tell me.`);
        return;
    }
    // ─── AI Processing ────────────────────────────────────────────────────────
    await handleAIMessage(send, ctx, userId, text);
}
// ─── Confirmation Helpers ─────────────────────────────────────────────────────
function isConfirmation(text) {
    return ['yes', 'y', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'confirm', 'do it', '.', '👍'].includes(text);
}
function isDenial(text) {
    return ['no', 'n', 'nah', 'nope', 'cancel', 'never mind', 'nevermind', 'stop'].includes(text);
}
// ─── Execute Pending Action ───────────────────────────────────────────────────
async function executePendingAction(send, phone, userId, action) {
    await (0, session_1.clearPendingAction)(phone);
    if (action.type === 'create_event') {
        const start = action.start ? new Date(action.start) : null;
        const end = action.end ? new Date(action.end) : (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
        const docRef = await db().collection('calendar_events').add({
            userId,
            title: action.title || 'Untitled Event',
            startAt: start ? admin.firestore.Timestamp.fromDate(start) : admin.firestore.FieldValue.serverTimestamp(),
            endAt: end ? admin.firestore.Timestamp.fromDate(end) : admin.firestore.FieldValue.serverTimestamp(),
            description: action.description || '',
            color: '#6C63FF',
            source: 'malleabite',
            isAllDay: action.isAllDay || false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await (0, session_1.setLastCreated)(phone, docRef.id, 'event', 'calendar_events');
        const timeStr = start ? `${fmtDate(start)}, ${fmtTime(start)}` : 'No time set';
        await (0, meta_api_1.sendButtonMessage)(send, `Got it! ✅ *${action.title}* — ${timeStr} added.`, [{ id: 'action_undo', title: 'Undo' }, { id: 'btn_today', title: 'Today' }]);
    }
    else if (action.type === 'create_todo') {
        let listId = action.listId;
        let listName = action.listName || 'Inbox';
        let collection = 'todo_items';
        // Find or create the default/inbox list
        if (!listId) {
            const inboxSnap = await db()
                .collection('todo_lists')
                .where('userId', '==', userId)
                .limit(1)
                .get();
            if (!inboxSnap.empty) {
                listId = inboxSnap.docs[0].id;
                listName = inboxSnap.docs[0].data().name || 'Inbox';
            }
        }
        let docRef;
        if (listId) {
            docRef = await db().collection('todo_items').add({
                userId,
                listId,
                text: action.text || 'New task',
                completed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Update list timestamp
            await db().collection('todo_lists').doc(listId).update({
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }).catch(() => { });
        }
        else {
            // No lists exist — use flat todos collection
            collection = 'todos';
            docRef = await db().collection('todos').add({
                userId,
                text: action.text || 'New task',
                completed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        await (0, session_1.setLastCreated)(phone, docRef.id, 'todo', collection);
        await (0, meta_api_1.sendButtonMessage)(send, `Got it! ✅ *${action.text}* added to _${listName}_.`, [
            { id: 'action_undo', title: 'Undo' },
            { id: 'action_change_list', title: 'Change List' },
            { id: 'btn_todos', title: 'Todos' },
        ]);
    }
}
// ─── Interactive Reply Router ─────────────────────────────────────────────────
async function handleInteractive(send, ctx, userId, replyId) {
    switch (replyId) {
        // ── Confirmation buttons ──
        case 'action_yes': {
            const pending = await (0, session_1.getPendingAction)(ctx.from);
            if (pending) {
                await executePendingAction(send, ctx.from, userId, pending);
            }
            else {
                await (0, meta_api_1.sendTextMessage)(send, 'Nothing to confirm. Send me something to add!');
            }
            break;
        }
        case 'action_no':
            await (0, session_1.clearPendingAction)(ctx.from);
            await (0, meta_api_1.sendTextMessage)(send, '👍 Cancelled.');
            break;
        // ── Undo ──
        case 'action_undo':
            await handleUndo(send, ctx.from);
            break;
        // ── Change list (after todo creation) ──
        case 'action_change_list':
            await sendChangeListMenu(send, userId);
            break;
        // ── Forwarded message choices ──
        case 'fwd_event': {
            const fwdPending = await (0, session_1.getPendingAction)(ctx.from);
            if (fwdPending) {
                // Re-process as event via AI
                await (0, session_1.clearPendingAction)(ctx.from);
                await handleAIMessage(send, ctx, userId, fwdPending.description || fwdPending.title || '');
            }
            break;
        }
        case 'fwd_todo': {
            const fwdPending = await (0, session_1.getPendingAction)(ctx.from);
            if (fwdPending) {
                await (0, session_1.clearPendingAction)(ctx.from);
                // Extract meaningful text and propose as todo
                const todoText = fwdPending.title || fwdPending.description || 'New task';
                const newAction = { type: 'create_todo', text: todoText };
                await (0, session_1.setPendingAction)(ctx.from, newAction);
                await (0, meta_api_1.sendButtonMessage)(send, `Add '${todoText}' to Inbox? `, [{ id: 'action_yes', title: 'Yes' }, { id: 'action_no', title: 'No' }, { id: 'action_change_list', title: 'Change List' }]);
            }
            break;
        }
        case 'fwd_ignore':
            await (0, session_1.clearPendingAction)(ctx.from);
            await (0, meta_api_1.sendTextMessage)(send, '👍 Ignored.');
            break;
        // ── Viewing ──
        case 'btn_today':
            await sendTodaySchedule(send, userId);
            break;
        case 'btn_todos':
            await sendTodos(send, userId);
            break;
        // ── Account ──
        case 'confirm_unlink': {
            const { unlinkAccount } = await Promise.resolve().then(() => __importStar(require('./account-linking')));
            await unlinkAccount(ctx.from);
            await (0, meta_api_1.sendTextMessage)(send, '🔓 Account unlinked. Send a new link code anytime to reconnect.');
            break;
        }
        case 'cancel_unlink':
            await (0, meta_api_1.sendTextMessage)(send, '👍 No changes made.');
            break;
        case 'help_link':
            await (0, meta_api_1.sendTextMessage)(send, `🔗 *How to Link Your Account*\n\n` +
                `1. Open *malleabite.vercel.app*\n` +
                `2. Log in to your account\n` +
                `3. Go to *Settings → WhatsApp*\n` +
                `4. Tap *Generate Link Code*\n` +
                `5. Copy the 6-digit code\n` +
                `6. Send it here\n\n` +
                `_The code expires in 10 minutes._`);
            break;
        // ── Dynamic list selection ──
        default:
            if (replyId.startsWith('todolist_')) {
                const listId = replyId.replace('todolist_', '');
                await handleMoveToList(send, ctx.from, userId, listId);
            }
            else if (replyId.startsWith('viewlist_')) {
                const listId = replyId.replace('viewlist_', '');
                await sendTodoItems(send, userId, listId);
            }
            else {
                await (0, meta_api_1.sendTextMessage)(send, 'I didn\'t recognize that option. Type *help* for commands.');
            }
    }
}
// ─── AI Message Handler ─────────────────────────────────────────────────────
async function handleAIMessage(send, ctx, userId, text) {
    try {
        const { processAIRequestInternal } = await Promise.resolve().then(() => __importStar(require('./ai-processor')));
        const response = await processAIRequestInternal(userId, text);
        if (response.error) {
            await (0, meta_api_1.sendTextMessage)(send, `⚠️ ${response.error}`);
            return;
        }
        // ── AI proposed an action → confirm-before-create ──
        if (response.actions && response.actions.length > 0) {
            const action = response.actions[0]; // handle first action
            if (action.type === 'create_event') {
                const pending = {
                    type: 'create_event',
                    title: action.title,
                    start: action.start,
                    end: action.end,
                    description: action.description,
                    isAllDay: action.isAllDay,
                };
                await (0, session_1.setPendingAction)(ctx.from, pending);
                // Build one-line proposal
                const start = action.start ? new Date(action.start) : null;
                const dateStr = start ? `${fmtDate(start)}, ${fmtTime(start)}` : 'no time specified';
                // In groups: brief confirm in group
                if (ctx.isGroup) {
                    await (0, meta_api_1.sendButtonMessage)(send, `Add '${action.title}' on ${dateStr}?`, [{ id: 'action_yes', title: 'Yes' }, { id: 'action_no', title: 'No' }]);
                }
                else {
                    await (0, meta_api_1.sendButtonMessage)(send, `Add '${action.title}' on ${dateStr}?`, [{ id: 'action_yes', title: 'Yes' }, { id: 'action_no', title: 'No' }]);
                }
                return;
            }
            if (action.type === 'create_todo') {
                const pending = {
                    type: 'create_todo',
                    text: action.text,
                    listName: action.listName,
                };
                await (0, session_1.setPendingAction)(ctx.from, pending);
                await (0, meta_api_1.sendButtonMessage)(send, `Add '${action.text}' to Inbox?`, [{ id: 'action_yes', title: 'Yes' }, { id: 'action_no', title: 'No' }, { id: 'action_change_list', title: 'Change List' }]);
                return;
            }
        }
        // ── AI responded with text only (general chat / info / missing info) ──
        const reply = response.text || '';
        if (reply.length > 4000) {
            await (0, meta_api_1.sendTextMessage)(send, reply.slice(0, 3997) + '...');
        }
        else if (ctx.isGroup) {
            await (0, meta_api_1.sendTextMessage)(send, reply);
        }
        else {
            // DM: plain text, no buttons cluttering general chat
            await (0, meta_api_1.sendTextMessage)(send, reply);
        }
    }
    catch (error) {
        console.error('AI handler error:', error);
        await (0, meta_api_1.sendTextMessage)(send, 'Sorry, I had trouble processing that. Try again or type *help*.');
    }
}
// ─── Undo Handler ─────────────────────────────────────────────────────────────
async function handleUndo(send, phone) {
    const result = await (0, session_1.undoLastCreated)(phone);
    if (result.success) {
        const label = result.type === 'event' ? 'Event' : 'Todo';
        await (0, meta_api_1.sendTextMessage)(send, `↩️ ${label} removed.`);
    }
    else {
        await (0, meta_api_1.sendTextMessage)(send, 'Nothing to undo.');
    }
}
// ─── Change List (move last created todo) ─────────────────────────────────────
async function sendChangeListMenu(send, userId) {
    const snapshot = await db()
        .collection('todo_lists')
        .where('userId', '==', userId)
        .get();
    if (snapshot.empty) {
        await (0, meta_api_1.sendTextMessage)(send, 'You don\'t have any lists yet. Create one in the app first.');
        return;
    }
    const rows = snapshot.docs.map((doc) => ({
        id: `todolist_${doc.id}`,
        title: (doc.data().name || 'Untitled').slice(0, 24),
        description: 'Move todo here',
    }));
    await (0, meta_api_1.sendListMessage)(send, 'Which list should this go to?', 'Pick a List', [{ title: 'Your Lists', rows }]);
}
async function handleMoveToList(send, phone, userId, newListId) {
    // Get last created todo from session
    const sessionDoc = await db().collection('whatsapp_sessions').doc(phone).get();
    const session = sessionDoc.data();
    if (!session?.lastCreatedId || session?.lastCreatedType !== 'todo') {
        await (0, meta_api_1.sendTextMessage)(send, 'No recent todo to move.');
        return;
    }
    const collection = session.lastCreatedCollection || 'todo_items';
    if (collection === 'todo_items') {
        // Update the listId
        await db().collection('todo_items').doc(session.lastCreatedId).update({ listId: newListId });
    }
    else if (collection === 'todos') {
        // Move from flat todos to todo_items
        const todoDoc = await db().collection('todos').doc(session.lastCreatedId).get();
        if (todoDoc.exists) {
            const data = todoDoc.data();
            const newDoc = await db().collection('todo_items').add({
                userId,
                listId: newListId,
                text: data.text,
                completed: data.completed || false,
                createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            });
            await todoDoc.ref.delete();
            await (0, session_1.setLastCreated)(phone, newDoc.id, 'todo', 'todo_items');
        }
    }
    // Get new list name
    const listDoc = await db().collection('todo_lists').doc(newListId).get();
    const listName = listDoc.data()?.name || 'List';
    await (0, meta_api_1.sendTextMessage)(send, `✅ Moved to _${listName}_.`);
}
// ─── Help ─────────────────────────────────────────────────────────────────────
async function sendHelp(send) {
    await (0, meta_api_1.sendTextMessage)(send, `💡 *How to Use Mally*\n\n` +
        `*Create stuff:*\n` +
        `• "Meeting with Sarah tomorrow 2pm"\n` +
        `• "Add buy groceries to my shopping list"\n` +
        `• Forward a message → choose Event or Todo\n\n` +
        `*View stuff:*\n` +
        `• "today" — Today's schedule\n` +
        `• "todos" — Your tasks\n\n` +
        `*Other:*\n` +
        `• "undo" — Undo last action\n` +
        `• "unlink" — Disconnect account\n\n` +
        `_Just type naturally — I'll figure it out._`);
}
// ─── View: Today's Schedule ───────────────────────────────────────────────────
async function sendTodaySchedule(send, userId) {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const snap = await db()
        .collection('calendar_events')
        .where('userId', '==', userId)
        .where('startAt', '>=', admin.firestore.Timestamp.fromDate(start))
        .where('startAt', '<=', admin.firestore.Timestamp.fromDate(end))
        .orderBy('startAt', 'asc')
        .get();
    if (snap.empty) {
        await (0, meta_api_1.sendTextMessage)(send, `📅 *Today* · ${fmtDate(today)}\n\nNothing on your calendar.`);
        return;
    }
    const lines = snap.docs.map((d) => {
        const e = d.data();
        const s = e.startAt?.toDate?.();
        const en = e.endAt?.toDate?.();
        const time = e.isAllDay ? 'All day' : (s ? fmtRange(s, en) : '');
        return `• *${e.title}* · ${time}`;
    });
    await (0, meta_api_1.sendTextMessage)(send, `📅 *Today* · ${fmtDate(today)}\n\n${lines.join('\n')}\n\n_${snap.size} event${snap.size !== 1 ? 's' : ''}_`);
}
// ─── View: Todos ──────────────────────────────────────────────────────────────
async function sendTodos(send, userId) {
    const listsSnap = await db()
        .collection('todo_lists')
        .where('userId', '==', userId)
        .get();
    if (listsSnap.empty) {
        // Check flat todos
        const todosSnap = await db()
            .collection('todos')
            .where('userId', '==', userId)
            .where('completed', '==', false)
            .limit(15)
            .get();
        if (todosSnap.empty) {
            await (0, meta_api_1.sendTextMessage)(send, '✅ No pending tasks.');
            return;
        }
        const lines = todosSnap.docs.map((d) => `⬜ ${d.data().text}`);
        await (0, meta_api_1.sendTextMessage)(send, `✅ *Todos*\n\n${lines.join('\n')}`);
        return;
    }
    // Build per-list summary
    let output = '✅ *Your Todos*\n';
    let totalPending = 0;
    // Show as list message if multiple lists
    if (listsSnap.size > 1) {
        const rows = [];
        for (const listDoc of listsSnap.docs) {
            const listData = listDoc.data();
            const itemsSnap = await db()
                .collection('todo_items')
                .where('listId', '==', listDoc.id)
                .where('userId', '==', userId)
                .where('completed', '==', false)
                .get();
            const count = itemsSnap.size;
            totalPending += count;
            rows.push({
                id: `viewlist_${listDoc.id}`,
                title: (listData.name || 'Untitled').slice(0, 24),
                description: `${count} pending task${count !== 1 ? 's' : ''}`,
            });
        }
        await (0, meta_api_1.sendListMessage)(send, `${output}\n${totalPending} pending task${totalPending !== 1 ? 's' : ''} across ${listsSnap.size} lists.`, 'View Lists', [{ title: 'Todo Lists', rows }]);
        return;
    }
    // Single list — show items inline
    const listDoc = listsSnap.docs[0];
    const listName = listDoc.data().name || 'List';
    const itemsSnap = await db()
        .collection('todo_items')
        .where('listId', '==', listDoc.id)
        .where('userId', '==', userId)
        .where('completed', '==', false)
        .limit(15)
        .get();
    if (itemsSnap.empty) {
        await (0, meta_api_1.sendTextMessage)(send, `✅ *${listName}*\n\nNo pending tasks.`);
        return;
    }
    const lines = itemsSnap.docs.map((d) => `⬜ ${d.data().text}`);
    await (0, meta_api_1.sendTextMessage)(send, `✅ *${listName}*\n\n${lines.join('\n')}`);
}
async function sendTodoItems(send, userId, listId) {
    const listDoc = await db().collection('todo_lists').doc(listId).get();
    const listName = listDoc.data()?.name || 'List';
    const snap = await db()
        .collection('todo_items')
        .where('listId', '==', listId)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(15)
        .get();
    if (snap.empty) {
        await (0, meta_api_1.sendTextMessage)(send, `📋 *${listName}*\n\nEmpty list.`);
        return;
    }
    const pending = snap.docs.filter((d) => !d.data().completed).map((d) => `⬜ ${d.data().text}`);
    const done = snap.docs.filter((d) => d.data().completed).map((d) => `✅ ~${d.data().text}~`);
    let text = `📋 *${listName}*\n\n`;
    if (pending.length)
        text += pending.join('\n');
    if (done.length)
        text += `\n\n_Completed:_\n${done.join('\n')}`;
    await (0, meta_api_1.sendTextMessage)(send, text);
}
// ─── Data Loaders ─────────────────────────────────────────────────────────────
async function loadUserName(userId) {
    const doc = await db().collection('users').doc(userId).get();
    const data = doc.data();
    return data?.displayName || data?.name || null;
}
//# sourceMappingURL=message-handler.js.map