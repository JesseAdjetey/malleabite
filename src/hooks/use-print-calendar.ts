// Print Calendar Hook - Print-friendly calendar views
import { useCallback, useRef } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { CalendarEventType } from '@/lib/stores/types';

export type PrintLayout = 'day' | 'week' | 'month' | 'agenda';
export type PrintOrientation = 'portrait' | 'landscape';
export type PrintSize = 'letter' | 'a4' | 'legal';

export interface PrintOptions {
  layout: PrintLayout;
  orientation: PrintOrientation;
  size: PrintSize;
  showWeekends: boolean;
  showDeclinedEvents: boolean;
  showEventDetails: boolean;
  showAllDayEvents: boolean;
  fontSize: 'small' | 'medium' | 'large';
  startDate: Dayjs;
  endDate?: Dayjs;
  title?: string;
}

const defaultOptions: PrintOptions = {
  layout: 'week',
  orientation: 'landscape',
  size: 'letter',
  showWeekends: true,
  showDeclinedEvents: false,
  showEventDetails: true,
  showAllDayEvents: true,
  fontSize: 'medium',
  startDate: dayjs(),
};

// Generate print-friendly HTML for calendar
function generatePrintHTML(
  events: CalendarEventType[],
  options: PrintOptions
): string {
  const { layout, orientation, size, fontSize, startDate, title } = options;
  
  const fontSizeMap = {
    small: '10px',
    medium: '12px',
    large: '14px',
  };
  
  const baseStyles = `
    @page {
      size: ${size} ${orientation};
      margin: 0.5in;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: ${fontSizeMap[fontSize]};
      color: #333;
      line-height: 1.4;
    }
    
    .print-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
    }
    
    .print-title {
      font-size: 1.5em;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .print-date-range {
      font-size: 1em;
      color: #666;
    }
    
    .calendar-grid {
      width: 100%;
      border-collapse: collapse;
    }
    
    .calendar-grid th,
    .calendar-grid td {
      border: 1px solid #ddd;
      padding: 4px;
      vertical-align: top;
    }
    
    .calendar-grid th {
      background: #f5f5f5;
      font-weight: bold;
      text-align: center;
      padding: 8px 4px;
    }
    
    .day-number {
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .event {
      padding: 2px 4px;
      margin-bottom: 2px;
      border-radius: 2px;
      font-size: 0.9em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .event-time {
      font-weight: bold;
      margin-right: 4px;
    }
    
    .all-day-event {
      background: #e3f2fd;
      color: #1565c0;
    }
    
    .time-slot {
      height: 40px;
      position: relative;
    }
    
    .time-label {
      width: 60px;
      text-align: right;
      padding-right: 8px;
      color: #666;
      font-size: 0.85em;
    }
    
    .agenda-list {
      width: 100%;
    }
    
    .agenda-day {
      margin-bottom: 16px;
    }
    
    .agenda-day-header {
      font-weight: bold;
      font-size: 1.1em;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
      margin-bottom: 8px;
    }
    
    .agenda-event {
      display: flex;
      padding: 6px 0;
      border-bottom: 1px solid #eee;
    }
    
    .agenda-event-time {
      width: 120px;
      font-weight: 500;
      color: #666;
    }
    
    .agenda-event-details {
      flex: 1;
    }
    
    .agenda-event-title {
      font-weight: 500;
    }
    
    .agenda-event-location {
      font-size: 0.9em;
      color: #666;
    }
    
    .weekend {
      background: #fafafa;
    }
    
    .today {
      background: #fff3e0;
    }
    
    @media print {
      .no-print {
        display: none !important;
      }
    }
  `;
  
  let content = '';
  
  // Filter events
  let filteredEvents = events.filter(e => {
    if (!options.showDeclinedEvents && e.status === 'cancelled') return false;
    if (!options.showAllDayEvents && e.isAllDay) return false;
    return true;
  });
  
  switch (layout) {
    case 'day':
      content = generateDayView(filteredEvents, startDate, options);
      break;
    case 'week':
      content = generateWeekView(filteredEvents, startDate, options);
      break;
    case 'month':
      content = generateMonthView(filteredEvents, startDate, options);
      break;
    case 'agenda':
      content = generateAgendaView(filteredEvents, startDate, options.endDate || startDate.add(7, 'day'), options);
      break;
  }
  
  const dateRangeText = layout === 'month'
    ? startDate.format('MMMM YYYY')
    : layout === 'day'
    ? startDate.format('dddd, MMMM D, YYYY')
    : `${startDate.format('MMM D')} - ${startDate.add(6, 'day').format('MMM D, YYYY')}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title || 'Calendar'}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="print-header">
    <div class="print-title">${title || 'Calendar'}</div>
    <div class="print-date-range">${dateRangeText}</div>
  </div>
  ${content}
</body>
</html>
  `;
}

function generateDayView(events: CalendarEventType[], date: Dayjs, options: PrintOptions): string {
  const dayEvents = events.filter(e => dayjs(e.startsAt).isSame(date, 'day'));
  const allDayEvents = dayEvents.filter(e => e.isAllDay);
  const timedEvents = dayEvents.filter(e => !e.isAllDay);
  
  let html = '<table class="calendar-grid"><thead><tr>';
  html += `<th>${date.format('dddd, MMMM D')}</th>`;
  html += '</tr></thead><tbody>';
  
  // All-day events
  if (allDayEvents.length > 0) {
    html += '<tr><td>';
    allDayEvents.forEach(e => {
      html += `<div class="event all-day-event">${e.title}</div>`;
    });
    html += '</td></tr>';
  }
  
  // Hourly grid
  for (let hour = 0; hour < 24; hour++) {
    const hourEvents = timedEvents.filter(e => dayjs(e.startsAt).hour() === hour);
    html += '<tr>';
    html += `<td class="time-slot">`;
    html += `<span class="time-label">${dayjs().hour(hour).format('h A')}</span>`;
    hourEvents.forEach(e => {
      const color = e.color || '#6366f1';
      html += `<div class="event" style="background: ${color}20; border-left: 3px solid ${color};">`;
      html += `<span class="event-time">${dayjs(e.startsAt).format('h:mm A')}</span>`;
      html += e.title;
      html += '</div>';
    });
    html += '</td></tr>';
  }
  
  html += '</tbody></table>';
  return html;
}

function generateWeekView(events: CalendarEventType[], startOfWeek: Dayjs, options: PrintOptions): string {
  const weekStart = startOfWeek.startOf('week');
  const days = options.showWeekends ? 7 : 5;
  
  let html = '<table class="calendar-grid"><thead><tr><th style="width: 60px;">Time</th>';
  
  for (let i = 0; i < days; i++) {
    const day = weekStart.add(i, 'day');
    const isToday = day.isSame(dayjs(), 'day');
    html += `<th class="${isToday ? 'today' : ''}">${day.format('ddd M/D')}</th>`;
  }
  html += '</tr></thead><tbody>';
  
  // All-day row
  html += '<tr><td class="time-label">All Day</td>';
  for (let i = 0; i < days; i++) {
    const day = weekStart.add(i, 'day');
    const allDayEvents = events.filter(e => 
      e.isAllDay && dayjs(e.startsAt).isSame(day, 'day')
    );
    html += '<td>';
    allDayEvents.forEach(e => {
      html += `<div class="event all-day-event">${e.title}</div>`;
    });
    html += '</td>';
  }
  html += '</tr>';
  
  // Hourly rows (6 AM to 10 PM for print)
  for (let hour = 6; hour <= 22; hour++) {
    html += '<tr>';
    html += `<td class="time-label">${dayjs().hour(hour).format('h A')}</td>`;
    
    for (let i = 0; i < days; i++) {
      const day = weekStart.add(i, 'day');
      const isToday = day.isSame(dayjs(), 'day');
      const isWeekend = day.day() === 0 || day.day() === 6;
      
      const hourEvents = events.filter(e =>
        !e.isAllDay &&
        dayjs(e.startsAt).isSame(day, 'day') &&
        dayjs(e.startsAt).hour() === hour
      );
      
      html += `<td class="time-slot ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">`;
      hourEvents.forEach(e => {
        const color = e.color || '#6366f1';
        html += `<div class="event" style="background: ${color}20; border-left: 2px solid ${color};">`;
        html += `<span class="event-time">${dayjs(e.startsAt).format('h:mm')}</span>`;
        html += e.title;
        html += '</div>';
      });
      html += '</td>';
    }
    html += '</tr>';
  }
  
  html += '</tbody></table>';
  return html;
}

function generateMonthView(events: CalendarEventType[], monthStart: Dayjs, options: PrintOptions): string {
  const start = monthStart.startOf('month').startOf('week');
  const end = monthStart.endOf('month').endOf('week');
  const weeks = Math.ceil(end.diff(start, 'day') / 7);
  
  let html = '<table class="calendar-grid"><thead><tr>';
  const dayNames = options.showWeekends
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  dayNames.forEach(d => { html += `<th>${d}</th>`; });
  html += '</tr></thead><tbody>';
  
  let current = start;
  for (let week = 0; week < weeks; week++) {
    html += '<tr>';
    for (let day = 0; day < 7; day++) {
      if (!options.showWeekends && (day === 0 || day === 6)) {
        current = current.add(1, 'day');
        continue;
      }
      
      const isCurrentMonth = current.month() === monthStart.month();
      const isToday = current.isSame(dayjs(), 'day');
      const isWeekend = current.day() === 0 || current.day() === 6;
      
      const dayEvents = events.filter(e =>
        dayjs(e.startsAt).isSame(current, 'day')
      ).slice(0, 4); // Max 4 events per day
      
      html += `<td class="${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}" style="height: 80px; ${!isCurrentMonth ? 'opacity: 0.5;' : ''}">`;
      html += `<div class="day-number">${current.format('D')}</div>`;
      
      dayEvents.forEach(e => {
        const time = e.isAllDay ? '' : dayjs(e.startsAt).format('h:mm ');
        const color = e.color || '#6366f1';
        html += `<div class="event" style="background: ${color}20;">`;
        html += `${time}${e.title}`;
        html += '</div>';
      });
      
      html += '</td>';
      current = current.add(1, 'day');
    }
    html += '</tr>';
  }
  
  html += '</tbody></table>';
  return html;
}

function generateAgendaView(
  events: CalendarEventType[],
  startDate: Dayjs,
  endDate: Dayjs,
  options: PrintOptions
): string {
  // Group events by day
  const eventsByDay: Map<string, CalendarEventType[]> = new Map();
  
  let current = startDate.startOf('day');
  while (current.isBefore(endDate)) {
    eventsByDay.set(current.format('YYYY-MM-DD'), []);
    current = current.add(1, 'day');
  }
  
  events.forEach(e => {
    const dayKey = dayjs(e.startsAt).format('YYYY-MM-DD');
    if (eventsByDay.has(dayKey)) {
      eventsByDay.get(dayKey)!.push(e);
    }
  });
  
  let html = '<div class="agenda-list">';
  
  eventsByDay.forEach((dayEvents, dateStr) => {
    if (dayEvents.length === 0) return;
    
    const date = dayjs(dateStr);
    const isToday = date.isSame(dayjs(), 'day');
    
    // Sort by time
    dayEvents.sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return dayjs(a.startsAt).diff(dayjs(b.startsAt));
    });
    
    html += `<div class="agenda-day ${isToday ? 'today' : ''}">`;
    html += `<div class="agenda-day-header">${date.format('dddd, MMMM D, YYYY')}</div>`;
    
    dayEvents.forEach(e => {
      html += '<div class="agenda-event">';
      html += '<div class="agenda-event-time">';
      if (e.isAllDay) {
        html += 'All day';
      } else {
        html += `${dayjs(e.startsAt).format('h:mm A')} - ${dayjs(e.endsAt).format('h:mm A')}`;
      }
      html += '</div>';
      html += '<div class="agenda-event-details">';
      html += `<div class="agenda-event-title">${e.title}</div>`;
      if (options.showEventDetails) {
        if (e.location) {
          html += `<div class="agenda-event-location">📍 ${e.location}</div>`;
        }
        if (e.description) {
          html += `<div class="agenda-event-description">${e.description}</div>`;
        }
      }
      html += '</div></div>';
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  return html;
}

export function usePrintCalendar() {
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const printCalendar = useCallback((
    events: CalendarEventType[],
    options: Partial<PrintOptions> = {}
  ) => {
    const fullOptions = { ...defaultOptions, ...options };
    const html = generatePrintHTML(events, fullOptions);
    
    // Create hidden iframe for printing
    if (!printFrameRef.current) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      printFrameRef.current = iframe;
    }
    
    const iframe = printFrameRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      
      // Wait for content to load then print
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 250);
    }
  }, []);

  const downloadPDF = useCallback((
    events: CalendarEventType[],
    options: Partial<PrintOptions> = {}
  ) => {
    // For PDF, we'd typically use a library like jsPDF or html2pdf
    // For now, trigger print with PDF option
    printCalendar(events, options);
  }, [printCalendar]);

  const exportHTML = useCallback((
    events: CalendarEventType[],
    options: Partial<PrintOptions> = {},
    filename: string = 'calendar.html'
  ) => {
    const fullOptions = { ...defaultOptions, ...options };
    const html = generatePrintHTML(events, fullOptions);
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return {
    printCalendar,
    downloadPDF,
    exportHTML,
    generatePrintHTML,
  };
}

export default usePrintCalendar;
