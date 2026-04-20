/**
 * macOS Apple Reminders + Calendar bridge via JXA (JavaScript for Automation).
 * Runs on the Electron main process only — never shipped to iOS/web.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function runJXA(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script]);
  return stdout.trim();
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function getReminderLists() {
  const script = `
    const app = Application('Reminders');
    const lists = app.lists();
    const result = [];
    for (const l of lists) {
      try { result.push({ id: l.id(), title: l.name() }); } catch(e) {}
    }
    JSON.stringify(result);
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw) as any[];
}

export async function getReminders(listId?: string) {
  const listFilter = listId ? `app.lists.whose({ id: "${listId.replace(/"/g, '\\"')}" })()` : `app.lists()`;
  const script = `
    const app = Application('Reminders');
    const lists = ${listFilter};
    const reminders = [];
    for (const list of lists) {
      try {
        const incomplete = list.reminders.whose({ completed: false })();
        for (const r of incomplete) {
          try {
            const dueDate = r.dueDate();
            reminders.push({
              id: r.id(),
              title: r.name() || '',
              notes: r.body() || '',
              isCompleted: false,
              dueDate: dueDate ? dueDate.toISOString() : null,
              calendarId: list.id(),
              calendarTitle: list.name(),
            });
          } catch(e) {}
        }
      } catch(le) {}
    }
    JSON.stringify(reminders);
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw) as any[];
}

export async function createReminder(params: {
  title: string;
  notes?: string;
  dueDate?: string;
  listId?: string;
  flagged?: boolean;
}) {
  const notesEscaped = (params.notes || '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const titleEscaped = params.title.replace(/"/g, '\\"');
  const listIdEscaped = (params.listId || '').replace(/"/g, '\\"');
  const script = `
    const app = Application('Reminders');
    ${params.listId
      ? `const matchedLists = app.lists.whose({ id: "${listIdEscaped}" })(); const list = matchedLists.length > 0 ? matchedLists[0] : app.defaultList;`
      : `const list = app.defaultList;`}
    const r = app.Reminder({ name: "${titleEscaped}", body: "${notesEscaped}" });
    list.reminders.push(r);
    ${params.dueDate ? `r.dueDate = new Date("${params.dueDate}");` : ''}
    ${params.flagged ? `r.flagged = true;` : ''}
    JSON.stringify({ id: r.id(), title: r.name(), calendarId: list.id() });
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw);
}

export async function completeReminder(reminderId: string) {
  const idEscaped = reminderId.replace(/"/g, '\\"');
  const script = `
    const app = Application('Reminders');
    const lists = app.lists();
    for (const list of lists) {
      const matches = list.reminders.whose({ id: "${idEscaped}" })();
      if (matches.length > 0) {
        matches[0].completed = true;
        break;
      }
    }
    JSON.stringify({ completed: true });
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw);
}

export async function deleteReminder(reminderId: string) {
  const idEscaped = reminderId.replace(/"/g, '\\"');
  const script = `
    const app = Application('Reminders');
    const lists = app.lists();
    for (const list of lists) {
      const matches = list.reminders.whose({ id: "${idEscaped}" })();
      if (matches.length > 0) {
        app.delete(matches[0]);
        break;
      }
    }
    JSON.stringify({ deleted: true });
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw);
}

export async function updateReminder(params: {
  reminderId: string;
  title?: string;
  notes?: string;
  dueDate?: string;
}) {
  const idEscaped = params.reminderId.replace(/"/g, '\\"');
  const lines: string[] = [];
  if (params.title) lines.push(`r.name = "${params.title.replace(/"/g, '\\"')}";`);
  if (params.notes !== undefined) lines.push(`r.body = "${params.notes.replace(/"/g, '\\"')}";`);
  if (params.dueDate) lines.push(`r.dueDate = new Date("${params.dueDate}");`);
  const script = `
    const app = Application('Reminders');
    const lists = app.lists();
    let updated = null;
    for (const list of lists) {
      const matches = list.reminders.whose({ id: "${idEscaped}" })();
      if (matches.length > 0) {
        const r = matches[0];
        ${lines.join('\n        ')}
        updated = { id: r.id(), title: r.name() };
        break;
      }
    }
    JSON.stringify(updated || { error: 'not found' });
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw);
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export async function getCalendars() {
  const script = `
    const app = Application('Calendar');
    const cals = app.calendars();
    JSON.stringify(cals.map(c => ({
      id: c.id(),
      title: c.name(),
      color: '#ff6b35',
      isSubscribed: false,
      allowsContentModifications: true,
    })));
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw) as any[];
}

export async function getEvents(startDate: string, endDate: string) {
  const script = `
    const app = Application('Calendar');
    const start = new Date("${startDate}");
    const end = new Date("${endDate}");
    const cals = app.calendars();
    const events = [];
    for (const cal of cals) {
      try {
        const evs = cal.events.whose({
          startDate: { _greaterThanEquals: start },
          endDate: { _lessThanEquals: end },
        })();
        for (const e of evs) {
          try {
            events.push({
              id: e.uid(),
              title: e.summary() || '',
              notes: e.description() || '',
              startDate: e.startDate().toISOString(),
              endDate: e.endDate().toISOString(),
              allDay: e.alldayEvent(),
              calendarId: cal.id(),
              calendarTitle: cal.name(),
              calendarColor: '#ff6b35',
            });
          } catch(ee) {}
        }
      } catch(ce) {}
    }
    JSON.stringify(events);
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw) as any[];
}

export async function createEvent(params: {
  title: string;
  startDate: string;
  endDate: string;
  notes?: string;
  allDay?: boolean;
  calendarId?: string;
}) {
  const titleEscaped = params.title.replace(/"/g, '\\"');
  const notesEscaped = (params.notes || '').replace(/"/g, '\\"');
  const script = `
    const app = Application('Calendar');
    const cal = ${params.calendarId
      ? `app.calendars.whose({ id: "${params.calendarId}" })[0] || app.defaultCalendar`
      : `app.defaultCalendar`};
    const e = app.Event({
      summary: "${titleEscaped}",
      startDate: new Date("${params.startDate}"),
      endDate: new Date("${params.endDate}"),
      description: "${notesEscaped}",
      alldayEvent: ${params.allDay ? 'true' : 'false'},
    });
    cal.events.push(e);
    JSON.stringify({ id: e.uid(), title: e.summary() });
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw);
}

export async function deleteEvent(eventId: string) {
  const idEscaped = eventId.replace(/"/g, '\\"');
  const script = `
    const app = Application('Calendar');
    const cals = app.calendars();
    for (const cal of cals) {
      const matches = cal.events.whose({ uid: "${idEscaped}" })();
      if (matches.length > 0) {
        app.delete(matches[0]);
        break;
      }
    }
    JSON.stringify({ deleted: true });
  `;
  const raw = await runJXA(script);
  return JSON.parse(raw);
}
