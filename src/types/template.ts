// Event Template Type Definitions
export interface EventTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: 'work' | 'personal' | 'health' | 'social' | 'custom';
  color: string;
  duration: number; // Duration in minutes
  
  // Template fields (can have placeholders)
  title: string;
  location?: string;
  notes?: string;
  
  // Default settings
  reminder?: number; // Minutes before event
  isAllDay?: boolean;
  
  // Usage tracking
  usageCount: number;
  lastUsed?: string; // ISO date string
  isFavorite: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category: 'work' | 'personal' | 'health' | 'social' | 'custom';
  color: string;
  duration: number;
  title: string;
  location?: string;
  notes?: string;
  reminder?: number;
  isAllDay?: boolean;
  tags?: string[];
}

export interface TemplateFilter {
  category?: 'work' | 'personal' | 'health' | 'social' | 'custom';
  search?: string;
  tags?: string[];
  favoritesOnly?: boolean;
}
