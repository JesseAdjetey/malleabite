import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { EventTemplate, CreateTemplateInput } from '@/types/template';

interface TemplateFormProps {
  template?: EventTemplate;
  onSubmit: (data: CreateTemplateInput) => Promise<void>;
  onCancel: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'work', label: 'Work', color: '#3b82f6' },
  { value: 'personal', label: 'Personal', color: '#8b5cf6' },
  { value: 'health', label: 'Health', color: '#10b981' },
  { value: 'social', label: 'Social', color: '#f59e0b' },
  { value: 'custom', label: 'Custom', color: '#6b7280' },
];

const DURATION_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
];

export function TemplateForm({ template, onSubmit, onCancel }: TemplateFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateTemplateInput>({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'work',
    color: template?.color || '#3b82f6',
    duration: template?.duration || 60,
    title: template?.title || '',
    location: template?.location || '',
    notes: template?.notes || '',
    reminder: template?.reminder || 15,
    isAllDay: template?.isAllDay || false,
    tags: template?.tags || [],
  });
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting template:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag) || [],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-title3 font-semibold">
          {template ? 'Edit Template' : 'Create Template'}
        </h3>
      </div>

      {/* Template Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Template Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Team Standup, Gym Session"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Brief description of this template..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>

      {/* Category & Color */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value: any) => {
              const category = CATEGORY_OPTIONS.find((c) => c.value === value);
              setFormData({
                ...formData,
                category: value,
                color: category?.color || formData.color,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
          />
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label>Duration *</Label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              variant={formData.duration === preset.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormData({ ...formData, duration: preset.value })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Input
          type="number"
          min="5"
          step="5"
          value={formData.duration}
          onChange={(e) =>
            setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })
          }
          placeholder="Custom duration (minutes)"
        />
      </div>

      {/* Event Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Event Title *</Label>
        <Input
          id="title"
          placeholder="What will appear on the calendar"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="e.g., Conference Room A, Zoom"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Additional details..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </div>

      {/* Reminder */}
      <div className="space-y-2">
        <Label htmlFor="reminder">Reminder (minutes before)</Label>
        <Select
          value={formData.reminder?.toString() || '15'}
          onValueChange={(value) =>
            setFormData({ ...formData, reminder: parseInt(value) })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">No reminder</SelectItem>
            <SelectItem value="5">5 minutes</SelectItem>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="1440">1 day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <div className="flex gap-2">
          <Input
            id="tags"
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
            Add
          </Button>
        </div>
        {formData.tags && formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          {template ? 'Update' : 'Create'} Template
        </Button>
      </div>
    </form>
  );
}
