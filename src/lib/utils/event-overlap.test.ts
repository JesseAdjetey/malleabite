import { describe, it, expect } from 'vitest';
import { calculateEventPositions, getEventStyle } from './event-overlap';
import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';

describe('Event Overlap Utility', () => {
    const createMockEvent = (id: string, startHour: number, endHour: number): CalendarEventType => ({
        id,
        title: `Event ${id}`,
        date: '2024-01-01',
        description: '',
        startsAt: dayjs('2024-01-01').hour(startHour).toISOString(),
        endsAt: dayjs('2024-01-01').hour(endHour).toISOString(),
        isAllDay: false,
        color: 'bg-blue-500',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    describe('calculateEventPositions', () => {
        it('handles single event (no overlap)', () => {
            const events = [createMockEvent('1', 9, 10)];
            const positions = calculateEventPositions(events);

            expect(positions.size).toBe(1);
            expect(positions.get('1')).toEqual({
                event: events[0],
                column: 0,
                totalColumns: 1,
                isOverlapping: false,
            });
        });

        it('handles two overlapping events', () => {
            const events = [
                createMockEvent('1', 9, 11),
                createMockEvent('2', 10, 12),
            ];
            const positions = calculateEventPositions(events);

            expect(positions.size).toBe(2);
            expect(positions.get('1')?.isOverlapping).toBe(true);
            expect(positions.get('2')?.isOverlapping).toBe(true);
            expect(positions.get('1')?.totalColumns).toBe(2);
            expect(positions.get('2')?.totalColumns).toBe(2);
            expect(positions.get('1')?.column).not.toBe(positions.get('2')?.column);
        });

        it('handles three overlapping events', () => {
            const events = [
                createMockEvent('1', 9, 11),
                createMockEvent('2', 10, 12),
                createMockEvent('3', 9, 10), // Shorter event fully inside others
            ];
            const positions = calculateEventPositions(events);

            expect(positions.size).toBe(3);
            ['1', '2', '3'].forEach(id => {
                expect(positions.get(id)?.isOverlapping).toBe(true);
                expect(positions.get(id)?.totalColumns).toBe(3);
            });
            // Ensure all get different columns
            const cols = new Set(['1', '2', '3'].map(id => positions.get(id)?.column));
            expect(cols.size).toBe(3);
        });

        it('handles non-overlapping sequence', () => {
            const events = [
                createMockEvent('1', 9, 10),
                createMockEvent('2', 10, 11), // Starts exactly when previous ends - no overlap
            ];
            const positions = calculateEventPositions(events);

            expect(positions.size).toBe(2);
            expect(positions.get('1')?.isOverlapping).toBe(false);
            expect(positions.get('2')?.isOverlapping).toBe(false);
            expect(positions.get('1')?.totalColumns).toBe(1);
            expect(positions.get('2')?.totalColumns).toBe(1);
            expect(positions.get('1')?.column).toBe(0);
            expect(positions.get('2')?.column).toBe(0);
        });

        it('handles mixed overlap scenarios', () => {
            const events = [
                createMockEvent('1', 9, 10),   // Group 1: Solo
                createMockEvent('2', 11, 13),  // Group 2: Overlaps with 3
                createMockEvent('3', 12, 14),  // Group 2: Overlaps with 2
                createMockEvent('4', 15, 16),  // Group 3: Solo
            ];

            const positions = calculateEventPositions(events);

            // Group 1
            expect(positions.get('1')?.isOverlapping).toBe(false);
            expect(positions.get('1')?.totalColumns).toBe(1);

            // Group 2
            expect(positions.get('2')?.isOverlapping).toBe(true);
            expect(positions.get('3')?.isOverlapping).toBe(true);
            expect(positions.get('2')?.totalColumns).toBe(2);

            // Group 3
            expect(positions.get('4')?.isOverlapping).toBe(false);
            expect(positions.get('4')?.totalColumns).toBe(1);
        });
    });

    describe('getEventStyle', () => {
        it('returns full width for non-overlapping events', () => {
            const pos = { event: createMockEvent('1', 9, 10), column: 0, totalColumns: 1, isOverlapping: false };
            expect(getEventStyle(pos)).toEqual({ left: '0%', width: '100%' });
        });

        it('splits width evenly for 2 columns', () => {
            const pos1 = { event: createMockEvent('1', 9, 10), column: 0, totalColumns: 2, isOverlapping: true };
            const pos2 = { event: createMockEvent('2', 9, 10), column: 1, totalColumns: 2, isOverlapping: true };

            expect(getEventStyle(pos1)).toEqual({ left: '0%', width: '50%' });
            expect(getEventStyle(pos2)).toEqual({ left: '50%', width: '50%' });
        });

        it('splits width evenly for 3 columns', () => {
            const pos = { event: createMockEvent('1', 9, 10), column: 1, totalColumns: 3, isOverlapping: true };
            // 100/3 = 33.333333...
            const style = getEventStyle(pos);
            expect(parseFloat(style.left)).toBeCloseTo(33.33);
            expect(parseFloat(style.width)).toBeCloseTo(33.33);
        });
    });
});
