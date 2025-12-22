import { describe, it, expect } from 'vitest';

describe('Minimal Test', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should do math correctly', () => {
    expect(2 + 2).toBe(4);
  });
});
