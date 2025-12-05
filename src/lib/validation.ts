import { z } from 'zod';

/**
 * Input validation and sanitization utilities
 * Uses Zod for schema validation
 */

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Calendar Event Schema
 */
export const eventSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional()
    .transform(val => val?.trim()),
  
  date: z.date({
    required_error: 'Date is required',
    invalid_type_error: 'Invalid date'
  }),
  
  startsAt: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (use HH:MM)'),
  
  endsAt: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (use HH:MM)'),
  
  color: z.string()
    .regex(/^(#[0-9A-Fa-f]{6}|bg-[\w-]+)$/, 'Invalid color format')
    .optional(),
  
  isLocked: z.boolean().optional(),
  isTodo: z.boolean().optional(),
  hasAlarm: z.boolean().optional(),
  hasReminder: z.boolean().optional(),
}).refine((data) => {
  // Validate that end time is after start time
  const [startHour, startMin] = data.startsAt.split(':').map(Number);
  const [endHour, endMin] = data.endsAt.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['endsAt']
});

/**
 * Todo Item Schema
 */
export const todoSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title must be 500 characters or less')
    .trim(),
  
  description: z.string()
    .max(2000, 'Description must be 2000 characters or less')
    .optional()
    .transform(val => val?.trim()),
  
  completed: z.boolean().optional(),
  
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  
  dueDate: z.date().optional(),
});

/**
 * User Profile Schema
 */
export const userProfileSchema = z.object({
  displayName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be 50 characters or less')
    .trim()
    .optional(),
  
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  
  photoURL: z.string()
    .url('Invalid photo URL')
    .optional()
    .nullable(),
  
  timeZone: z.string().optional(),
  
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    notifications: z.boolean().optional(),
    emailDigest: z.boolean().optional(),
  }).optional(),
});

/**
 * Authentication Schema
 */
export const authSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be 128 characters or less'),
});

export const signUpSchema = authSchema.extend({
  displayName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be 50 characters or less')
    .trim()
    .optional(),
  
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Template Schema
 */
export const templateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .transform(val => val?.trim()),
  
  category: z.string()
    .min(1, 'Category is required')
    .max(50, 'Category must be 50 characters or less')
    .trim(),
  
  events: z.array(eventSchema)
    .min(1, 'Template must contain at least one event')
    .max(50, 'Template can contain maximum 50 events'),
});

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Remove potentially dangerous HTML/JavaScript from string input
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return input
    .trim()
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove on* event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove data: protocol (can be used for XSS)
    .replace(/data:text\/html/gi, '');
};

/**
 * Sanitize HTML content (for rich text)
 */
export const sanitizeHTML = (html: string): string => {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
};

/**
 * Sanitize URL
 */
export const sanitizeURL = (url: string): string => {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    // Only allow http, https, and mailto protocols
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

/**
 * Validate and sanitize email
 */
export const sanitizeEmail = (email: string): string => {
  if (!email) return '';
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[^\w\s@.-]/gi, ''); // Remove special characters except @ . - _
};

/**
 * Sanitize filename
 */
export const sanitizeFilename = (filename: string): string => {
  if (!filename) return '';
  
  return filename
    .trim()
    .replace(/[^a-z0-9_.-]/gi, '_') // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .substring(0, 255); // Limit length
};

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate event data
 */
export const validateEvent = (data: unknown) => {
  return eventSchema.safeParse(data);
};

/**
 * Validate todo data
 */
export const validateTodo = (data: unknown) => {
  return todoSchema.safeParse(data);
};

/**
 * Validate user profile data
 */
export const validateUserProfile = (data: unknown) => {
  return userProfileSchema.safeParse(data);
};

/**
 * Validate authentication credentials
 */
export const validateAuth = (data: unknown) => {
  return authSchema.safeParse(data);
};

/**
 * Validate signup data
 */
export const validateSignUp = (data: unknown) => {
  return signUpSchema.safeParse(data);
};

/**
 * Validate template data
 */
export const validateTemplate = (data: unknown) => {
  return templateSchema.safeParse(data);
};

// ============================================================================
// Rate Limiting Helpers
// ============================================================================

/**
 * Simple in-memory rate limiter
 * For production, use a proper rate limiting service
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  /**
   * Check if action is rate limited
   * @param key - Unique identifier (e.g., userId, IP)
   * @param maxAttempts - Maximum attempts allowed
   * @param windowMs - Time window in milliseconds
   */
  isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Filter attempts within the time window
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    // Update attempts
    this.attempts.set(key, [...recentAttempts, now]);
    
    // Check if rate limited
    return recentAttempts.length >= maxAttempts;
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.attempts.delete(key);
  }
}

export const rateLimiter = new RateLimiter();

// ============================================================================
// Export Types
// ============================================================================

export type EventInput = z.infer<typeof eventSchema>;
export type TodoInput = z.infer<typeof todoSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type AuthInput = z.infer<typeof authSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
