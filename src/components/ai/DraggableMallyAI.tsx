
import React, { useState, useEffect, useRef } from 'react';
import { MallyAIFirebase as MallyAI } from './MallyAI.firebase';
import { CalendarEventType } from '@/lib/stores/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useIsMobile } from '@/hooks/use-mobile';
import { Bot, X, Brain, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Try to import HeyMally context, but don't fail if not available
let useHeyMally: () => { isListening: boolean; isWakeWordEnabled: boolean } = () => ({ isListening: false, isWakeWordEnabled: false });
try {
  const HeyMallyContext = require('@/contexts/HeyMallyContext');
  useHeyMally = HeyMallyContext.useHeyMally;
} catch (e) {
  // Context not available
}

interface DraggableMallyAIProps {
  onScheduleEvent: (event: CalendarEventType) => Promise<any>;
}

const DraggableMallyAI: React.FC<DraggableMallyAIProps> = ({ onScheduleEvent }) => {
  const isMobile = useIsMobile();
  const [position, setPosition] = useLocalStorage<{ x: number; y: number }>('mally-ai-position', { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [wasDragged, setWasDragged] = useState(false);

  // Try to get Hey Mally status
  let heyMallyStatus = { isListening: false, isWakeWordEnabled: false };
  try {
    heyMallyStatus = useHeyMally();
  } catch (e) {
    // Context not available
  }

  // Listen for "Hey Mally" activation
  useEffect(() => {
    const handleHeyMallyActivation = () => {
      if (isMobile) {
        setIsMobileOpen(true);
      }
    };

    window.addEventListener('heyMallyActivated', handleHeyMallyActivation);
    return () => window.removeEventListener('heyMallyActivated', handleHeyMallyActivation);
  }, [isMobile]);

  // Initial position
  useEffect(() => {
    const setDefaultPosition = () => {
      // Position in bottom right, above nav bar
      const defaultX = window.innerWidth - 420;
      const defaultY = window.innerHeight - 670;

      if (!position.x && !position.y) {
        setPosition({ x: defaultX, y: defaultY });
      } else {
        // Ensure position is within viewport bounds after window resize
        const maxX = window.innerWidth - 400;
        const maxY = window.innerHeight - 80;
        const boundedX = Math.min(Math.max(position.x, 10), maxX);
        const boundedY = Math.min(Math.max(position.y, 10), maxY);

        if (boundedX !== position.x || boundedY !== position.y) {
          setPosition({ x: boundedX, y: boundedY });
        }
      }
    };

    setDefaultPosition();
    window.addEventListener('resize', setDefaultPosition);
    return () => window.removeEventListener('resize', setDefaultPosition);
  }, [isMobile]);

  // Handler for handling click vs. drag
  const handleDragEnd = (e: any, info: any) => {
    setIsDragging(false);

    // Calculate the new position
    const newX = Math.min(Math.max(position.x + info.offset.x, 20), window.innerWidth - 400);
    const newY = Math.min(Math.max(position.y + info.offset.y, 20), window.innerHeight - 80);

    // Only update position if we actually moved
    if (Math.abs(info.offset.x) > 2 || Math.abs(info.offset.y) > 2) {
      setPosition({ x: newX, y: newY });
    }

    // If the drag distance was significant, mark as dragged to prevent dialog opening
    if (Math.abs(info.offset.x) > 10 || Math.abs(info.offset.y) > 10) {
      setWasDragged(true);
      // Reset after a short delay to allow clicking again
      setTimeout(() => setWasDragged(false), 200);
    }
  };

  // Mobile drag handler
  const handleMobileDragEnd = (e: any, info: any) => {
    setIsDragging(false);

    // Calculate the new position
    const newX = Math.min(Math.max(position.x + info.offset.x, 10), window.innerWidth - 70);
    const newY = Math.min(Math.max(position.y + info.offset.y, 10), window.innerHeight - 150);

    // Only update position if we actually moved
    if (Math.abs(info.offset.x) > 2 || Math.abs(info.offset.y) > 2) {
      setPosition({ x: newX, y: newY });
    }

    // If the drag distance was significant, mark as dragged to prevent opening
    if (Math.abs(info.offset.x) > 10 || Math.abs(info.offset.y) > 10) {
      setWasDragged(true);
      // Reset after a short delay to allow clicking again
      setTimeout(() => setWasDragged(false), 200);
    }
  };

  // Mobile: Show draggable FAB and bottom sheet
  if (isMobile) {
    return (
      <>
        {/* Draggable Floating Action Button */}
        <motion.button
          drag
          dragMomentum={false}
          dragElastic={0.1}
          dragConstraints={{
            left: 10,
            right: window.innerWidth - 70,
            top: 10,
            bottom: window.innerHeight - 150
          }}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleMobileDragEnd}
          onTap={() => {
            if (!wasDragged && !isDragging) {
              setIsMobileOpen(true);
            }
          }}
          style={{ x: position.x, y: position.y }}
          className="fixed top-0 left-0 z-40 h-14 w-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg flex items-center justify-center text-white touch-none select-none"
          whileTap={{ scale: isDragging ? 1.1 : 0.95 }}
          initial={{ scale: 0 }}
          animate={{ scale: isDragging ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Brain size={24} />
          {/* Hey Mally listening indicator */}
          {heyMallyStatus.isListening && heyMallyStatus.isWakeWordEnabled && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 items-center justify-center">
                <Mic size={10} />
              </span>
            </span>
          )}
        </motion.button>

        {/* Mobile Bottom Sheet */}
        <AnimatePresence>
          {isMobileOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileOpen(false)}
                className="fixed inset-0 bg-black/50 z-[60]"
              />

              {/* Bottom Sheet */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[70] bg-gray-900 rounded-t-3xl shadow-2xl overflow-hidden"
                style={{ height: '75vh' }}
              >
                <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Bot className="text-white" size={20} />
                    Mally AI Assistant
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileOpen(false)}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    <X size={20} />
                  </Button>
                </div>
                <div className="h-[calc(75vh-64px)] overflow-hidden">
                  <MallyAI
                    onScheduleEvent={onScheduleEvent}
                    preventOpenOnClick={false}
                    isMobileSheet={true}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Desktop: Draggable widget
  return (
    <motion.div
      ref={containerRef}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={{
        left: 20,
        right: window.innerWidth - 400,
        top: 20,
        bottom: window.innerHeight - 80
      }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      initial={false}
      animate={{
        x: position.x,
        y: position.y,
        scale: isDragging ? 1.05 : 1,
        opacity: isDragging ? 0.9 : 1
      }}
      className="fixed z-50 cursor-grab active:cursor-grabbing select-none"
      whileDrag={{ scale: 1.05, opacity: 0.9 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <MallyAI
        onScheduleEvent={onScheduleEvent}
        preventOpenOnClick={wasDragged || isDragging}
        isDraggable={true}
      />
    </motion.div>
  );
};

export default DraggableMallyAI;
