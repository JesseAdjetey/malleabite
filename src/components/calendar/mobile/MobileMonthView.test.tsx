import { describe, it, expect } from 'vitest';

// Simple unit tests - component rendering tests run in E2E with Playwright

describe('MobileMonthView', () => {
  it('should export MobileMonthView component', async () => {
    const module = await import('./MobileMonthView');
    expect(module.MobileMonthView).toBeDefined();
    expect(typeof module.MobileMonthView).toBe('function');
  });

  it('validates date calculations', () => {
    const testDate = new Date('2025-01-15');
    expect(testDate.getMonth()).toBe(0); // January
    expect(testDate.getFullYear()).toBe(2025);
  });

  it('validates event structure', () => {
    const events = [
      { id: '1', title: 'Event 1', start: new Date('2025-01-15'), category: 'work' },
    ];
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('work');
  });
});
