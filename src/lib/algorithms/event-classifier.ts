// Phase 2.5: Event Auto-categorization Algorithm
// Intelligently categorizes events based on keywords and learning from user behavior

import { CalendarEventType } from '@/lib/stores/types';

export type EventCategory = 'work' | 'personal' | 'health' | 'social' | 'education' | 'finance' | 'shopping' | 'travel' | 'other';

export interface CategorySuggestion {
  category: EventCategory;
  confidence: number; // 0-1
  reason: string;
  keywords: string[];
}

export interface ClassificationRule {
  category: EventCategory;
  keywords: string[];
  weight: number; // How strongly this rule applies
}

// Pre-defined keyword mappings for common event types
const DEFAULT_RULES: ClassificationRule[] = [
  // Work
  {
    category: 'work',
    keywords: ['meeting', 'standup', 'sync', 'review', 'presentation', 'call', 'conference', 'client', 'team', 'project', 'deadline', 'sprint', 'scrum', 'demo', 'interview', 'workshop', 'training'],
    weight: 1.0,
  },
  // Personal
  {
    category: 'personal',
    keywords: ['home', 'family', 'personal', 'errands', 'chores', 'birthday', 'anniversary', 'appointment', 'dentist', 'haircut', 'repairs', 'maintenance'],
    weight: 1.0,
  },
  // Health
  {
    category: 'health',
    keywords: ['gym', 'workout', 'exercise', 'fitness', 'yoga', 'run', 'jog', 'swim', 'doctor', 'therapy', 'medical', 'checkup', 'health', 'meditation', 'wellness', 'physical'],
    weight: 1.0,
  },
  // Social
  {
    category: 'social',
    keywords: ['dinner', 'lunch', 'coffee', 'drinks', 'party', 'hangout', 'friends', 'brunch', 'date', 'social', 'event', 'celebration', 'gathering', 'meetup', 'concert', 'movie'],
    weight: 1.0,
  },
  // Education
  {
    category: 'education',
    keywords: ['class', 'lecture', 'study', 'exam', 'course', 'learn', 'tutorial', 'webinar', 'seminar', 'workshop', 'training', 'school', 'university', 'college', 'homework'],
    weight: 1.0,
  },
  // Finance
  {
    category: 'finance',
    keywords: ['bank', 'payment', 'bill', 'tax', 'budget', 'finance', 'investment', 'insurance', 'loan', 'mortgage', 'accountant'],
    weight: 1.0,
  },
  // Shopping
  {
    category: 'shopping',
    keywords: ['shop', 'buy', 'purchase', 'groceries', 'store', 'mall', 'shopping', 'order', 'pickup'],
    weight: 1.0,
  },
  // Travel
  {
    category: 'travel',
    keywords: ['flight', 'hotel', 'trip', 'travel', 'vacation', 'holiday', 'airport', 'train', 'bus', 'drive', 'journey', 'tour'],
    weight: 1.0,
  },
];

/**
 * Extract keywords from event text
 */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2); // Filter short words
}

/**
 * Calculate match score between keywords and rule
 */
function calculateMatchScore(eventKeywords: string[], ruleKeywords: string[]): number {
  let matches = 0;
  let totalWeight = 0;

  eventKeywords.forEach(keyword => {
    ruleKeywords.forEach(ruleKeyword => {
      // Exact match
      if (keyword === ruleKeyword) {
        matches += 1.0;
        totalWeight += 1.0;
      }
      // Partial match (contains)
      else if (keyword.includes(ruleKeyword) || ruleKeyword.includes(keyword)) {
        matches += 0.5;
        totalWeight += 1.0;
      }
    });
  });

  return totalWeight > 0 ? matches / totalWeight : 0;
}

/**
 * Classify an event and return category suggestions
 */
export function classifyEvent(
  title: string,
  description?: string,
  location?: string
): CategorySuggestion[] {
  // Combine all text for analysis
  const combinedText = [title, description, location]
    .filter(Boolean)
    .join(' ');

  const eventKeywords = extractKeywords(combinedText);
  
  if (eventKeywords.length === 0) {
    return [{
      category: 'other',
      confidence: 0.5,
      reason: 'No keywords found',
      keywords: [],
    }];
  }

  // Score each category
  const scores: { category: EventCategory; score: number; matchedKeywords: string[] }[] = [];

  DEFAULT_RULES.forEach(rule => {
    const matchScore = calculateMatchScore(eventKeywords, rule.keywords);
    
    if (matchScore > 0) {
      const matchedKeywords = eventKeywords.filter(keyword =>
        rule.keywords.some(ruleKeyword =>
          keyword === ruleKeyword || keyword.includes(ruleKeyword) || ruleKeyword.includes(keyword)
        )
      );

      scores.push({
        category: rule.category,
        score: matchScore * rule.weight,
        matchedKeywords,
      });
    }
  });

  // Sort by score
  scores.sort((a, b) => b.score - a.score);

  // Convert to suggestions
  const suggestions: CategorySuggestion[] = scores.slice(0, 3).map(score => {
    const confidence = Math.min(score.score, 1.0);
    
    return {
      category: score.category,
      confidence,
      reason: score.matchedKeywords.length > 0
        ? `Matched: ${score.matchedKeywords.slice(0, 3).join(', ')}`
        : 'Pattern match',
      keywords: score.matchedKeywords,
    };
  });

  // If no good match, suggest 'other'
  if (suggestions.length === 0 || suggestions[0].confidence < 0.3) {
    return [{
      category: 'other',
      confidence: 0.4,
      reason: 'No clear category',
      keywords: [],
    }];
  }

  return suggestions;
}

/**
 * Learn from user corrections to improve future classifications
 */
export class EventClassifier {
  private learningRules: Map<string, ClassificationRule> = new Map();
  private corrections: Map<string, EventCategory> = new Map();

  constructor() {
    this.loadLearning();
  }

  /**
   * Classify event with learned rules
   */
  classify(title: string, description?: string, location?: string): CategorySuggestion[] {
    // Get base suggestions
    const baseSuggestions = classifyEvent(title, description, location);

    // Apply learned corrections
    const titleLower = title.toLowerCase();
    if (this.corrections.has(titleLower)) {
      const learnedCategory = this.corrections.get(titleLower)!;
      return [{
        category: learnedCategory,
        confidence: 0.95,
        reason: 'Learned from your past choices',
        keywords: [],
      }];
    }

    // Enhance with learned rules
    const combinedText = [title, description, location].filter(Boolean).join(' ');
    const eventKeywords = extractKeywords(combinedText);

    this.learningRules.forEach(rule => {
      const matchScore = calculateMatchScore(eventKeywords, rule.keywords);
      if (matchScore > 0) {
        const existing = baseSuggestions.find(s => s.category === rule.category);
        if (existing) {
          existing.confidence = Math.min(existing.confidence + 0.2, 1.0);
        } else {
          baseSuggestions.push({
            category: rule.category,
            confidence: matchScore * rule.weight,
            reason: 'Learned pattern',
            keywords: eventKeywords,
          });
        }
      }
    });

    return baseSuggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Learn from user correction
   */
  learn(title: string, userCategory: EventCategory, description?: string) {
    const titleLower = title.toLowerCase();
    this.corrections.set(titleLower, userCategory);

    // Extract keywords for future learning
    const combinedText = [title, description].filter(Boolean).join(' ');
    const keywords = extractKeywords(combinedText);

    // Update or create learning rule
    const existingRule = this.learningRules.get(userCategory);
    if (existingRule) {
      // Add new keywords
      keywords.forEach(keyword => {
        if (!existingRule.keywords.includes(keyword)) {
          existingRule.keywords.push(keyword);
        }
      });
      existingRule.weight = Math.min(existingRule.weight + 0.1, 2.0);
    } else {
      this.learningRules.set(userCategory, {
        category: userCategory,
        keywords,
        weight: 1.2,
      });
    }

    this.saveLearning();
  }

  /**
   * Get classification accuracy statistics
   */
  getStats() {
    return {
      totalCorrections: this.corrections.size,
      learnedRules: this.learningRules.size,
      categories: Array.from(new Set(this.corrections.values())),
    };
  }

  /**
   * Reset learning (for testing or user request)
   */
  reset() {
    this.learningRules.clear();
    this.corrections.clear();
    this.saveLearning();
  }

  /**
   * Save learning to localStorage
   */
  private saveLearning() {
    try {
      const data = {
        rules: Array.from(this.learningRules.entries()),
        corrections: Array.from(this.corrections.entries()),
      };
      localStorage.setItem('malleabite-classifier-learning', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save classifier learning:', error);
    }
  }

  /**
   * Load learning from localStorage
   */
  private loadLearning() {
    try {
      const data = localStorage.getItem('malleabite-classifier-learning');
      if (data) {
        const parsed = JSON.parse(data);
        this.learningRules = new Map(parsed.rules);
        this.corrections = new Map(parsed.corrections);
      }
    } catch (error) {
      console.error('Failed to load classifier learning:', error);
    }
  }
}

/**
 * Batch classify multiple events
 */
export function batchClassify(events: { title: string; description?: string }[]): Map<string, CategorySuggestion[]> {
  const results = new Map<string, CategorySuggestion[]>();
  
  events.forEach(event => {
    const suggestions = classifyEvent(event.title, event.description);
    results.set(event.title, suggestions);
  });

  return results;
}

/**
 * Get category color for UI display
 */
export function getCategoryColor(category: EventCategory): string {
  const colors: Record<EventCategory, string> = {
    work: '#3b82f6',      // blue
    personal: '#8b5cf6',  // purple
    health: '#10b981',    // green
    social: '#f59e0b',    // orange
    education: '#06b6d4', // cyan
    finance: '#84cc16',   // lime
    shopping: '#ec4899',  // pink
    travel: '#f97316',    // orange-red
    other: '#6b7280',     // gray
  };
  
  return colors[category] || colors.other;
}

/**
 * Get category icon emoji
 */
export function getCategoryIcon(category: EventCategory): string {
  const icons: Record<EventCategory, string> = {
    work: '💼',
    personal: '🏠',
    health: '💪',
    social: '👥',
    education: '📚',
    finance: '💰',
    shopping: '🛍️',
    travel: '✈️',
    other: '📌',
  };
  
  return icons[category] || icons.other;
}
