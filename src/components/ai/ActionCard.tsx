// Compact inline action card for AI-executed actions (events, todos, alarms, etc.)
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, CheckSquare, Bell, Clock, Timer, Sparkles, Trash2, Plus, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionCardData } from "./rich-message-types";

interface CalendarAccount {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

interface TodoListInfo {
  id: string;
  name: string;
  color: string;
}

const iconMap: Record<string, React.ReactNode> = {
  calendar: <Calendar size={13} />,
  'check-square': <CheckSquare size={13} />,
  bell: <Bell size={13} />,
  clock: <Clock size={13} />,
  timer: <Timer size={13} />,
  star: <Star size={13} />,
};

const statusBadge: Record<string, { label: string; className: string }> = {
  created: { label: 'Created', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  updated: { label: 'Updated', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  deleted: { label: 'Deleted', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

interface ActionCardProps {
  card: ActionCardData;
  onUndo?: (card: ActionCardData) => void;
  onAddToCalendars?: (card: ActionCardData, calendarIds: string[]) => Promise<void> | void;
  onRemoveFromCalendars?: (card: ActionCardData, calendarIds: string[]) => Promise<void> | void;
  calendarAccounts?: CalendarAccount[];
  onAddToLists?: (card: ActionCardData, listIds: string[]) => Promise<void> | void;
  onRemoveFromLists?: (card: ActionCardData, listIds: string[]) => Promise<void> | void;
  todoLists?: TodoListInfo[];
}

export const ActionCard: React.FC<ActionCardProps> = ({ card, onUndo, onAddToCalendars, onRemoveFromCalendars, calendarAccounts, onAddToLists, onRemoveFromLists, todoLists }) => {
  const badge = statusBadge[card.status] || statusBadge.created;
  const icon = iconMap[card.icon || ''] || <Sparkles size={13} />;
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [showListPicker, setShowListPicker] = useState(false);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  const hasCalendarInfo = card.calendarInfo && card.type === 'event';
  const hasListInfo = card.listInfo && card.type === 'todo';
  const hasQuadrantInfo = card.quadrantInfo && card.type === 'eisenhower';

  // All calendar IDs the event currently exists in
  const existingCalendarIds = new Set<string>();
  if (card.calendarInfo) existingCalendarIds.add(card.calendarInfo.id);
  if (card.additionalCalendars) {
    card.additionalCalendars.forEach(c => existingCalendarIds.add(c.id));
  }

  // All list IDs the todo currently exists in
  const existingListIds = new Set<string>();
  if (card.listInfo) existingListIds.add(card.listInfo.id);
  if (card.additionalLists) {
    card.additionalLists.forEach(l => existingListIds.add(l.id));
  }

  const toggleCalendar = (calId: string) => {
    setSelectedCalendarIds(prev =>
      prev.includes(calId) ? prev.filter(id => id !== calId) : [...prev, calId]
    );
  };

  const toggleList = (listId: string) => {
    setSelectedListIds(prev =>
      prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]
    );
  };

  const openCalendarPicker = () => {
    if (showCalendarPicker) {
      setShowCalendarPicker(false);
      return;
    }
    // Pre-select existing calendars
    setSelectedCalendarIds([...existingCalendarIds]);
    setShowCalendarPicker(true);
  };

  const openListPicker = () => {
    if (showListPicker) {
      setShowListPicker(false);
      return;
    }
    // Pre-select existing lists
    setSelectedListIds([...existingListIds]);
    setShowListPicker(true);
  };

  const handleConfirmCalendars = async () => {
    const toAdd = selectedCalendarIds.filter(id => !existingCalendarIds.has(id));
    const toRemove = [...existingCalendarIds].filter(id => !selectedCalendarIds.includes(id));
    if (toAdd.length > 0 && onAddToCalendars) await onAddToCalendars(card, toAdd);
    if (toRemove.length > 0 && onRemoveFromCalendars) await onRemoveFromCalendars(card, toRemove);
    setShowCalendarPicker(false);
  };

  const handleConfirmLists = async () => {
    const toAdd = selectedListIds.filter(id => !existingListIds.has(id));
    const toRemove = [...existingListIds].filter(id => !selectedListIds.includes(id));
    if (toAdd.length > 0 && onAddToLists) await onAddToLists(card, toAdd);
    if (toRemove.length > 0 && onRemoveFromLists) await onRemoveFromLists(card, toRemove);
    setShowListPicker(false);
  };

  // Compute whether the selection differs from existing
  const calendarSelectionChanged = showCalendarPicker && (
    selectedCalendarIds.some(id => !existingCalendarIds.has(id)) ||
    [...existingCalendarIds].some(id => !selectedCalendarIds.includes(id))
  );
  const listSelectionChanged = showListPicker && (
    selectedListIds.some(id => !existingListIds.has(id)) ||
    [...existingListIds].some(id => !selectedListIds.includes(id))
  );

  const allCalendars = calendarAccounts || [];
  const allLists = todoLists || [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="mt-1.5"
    >
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
          "bg-black/[0.03] dark:bg-white/[0.06]",
          "border border-black/[0.06] dark:border-white/[0.08]",
        )}
      >
        {/* Color accent + icon */}
        <div
          className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
          style={{ backgroundColor: `${card.color || '#8b5cf6'}20`, color: card.color || '#8b5cf6' }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{card.title}</span>
            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0", badge.className)}>
              {badge.label}
            </span>
          </div>
          {card.subtitle && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{card.subtitle}</p>
          )}
        </div>

        {/* Undo button for created items */}
        {card.status === 'created' && onUndo && (
          <button
            onClick={() => onUndo(card)}
            className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-0.5"
            title="Undo"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Calendar info row for event cards */}
      {hasCalendarInfo && (
        <div className="flex items-center gap-1 mt-1 px-2.5 flex-wrap">
          {/* Primary calendar dot + name */}
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: card.calendarInfo!.color }}
            />
            <span className="text-[10px] font-medium text-foreground/70">{card.calendarInfo!.name}</span>
          </div>

          {/* Additional calendars */}
          {card.additionalCalendars?.map(cal => (
            <div key={cal.id} className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">·</span>
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cal.color }}
              />
              <span className="text-[10px] font-medium text-foreground/70">{cal.name}</span>
            </div>
          ))}

          {/* "Add to" button — shows all calendars */}
          {(onAddToCalendars || onRemoveFromCalendars) && allCalendars.length > 1 && (
            <button
              onClick={openCalendarPicker}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full transition-colors shrink-0 ml-auto",
                "text-muted-foreground hover:text-foreground",
                "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]",
              )}
            >
              <span className="flex items-center gap-0.5">
                <Plus size={8} />
                Add to
              </span>
            </button>
          )}
        </div>
      )}

      {/* Calendar picker dropdown — shows ALL calendars with existing pre-selected */}
      <AnimatePresence>
        {showCalendarPicker && allCalendars.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1 mt-1.5 px-2.5 pb-1 max-h-28 overflow-y-auto">
              {allCalendars.map(cal => {
                const isSelected = selectedCalendarIds.includes(cal.id);
                return (
                  <button
                    key={cal.id}
                    onClick={() => toggleCalendar(cal.id)}
                    className={cn(
                      "flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-all",
                      "border",
                      isSelected
                        ? "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300"
                        : "bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]",
                    )}
                  >
                    {isSelected ? (
                      <Check size={8} className="text-purple-500" />
                    ) : (
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cal.color }}
                      />
                    )}
                    <span>{cal.name}</span>
                  </button>
                );
              })}
            </div>
            {/* Confirm button — only when selection changed */}
            {calendarSelectionChanged && (
              <div className="flex justify-end px-2.5 pb-1 mt-0.5">
                <button
                  onClick={handleConfirmCalendars}
                  className={cn(
                    "flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium",
                    "bg-purple-600 text-white hover:bg-purple-700 transition-colors",
                  )}
                >
                  <Check size={9} />
                  Confirm
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Todo list info row */}
      {hasListInfo && (
        <div className="flex items-center gap-1 mt-1 px-2.5 flex-wrap">
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: card.listInfo!.color }}
            />
            <span className="text-[10px] font-medium text-foreground/70">{card.listInfo!.name}</span>
          </div>

          {card.additionalLists?.map(list => (
            <div key={list.id} className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">·</span>
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: list.color }}
              />
              <span className="text-[10px] font-medium text-foreground/70">{list.name}</span>
            </div>
          ))}

          {/* "Add to" button — shows all lists */}
          {(onAddToLists || onRemoveFromLists) && allLists.length > 1 && (
            <button
              onClick={openListPicker}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full transition-colors shrink-0 ml-auto",
                "text-muted-foreground hover:text-foreground",
                "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]",
              )}
            >
              <span className="flex items-center gap-0.5">
                <Plus size={8} />
                Add to
              </span>
            </button>
          )}
        </div>
      )}

      {/* List picker dropdown — shows ALL lists with existing pre-selected */}
      <AnimatePresence>
        {showListPicker && allLists.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1 mt-1.5 px-2.5 pb-1 max-h-28 overflow-y-auto">
              {allLists.map(list => {
                const isSelected = selectedListIds.includes(list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => toggleList(list.id)}
                    className={cn(
                      "flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-all",
                      "border",
                      isSelected
                        ? "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300"
                        : "bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]",
                    )}
                  >
                    {isSelected ? (
                      <Check size={8} className="text-purple-500" />
                    ) : (
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: list.color }}
                      />
                    )}
                    <span>{list.name}</span>
                  </button>
                );
              })}
            </div>
            {/* Confirm button — only when selection changed */}
            {listSelectionChanged && (
              <div className="flex justify-end px-2.5 pb-1 mt-0.5">
                <button
                  onClick={handleConfirmLists}
                  className={cn(
                    "flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium",
                    "bg-purple-600 text-white hover:bg-purple-700 transition-colors",
                  )}
                >
                  <Check size={9} />
                  Confirm
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Eisenhower quadrant info row */}
      {hasQuadrantInfo && (
        <div className="flex items-center gap-1 mt-1 px-2.5">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: card.quadrantInfo!.color }}
          />
          <span className="text-[10px] font-medium text-foreground/70">{card.quadrantInfo!.label}</span>
        </div>
      )}
    </motion.div>
  );
};
