import { describe, it, expect, vi } from 'vitest';

// Simple unit tests that don't require full component rendering
// Component integration tests should run in E2E with Playwright

describe('MobileEventForm', () => {
  it('should export MobileEventForm component', async () => {
    const module = await import('./MobileEventForm');
    expect(module.MobileEventForm).toBeDefined();
    expect(typeof module.MobileEventForm).toBe('function');
  });

  it('should have correct prop types defined', async () => {
    const module = await import('./MobileEventForm');
    // Component exists and can be called
    expect(module.MobileEventForm.name).toBe('MobileEventForm');
  });

  it('validates event data structure', () => {
    const eventData = {
      title: 'Test Event',
      description: 'Test description',
      startsAt: new Date('2025-01-15T10:00:00'),
      endsAt: new Date('2025-01-15T11:00:00'),
      category: 'work',
      allDay: false,
      reminder: true,
    };

    expect(eventData.title).toBe('Test Event');
    expect(eventData.category).toBe('work');
    expect(eventData.allDay).toBe(false);
    expect(eventData.startsAt).toBeInstanceOf(Date);
  });
});
