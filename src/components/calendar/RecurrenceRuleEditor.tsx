// Component for creating and editing recurrence rules
import React, { useState } from 'react';
import { RecurrenceRule } from '@/lib/stores/types';
import { formatRecurrenceRule } from '@/lib/utils/recurring-events';
import { Calendar, Plus, X } from 'lucide-react';

interface RecurrenceRuleEditorProps {
  value?: RecurrenceRule;
  onChange: (rule: RecurrenceRule | undefined) => void;
  startDate?: Date;
}

export const RecurrenceRuleEditor: React.FC<RecurrenceRuleEditorProps> = ({
  value,
  onChange,
  startDate = new Date()
}) => {
  const [enabled, setEnabled] = useState(!!value);
  const [frequency, setFrequency] = useState<RecurrenceRule['frequency']>(
    value?.frequency || 'weekly'
  );
  const [interval, setInterval] = useState(value?.interval || 1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(value?.daysOfWeek || []);
  const [dayOfMonth, setDayOfMonth] = useState(value?.dayOfMonth || startDate.getDate());
  const [monthOfYear, setMonthOfYear] = useState(
    value?.monthOfYear !== undefined ? value.monthOfYear : startDate.getMonth()
  );
  const [endType, setEndType] = useState<'never' | 'date' | 'count'>(
    value?.endDate ? 'date' : value?.count ? 'count' : 'never'
  );
  const [endDate, setEndDate] = useState(value?.endDate || '');
  const [count, setCount] = useState(value?.count || 10);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const updateRule = () => {
    if (!enabled) {
      onChange(undefined);
      return;
    }

    const rule: RecurrenceRule = {
      frequency,
      interval
    };

    // Add frequency-specific fields
    if (frequency === 'weekly' && daysOfWeek.length > 0) {
      rule.daysOfWeek = daysOfWeek;
    }

    if (frequency === 'monthly') {
      rule.dayOfMonth = dayOfMonth;
    }

    if (frequency === 'yearly') {
      rule.monthOfYear = monthOfYear;
      rule.dayOfMonth = dayOfMonth;
    }

    // Add end condition
    if (endType === 'date' && endDate) {
      rule.endDate = endDate;
    } else if (endType === 'count') {
      rule.count = count;
    }

    onChange(rule);
  };

  const toggleEnabled = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (!newEnabled) {
      onChange(undefined);
    } else {
      updateRule();
    }
  };

  const toggleDayOfWeek = (day: number) => {
    const newDays = daysOfWeek.includes(day)
      ? daysOfWeek.filter(d => d !== day)
      : [...daysOfWeek, day].sort((a, b) => a - b);
    setDaysOfWeek(newDays);
  };

  React.useEffect(() => {
    if (enabled) {
      updateRule();
    }
  }, [enabled, frequency, interval, daysOfWeek, dayOfMonth, monthOfYear, endType, endDate, count]);

  const currentRule = enabled
    ? { frequency, interval, daysOfWeek, dayOfMonth, monthOfYear, endDate: endType === 'date' ? endDate : undefined, count: endType === 'count' ? count : undefined }
    : undefined;

  return (
    <div className="space-y-4">
      {/* Toggle Recurrence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" />
          <label className="text-sm font-medium text-foreground">
            Repeat Event
          </label>
        </div>
        <button
          type="button"
          onClick={toggleEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-gradient-to-r from-purple-500 to-violet-600' : 'bg-white/10 border border-white/20'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Frequency Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequency(freq)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    frequency === freq
                      ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/50'
                      : 'glass-input hover:border-purple-400/50'
                  }`}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Interval */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Repeat every
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="99"
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 glass-input text-foreground"
              />
              <span className="text-sm text-muted-foreground">
                {frequency === 'daily' && (interval === 1 ? 'day' : 'days')}
                {frequency === 'weekly' && (interval === 1 ? 'week' : 'weeks')}
                {frequency === 'monthly' && (interval === 1 ? 'month' : 'months')}
                {frequency === 'yearly' && (interval === 1 ? 'year' : 'years')}
              </span>
            </div>
          </div>

          {/* Weekly: Days of Week */}
          {frequency === 'weekly' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Repeat on
              </label>
              <div className="flex gap-2">
                {dayNames.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDayOfWeek(index)}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                      daysOfWeek.includes(index)
                        ? 'bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/50'
                        : 'glass-input hover:border-purple-400/50'
                    }`}
                  >
                    {day[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly: Day of Month */}
          {frequency === 'monthly' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Day of month
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                className="w-20 glass-input text-foreground"
              />
            </div>
          )}

          {/* Yearly: Month and Day */}
          {frequency === 'yearly' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Date
              </label>
              <div className="flex gap-2">
                <select
                  value={monthOfYear}
                  onChange={(e) => setMonthOfYear(parseInt(e.target.value))}
                  className="flex-1 glass-input text-foreground"
                >
                  {monthNames.map((month, index) => (
                    <option key={index} value={index}>
                      {month}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                  className="w-20 glass-input text-foreground"
                />
              </div>
            </div>
          )}

          {/* End Condition */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Ends
            </label>
            <div className="space-y-2">
              {/* Never */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === 'never'}
                  onChange={() => setEndType('never')}
                  className="w-4 h-4 text-purple-600 accent-purple-600"
                />
                <span className="text-sm text-foreground">Never</span>
              </label>

              {/* On Date */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === 'date'}
                  onChange={() => setEndType('date')}
                  className="w-4 h-4 text-purple-600 accent-purple-600"
                />
                <span className="text-sm text-foreground">On</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setEndType('date');
                  }}
                  className="flex-1 glass-input text-foreground text-sm"
                />
              </label>

              {/* After N occurrences */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === 'count'}
                  onChange={() => setEndType('count')}
                  className="w-4 h-4 text-purple-600 accent-purple-600"
                />
                <span className="text-sm text-foreground">After</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={count}
                  onChange={(e) => {
                    setCount(Math.max(1, parseInt(e.target.value) || 1));
                    setEndType('count');
                  }}
                  className="w-20 glass-input text-foreground text-sm"
                />
                <span className="text-sm text-foreground">occurrences</span>
              </label>
            </div>
          </div>

          {/* Summary */}
          {currentRule && (
            <div className="glass-card p-3 border-purple-500/30">
              <p className="text-sm text-foreground">
                <span className="font-medium text-purple-400">Repeats: </span>
                {formatRecurrenceRule(currentRule)}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
