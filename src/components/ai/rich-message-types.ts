// Rich AI message types — extends the basic Message with interactive elements

export interface RichMessage {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  isLoading?: boolean;
  isError?: boolean;
  image?: {
    dataUrl: string;
    fileName: string;
    mimeType: string;
  };
  sources?: Array<{ title: string; uri: string }>;

  // ── Rich response extensions ───────────────────────────────────
  /** Structured intent from the AI (scheduling, query, general, etc.) */
  intent?: string;
  /** Action cards to display inline (created events, todos, etc.) */
  actionCards?: ActionCardData[];
  /** Contextual follow-up suggestion chips */
  suggestions?: SuggestionChip[];
  /** Step-by-step progress for multi-action responses */
  actionProgress?: ActionProgressStep[];
  /** Pending actions awaiting user confirmation */
  pendingActions?: PendingAction[];
  /** Whether text is still streaming in */
  isStreaming?: boolean;
  /** Expandable collapsible sections for list-heavy responses */
  expandableSections?: import('./ExpandableSection').ExpandableSectionData[];
  /** Guided multi-step flow for complex tasks */
  guidedFlow?: import('./GuidedFlow').GuidedFlowData;
}

// ── Action Card ──────────────────────────────────────────────────
export type ActionCardType = 'event' | 'todo' | 'alarm' | 'reminder' | 'pomodoro' | 'eisenhower' | 'generic';

export interface ActionCardData {
  id: string;
  type: ActionCardType;
  title: string;
  subtitle?: string;        // e.g. "Tomorrow, 3:00 – 4:00 PM"
  color?: string;            // accent color
  icon?: string;             // lucide icon name
  status: 'created' | 'updated' | 'deleted';
  metadata?: Record<string, string>; // extra display fields
  /** The original action that produced this card, for undo */
  sourceAction?: { type: string; data: any };
  /** Primary calendar the event was added to (event cards only) */
  calendarInfo?: { id: string; name: string; color: string; eventId?: string };
  /** Additional calendars the event was also added to */
  additionalCalendars?: Array<{ id: string; name: string; color: string; eventId?: string }>;
  /** Todo list the item was added to (todo cards) */
  listInfo?: { id: string; name: string; color: string; todoId?: string };
  /** Additional lists the todo was also added to */
  additionalLists?: Array<{ id: string; name: string; color: string; todoId?: string }>;
  /** Eisenhower quadrant info */
  quadrantInfo?: { quadrant: string; label: string; color: string };
}

// ── Suggestion Chips ─────────────────────────────────────────────
export interface SuggestionChip {
  id: string;
  label: string;
  /** Full prompt to send when clicked */
  prompt: string;
  icon?: string;
}

// ── Action Progress ──────────────────────────────────────────────
export type ProgressStatus = 'pending' | 'running' | 'done' | 'error';

export interface ActionProgressStep {
  id: string;
  label: string;
  status: ProgressStatus;
}

// ── Pending Confirmation ─────────────────────────────────────────
export interface PendingAction {
  id: string;
  type: string;
  label: string;             // Human-readable description
  data: any;                 // Original action data
  status: 'pending' | 'approved' | 'rejected';
}

// ── Suggestion Generation ────────────────────────────────────────

/**
 * Generate contextual suggestion chips based on the AI response intent and actions.
 * This is the frontend-driven logic — no backend changes needed.
 */
// ── Contextual Question Detection ─────────────────────────────────
// When the AI poses a follow-up question with clear options (e.g. "Would you
// like to X, or Y?"), we extract those options as quick-reply chips so the user
// can tap instead of typing.

function detectContextualQuestion(text: string): SuggestionChip[] {
  const lower = text.toLowerCase();

  // Only proceed if the text looks like it's asking the user something
  const hasQuestion =
    lower.includes('would you like') ||
    lower.includes('do you want') ||
    lower.includes('should i') ||
    lower.includes('shall i') ||
    lower.includes('which one') ||
    lower.includes('what would you') ||
    lower.includes('how would you') ||
    lower.includes('would you prefer') ||
    lower.includes('want me to') ||
    text.includes('?');

  if (!hasQuestion) return [];

  // Find the sentence(s) containing the question
  const sentences = text.split(/[.!]\s+/);
  const questionSentences = sentences.filter(s => s.includes('?'));
  if (questionSentences.length === 0) return [];

  const questionBlock = questionSentences.join(' ').toLowerCase();
  const chips: SuggestionChip[] = [];

  // ── Pattern: "X, or Y?" / "X or Y?" ──
  // e.g. "Would you like to create a new to-do list for it, or for future tasks?"
  // e.g. "Should I add it to your calendar, or just keep it as a todo?"
  const orSplit = questionBlock.split(/,?\s+or\s+/);
  if (orSplit.length >= 2) {
    // Extract the tail options
    for (let i = 0; i < orSplit.length; i++) {
      let option = orSplit[i]
        .replace(/^(would you like to |do you want to |do you want me to |should i |shall i |want me to )/i, '')
        .replace(/\?+$/, '')
        .trim();
      // For the first segment, grab only the actionable part after the last comma
      if (i === 0) {
        const parts = option.split(/,\s*/);
        option = parts[parts.length - 1].trim();
        // Also strip leading connectors from the extracted portion
        option = option.replace(/^(would you like to |do you want to |do you want me to |should i |shall i |want me to )/i, '').trim();
      }
      if (option.length > 2 && option.length < 80) {
        const label = option.charAt(0).toUpperCase() + option.slice(1);
        chips.push({
          id: `ctx-${i}`,
          label,
          prompt: label,
        });
      }
    }
  }

  // ── Pattern: Numbered list of options ──
  // e.g. "1. Create a new list\n2. Add to existing list"
  const numberedOptions = text.match(/(?:^|\n)\s*\d+[.)]\s+(.+)/gm);
  if (numberedOptions && numberedOptions.length >= 2 && chips.length === 0) {
    for (let i = 0; i < Math.min(numberedOptions.length, 4); i++) {
      const option = numberedOptions[i].replace(/^\s*\d+[.)]\s+/, '').trim();
      if (option.length > 2 && option.length < 80) {
        chips.push({
          id: `ctx-num-${i}`,
          label: option,
          prompt: option,
        });
      }
    }
  }

  // ── Pattern: Yes/No question ──
  // e.g. "Would you like me to create it?" / "Should I go ahead?"
  if (chips.length === 0 && (
    questionBlock.includes('would you like') ||
    questionBlock.includes('do you want') ||
    questionBlock.includes('should i') ||
    questionBlock.includes('shall i') ||
    questionBlock.includes('want me to')
  ) && !questionBlock.includes(' or ')) {
    chips.push(
      { id: 'ctx-yes', label: 'Yes, go ahead', prompt: 'Yes, please go ahead' },
      { id: 'ctx-no', label: 'No thanks', prompt: "No, that's okay" },
    );
  }

  return chips;
}

export function generateSuggestions(
  intent: string | undefined,
  actions: Array<{ type: string; data?: any }>,
  messageText: string,
): SuggestionChip[] {
  // ── Priority 1: Detect follow-up questions in the AI text ──
  // If the AI is asking the user a question with implied options, generate
  // contextual quick-reply chips instead of generic ones.
  const contextualChips = detectContextualQuestion(messageText);
  if (contextualChips.length > 0) {
    return contextualChips.slice(0, 4);
  }

  // ── Priority 2: Action-based suggestions ──
  const chips: SuggestionChip[] = [];

  // After creating an event
  if (actions.some(a => a.type === 'create_event')) {
    const eventTitle = actions.find(a => a.type === 'create_event')?.data?.title;
    chips.push(
      { id: 'remind', label: 'Set reminder', prompt: `Set a reminder for "${eventTitle || 'this event'}"` },
      { id: 'recurring', label: 'Make recurring', prompt: `Make "${eventTitle || 'this event'}" recurring weekly` },
      { id: 'another', label: 'Add another event', prompt: 'Create another event: ' },
    );
  }

  // After creating a todo
  if (actions.some(a => a.type === 'create_todo')) {
    chips.push(
      { id: 'more-todos', label: 'Add more tasks', prompt: 'Add another todo: ' },
      { id: 'prioritize', label: 'Prioritize my tasks', prompt: 'Help me prioritize my tasks for today' },
    );
  }

  // After starting pomodoro
  if (actions.some(a => a.type === 'start_pomodoro' || a.type === 'resume_pomodoro')) {
    chips.push(
      { id: 'break', label: 'When to take a break?', prompt: 'When should I take a break?' },
      { id: 'today-plan', label: "Today's plan", prompt: "What should I focus on today?" },
    );
  }

  // After creating alarm
  if (actions.some(a => a.type === 'create_alarm')) {
    chips.push(
      { id: 'another-alarm', label: 'Set another alarm', prompt: 'Set an alarm for ' },
      { id: 'schedule', label: "Today's schedule", prompt: "What's on my schedule today?" },
    );
  }

  // Query intent with no actions — suggest actions
  if (intent === 'query' && actions.length === 0) {
    chips.push(
      { id: 'add-event', label: 'Add an event', prompt: 'Create an event: ' },
      { id: 'add-todo', label: 'Add a task', prompt: 'Add a todo: ' },
      { id: 'focus', label: 'Start focus time', prompt: 'Start a pomodoro session' },
    );
  }

  // Scheduling intent with no actions (AI described but didn't act)
  if (intent === 'scheduling' && actions.length === 0) {
    chips.push(
      { id: 'do-it', label: 'Go ahead and do it', prompt: 'Yes, please go ahead and schedule it' },
      { id: 'different', label: 'Try a different time', prompt: 'Can you suggest a different time?' },
    );
  }

  // General / greeting — show discovery chips
  if (intent === 'general' && actions.length === 0) {
    const lower = messageText.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.length < 80) {
      chips.push(
        { id: 'today', label: "Today's schedule", prompt: "What's on my calendar today?" },
        { id: 'tasks', label: 'My tasks', prompt: 'What are my pending tasks?' },
        { id: 'plan', label: 'Plan my day', prompt: 'Help me plan my day' },
      );
    }
  }

  // After delete actions
  if (actions.some(a => a.type?.startsWith('delete_'))) {
    chips.push(
      { id: 'undo-info', label: 'What was deleted?', prompt: 'Can you tell me what was just deleted?' },
    );
  }

  // Cap at 4 chips max
  return chips.slice(0, 4);
}

// ── Action Card Generation ───────────────────────────────────────

/**
 * Convert executed actions into display-ready action cards.
 */
export function actionsToCards(
  actions: Array<{ type: string; data?: any }>,
  executionResults: boolean[],
  resolveCalendar?: (calendarId?: string) => { id: string; name: string; color: string },
  resolveList?: (listId?: string) => { id: string; name: string; color: string } | undefined,
): ActionCardData[] {
  return actions
    .map((action, i) => {
      if (!executionResults[i]) return null; // only show successful actions
      const data = action.data || action;

      switch (action.type) {
        case 'create_event': {
          const cal = resolveCalendar?.(data.calendarId);
          return {
            id: crypto.randomUUID(),
            type: 'event' as ActionCardType,
            title: data.title || 'New Event',
            subtitle: formatEventTime(data.start || data.startsAt, data.end || data.endsAt),
            color: data.color || '#8b5cf6',
            status: 'created' as const,
            icon: 'calendar',
            sourceAction: action,
            calendarInfo: cal,
          };
        }
        case 'update_event': {
          const cal = resolveCalendar?.(data.calendarId);
          return {
            id: crypto.randomUUID(),
            type: 'event' as ActionCardType,
            title: data.title || 'Event Updated',
            subtitle: formatEventTime(data.start || data.startsAt, data.end || data.endsAt),
            color: data.color || '#8b5cf6',
            status: 'updated' as const,
            icon: 'calendar',
            sourceAction: action,
            calendarInfo: cal,
          };
        }
        case 'delete_event':
          return {
            id: crypto.randomUUID(),
            type: 'event' as ActionCardType,
            title: data.title || 'Event Deleted',
            status: 'deleted' as const,
            icon: 'calendar',
            sourceAction: action,
          };
        case 'create_todo':
          return {
            id: crypto.randomUUID(),
            type: 'todo' as ActionCardType,
            title: data.text || data.title || 'New Task',
            subtitle: data.listName ? `in ${data.listName}` : undefined,
            status: 'created' as const,
            icon: 'check-square',
            sourceAction: action,
            listInfo: resolveList?.(data.listId),
          };
        case 'create_alarm':
          return {
            id: crypto.randomUUID(),
            type: 'alarm' as ActionCardType,
            title: data.title || 'Alarm',
            subtitle: data.time || '',
            status: 'created' as const,
            icon: 'bell',
            sourceAction: action,
          };
        case 'create_reminder':
          return {
            id: crypto.randomUUID(),
            type: 'reminder' as ActionCardType,
            title: data.title || data.text || 'Reminder',
            subtitle: data.time || '',
            status: 'created' as const,
            icon: 'clock',
            sourceAction: action,
          };
        case 'start_pomodoro':
        case 'resume_pomodoro':
          return {
            id: crypto.randomUUID(),
            type: 'pomodoro' as ActionCardType,
            title: 'Focus Timer',
            subtitle: action.type === 'resume_pomodoro' ? 'Resumed' : 'Started',
            status: 'created' as const,
            icon: 'timer',
            sourceAction: action,
          };
        case 'create_eisenhower': {
          const quadrantLabels: Record<string, { label: string; color: string }> = {
            urgent_important: { label: 'Urgent & Important', color: '#ef4444' },
            not_urgent_important: { label: 'Important', color: '#eab308' },
            urgent_not_important: { label: 'Urgent', color: '#3b82f6' },
            not_urgent_not_important: { label: 'Neither', color: '#22c55e' },
          };
          const q = quadrantLabels[data.quadrant] || { label: data.quadrant, color: '#8b5cf6' };
          return {
            id: crypto.randomUUID(),
            type: 'eisenhower' as ActionCardType,
            title: data.text || 'Priority Item',
            subtitle: q.label,
            color: q.color,
            status: 'created' as const,
            icon: 'star',
            sourceAction: action,
            quadrantInfo: { quadrant: data.quadrant, label: q.label, color: q.color },
          };
        }
        default:
          return null;
      }
    })
    .filter((c): c is ActionCardData => c !== null);
}

// ── Content Detection ────────────────────────────────────────────

import type { ExpandableSectionData } from './ExpandableSection';
import type { GuidedFlowData, GuidedFlowStep } from './GuidedFlow';

/**
 * Detects list/schedule patterns in AI response text and converts them
 * to expandable sections. Returns null if no lists are detected.
 *
 * Patterns detected:
 * - Day headers with bullet items ("Monday:\n- Event 1\n- Event 2")
 * - Numbered lists with headers ("1. Morning: ...\n2. Afternoon: ...")
 * - Dash/bullet lists with 5+ items
 */
export function detectExpandableSections(text: string): {
  summary: string;
  sections: ExpandableSectionData[];
} | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 5) return null; // too short for sections

  // Pattern 1: Day headers (Monday:, Tuesday:, etc.) or date-like headers
  const dayPattern = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)[:\s]/i;
  const datePattern = /^(\w+ \d{1,2}|\d{1,2}\/\d{1,2}|today|tomorrow|this week|next week)[:\s-]/i;
  const headerPattern = /^(?:#{1,3}\s*)?(.+?)[:—–-]\s*$/;

  const sections: ExpandableSectionData[] = [];
  let currentSection: { title: string; items: string[] } | null = null;
  let summaryLines: string[] = [];
  let inSectionZone = false;

  for (const line of lines) {
    const isDayHeader = dayPattern.test(line) || datePattern.test(line);
    const isGenericHeader = headerPattern.test(line) && !line.startsWith('-') && !line.startsWith('•');
    const isBulletItem = /^[-•*]\s/.test(line) || /^\d+[.)\s]/.test(line);

    if (isDayHeader || (isGenericHeader && inSectionZone)) {
      // Save previous section
      if (currentSection && currentSection.items.length > 0) {
        sections.push({
          id: crypto.randomUUID(),
          title: currentSection.title,
          badge: `${currentSection.items.length} item${currentSection.items.length !== 1 ? 's' : ''}`,
          items: currentSection.items,
        });
      }
      const titleMatch = line.match(headerPattern);
      currentSection = {
        title: titleMatch ? titleMatch[1].trim() : line.replace(/[:\s]+$/, ''),
        items: [],
      };
      inSectionZone = true;
    } else if (isBulletItem && currentSection) {
      currentSection.items.push(line.replace(/^[-•*\d.)+]\s*/, ''));
    } else if (currentSection && line.length > 0 && !isBulletItem) {
      // Non-bullet line after a header — treat as an item
      if (inSectionZone && currentSection.items.length === 0) {
        currentSection.items.push(line);
      } else if (!inSectionZone) {
        summaryLines.push(line);
      } else {
        currentSection.items.push(line);
      }
    } else if (!currentSection) {
      summaryLines.push(line);
    }
  }

  // Save final section
  if (currentSection && currentSection.items.length > 0) {
    sections.push({
      id: crypto.randomUUID(),
      title: currentSection.title,
      badge: `${currentSection.items.length} item${currentSection.items.length !== 1 ? 's' : ''}`,
      items: currentSection.items,
    });
  }

  // Only convert to expandable if we found 2+ sections
  if (sections.length < 2) return null;

  // Auto-expand the first section
  if (sections.length > 0) sections[0].defaultOpen = true;

  const summary = summaryLines.length > 0
    ? summaryLines.join(' ')
    : `${sections.length} sections`;

  return { summary, sections };
}

/**
 * Detects question patterns in AI text that could become guided flows.
 * Returns null if no guided pattern is found.
 *
 * Detects:
 * - Questions with listed options ("Which do you prefer?\n1. Option A\n2. Option B")
 * - Yes/no questions
 * - Day-of-week selection prompts
 */
export function detectGuidedFlow(text: string): GuidedFlowData | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // Find a question line
  const questionIdx = lines.findIndex(l => l.endsWith('?'));
  if (questionIdx === -1) return null;

  const questionLine = lines[questionIdx];
  const afterQuestion = lines.slice(questionIdx + 1);

  // Check for listed options after the question
  const optionPattern = /^(?:[-•*]|\d+[.)\s])\s*(.+)/;
  const options: { id: string; label: string }[] = [];

  for (const line of afterQuestion) {
    const match = line.match(optionPattern);
    if (match) {
      options.push({ id: crypto.randomUUID(), label: match[1].trim() });
    } else if (options.length > 0) {
      break; // stop at first non-option line after options started
    }
  }

  if (options.length < 2) {
    // Check for implicit yes/no or binary choice
    const lowerQ = questionLine.toLowerCase();
    if (
      lowerQ.includes('would you like') ||
      lowerQ.includes('should i') ||
      lowerQ.includes('do you want') ||
      lowerQ.includes('shall i')
    ) {
      options.push(
        { id: 'yes', label: 'Yes, go ahead' },
        { id: 'no', label: 'No, thanks' },
      );
    }
  }

  // Check for day-of-week selection
  const dayKeywords = ['which days', 'what days', 'select days', 'pick days', 'choose days'];
  if (dayKeywords.some(k => questionLine.toLowerCase().includes(k))) {
    return {
      id: crypto.randomUUID(),
      currentStep: 0,
      totalSteps: 1,
      step: {
        id: crypto.randomUUID(),
        prompt: questionLine,
        options: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => ({
          id: d.toLowerCase(),
          label: d,
        })),
        multi: true,
      },
    };
  }

  if (options.length < 2) return null;

  const step: GuidedFlowStep = {
    id: crypto.randomUUID(),
    prompt: questionLine,
    options,
  };

  return {
    id: crypto.randomUUID(),
    currentStep: 0,
    totalSteps: 1,
    step,
  };
}

/**
 * Strips the portions of AI text that were converted to expandable sections or guided flows,
 * leaving only the summary/intro text for the message bubble.
 */
export function extractCleanText(
  text: string,
  hasSections: boolean,
  hasGuidedFlow: boolean,
): string {
  if (!hasSections && !hasGuidedFlow) return text;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const cleanLines: string[] = [];
  const dayPattern = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)[:\s]/i;
  const datePattern = /^(\w+ \d{1,2}|\d{1,2}\/\d{1,2}|today|tomorrow|this week|next week)[:\s-]/i;
  let inListZone = false;

  for (const line of lines) {
    const isBullet = /^[-•*]\s/.test(line) || /^\d+[.)\s]/.test(line);
    const isHeader = dayPattern.test(line) || datePattern.test(line);

    if (isHeader) {
      inListZone = true;
      continue;
    }
    if (inListZone && isBullet) continue;
    if (inListZone && !isBullet && line.length > 0) {
      inListZone = false;
    }

    // For guided flows, skip lines that are question + options
    if (hasGuidedFlow && (line.endsWith('?') || isBullet)) continue;

    if (!inListZone) {
      cleanLines.push(line);
    }
  }

  return cleanLines.join('\n') || text.split('\n')[0] || text;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatEventTime(start?: string, end?: string): string {
  if (!start) return '';
  try {
    const s = new Date(start);
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    };
    let result = s.toLocaleString(undefined, opts);
    if (end) {
      const e = new Date(end);
      result += ` – ${e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
    }
    return result;
  } catch {
    return start;
  }
}
