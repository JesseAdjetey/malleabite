import { calculateEventPositions } from './src/lib/utils/event-overlap';
import dayjs from 'dayjs';

const events = [
  { id: '1', startsAt: dayjs('2024-01-01T09:00:00Z').toISOString(), endsAt: dayjs('2024-01-01T11:00:00Z').toISOString() },
  { id: '2', startsAt: dayjs('2024-01-01T10:00:00Z').toISOString(), endsAt: dayjs('2024-01-01T12:00:00Z').toISOString() },
  { id: '3', startsAt: dayjs('2024-01-01T09:00:00Z').toISOString(), endsAt: dayjs('2024-01-01T10:00:00Z').toISOString() }
];

const pos = calculateEventPositions(events as any);

for (const [id, p] of pos.entries()) {
    console.log(`Event ${id}: col ${p.column}, total ${p.totalColumns}`);
}
