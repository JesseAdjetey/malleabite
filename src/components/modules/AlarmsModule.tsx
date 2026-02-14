
import React, { useState } from 'react';
import ModuleContainer from './ModuleContainer';
import { Clock, Bell, Loader2 } from 'lucide-react';
import { useAlarms } from '@/hooks/use-alarms';

interface AlarmsModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
}

const AlarmsModule: React.FC<AlarmsModuleProps> = ({
  title = "Alarms",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false
}) => {
  const { alarms, loading, addAlarm, deleteAlarm, toggleAlarm } = useAlarms();
  const [newAlarmTitle, setNewAlarmTitle] = useState('');
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');

  const handleAddAlarm = async () => {
    if (newAlarmTitle.trim()) {
      const alarmTime = new Date();
      const [hours, minutes] = newAlarmTime.split(':');
      alarmTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // If time has already passed today, set for tomorrow
      if (alarmTime < new Date()) {
        alarmTime.setDate(alarmTime.getDate() + 1);
      }

      await addAlarm(newAlarmTitle, alarmTime);
      setNewAlarmTitle('');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleAlarm(id, !enabled);
  };

  const handleDelete = async (id: string) => {
    await deleteAlarm(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddAlarm();
    }
  };

  const formatAlarmTime = (time: string | Date): string => {
    if (typeof time === 'string') {
      // If it's already in HH:MM format, return as-is
      if (time.includes(':') && time.length <= 8) return time;
      // Otherwise parse as ISO string
      const date = new Date(time);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // It's a Date object
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
    >
      <div className="max-h-60 overflow-y-auto mb-3">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="animate-spin" /></div>
        ) : alarms.length === 0 ? (
          <div className="text-center text-xs opacity-50 py-4">No alarms set</div>
        ) : (
          alarms.map(alarm => (
            <div
              key={alarm.id}
              className="flex items-center gap-2 bg-white/5 p-2 rounded-lg mb-2"
            >
              <div
                className={`w-4 h-4 rounded-full flex-shrink-0 cursor-pointer ${alarm.enabled ? 'bg-primary' : 'bg-secondary'}`}
                onClick={() => alarm.id && handleToggle(alarm.id, alarm.enabled)}
              />
              <div className="flex flex-col flex-1">
                <span className="text-sm">{alarm.title}</span>
                <span className="text-xs opacity-70 flex items-center gap-1">
                  <Clock size={12} />
                  {formatAlarmTime(alarm.time)}
                </span>
              </div>
              <button
                onClick={() => alarm.id && handleDelete(alarm.id)}
                className="text-destructive/70 hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newAlarmTitle}
            onChange={(e) => setNewAlarmTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="glass-input w-full text-xs"
            placeholder="Alarm title..."
          />
          <input
            type="time"
            value={newAlarmTime}
            onChange={(e) => setNewAlarmTime(e.target.value)}
            className="glass-input text-xs"
          />
        </div>
        <button
          onClick={handleAddAlarm}
          className="bg-primary px-3 py-1 w-full rounded-md hover:bg-primary/80 transition-colors"
        >
          <span className="flex items-center justify-center gap-1 text-sm">
            <Bell size={14} />
            Add Alarm
          </span>
        </button>
      </div>
    </ModuleContainer>
  );
};

export default AlarmsModule;
