/**
 * Meta Cloud API client for sending WhatsApp messages.
 * Handles text, interactive buttons, and list messages.
 */
import axios from 'axios';

const META_API_BASE = 'https://graph.facebook.com/v21.0';

interface SendMessageOptions {
  phoneNumberId: string;
  accessToken: string;
  to: string;
}

// ─── Text Messages ────────────────────────────────────────────────────────────

export async function sendTextMessage(
  opts: SendMessageOptions,
  text: string
): Promise<void> {
  await axios.post(
    `${META_API_BASE}/${opts.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ─── Interactive Button Messages (max 3 buttons) ─────────────────────────────

interface Button {
  id: string;
  title: string; // max 20 chars
}

export async function sendButtonMessage(
  opts: SendMessageOptions,
  body: string,
  buttons: Button[],
  header?: string,
  footer?: string
): Promise<void> {
  const interactive: any = {
    type: 'button',
    body: { text: body },
    action: {
      buttons: buttons.slice(0, 3).map((b) => ({
        type: 'reply',
        reply: { id: b.id, title: b.title.slice(0, 20) },
      })),
    },
  };
  if (header) interactive.header = { type: 'text', text: header };
  if (footer) interactive.footer = { text: footer };

  await axios.post(
    `${META_API_BASE}/${opts.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'interactive',
      interactive,
    },
    {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ─── Interactive List Messages (for menus) ────────────────────────────────────

interface ListRow {
  id: string;
  title: string; // max 24 chars
  description?: string; // max 72 chars
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

export async function sendListMessage(
  opts: SendMessageOptions,
  body: string,
  buttonText: string,
  sections: ListSection[],
  header?: string,
  footer?: string
): Promise<void> {
  const interactive: any = {
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
  if (header) interactive.header = { type: 'text', text: header };
  if (footer) interactive.footer = { text: footer };

  await axios.post(
    `${META_API_BASE}/${opts.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'interactive',
      interactive,
    },
    {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ─── Mark message as read ─────────────────────────────────────────────────────

export async function markAsRead(
  opts: Omit<SendMessageOptions, 'to'>,
  messageId: string
): Promise<void> {
  await axios.post(
    `${META_API_BASE}/${opts.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    },
    {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ─── Reaction Messages ────────────────────────────────────────────────────────

export async function sendReaction(
  opts: SendMessageOptions,
  messageId: string,
  emoji: string
): Promise<void> {
  await axios.post(
    `${META_API_BASE}/${opts.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'reaction',
      reaction: { message_id: messageId, emoji },
    },
    {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}
