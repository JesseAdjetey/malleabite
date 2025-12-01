
import React, { useState, useEffect, useRef } from 'react';
import { MallyAIFirebase as MallyAI } from './MallyAI.firebase';
import { CalendarEventType } from '@/lib/stores/types';
import { motion } from 'framer-motion';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useIsMobile } from '@/hooks/use-mobile';

interface DraggableMallyAIProps {
  onScheduleEvent: (event: CalendarEventType) => Promise<any>;
}

const DraggableMallyAI: React.FC<DraggableMallyAIProps> = ({ onScheduleEvent }) => {
  const isMobile = useIsMobile();
  const [position, setPosition] = useLocalStorage<{ x: number; y: number }>('mally-ai-position', { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [wasDragged, setWasDragged] = useState(false);

  // Initial position
  useEffect(() => {
    const setDefaultPosition = () => {
      // Position above the add event button (which is at bottom right)
      const defaultX = window.innerWidth - 100;
      const defaultY = window.innerHeight - 220; // Even higher above the add event button
      
      if (!position.x && !position.y) {
        setPosition({ x: defaultX, y: defaultY });
      } else {
        // Ensure position is within viewport bounds after window resize
        const boundedX = Math.min(Math.max(position.x, 20), window.innerWidth - 100);
        const boundedY = Math.min(Math.max(position.y, 20), window.innerHeight - 100);
        
        if (boundedX !== position.x || boundedY !== position.y) {
          setPosition({ x: boundedX, y: boundedY });
        }
      }
    };

    setDefaultPosition();
    window.addEventListener('resize', setDefaultPosition);
    return () => window.removeEventListener('resize', setDefaultPosition);
  }, []);

  // Handler for handling click vs. drag
  const handleDragEnd = (e: any, info: any) => {
    setIsDragging(false);
    
    // Update position in localStorage
    const newX = Math.min(Math.max(position.x + info.offset.x, 20), window.innerWidth - 100);
    const newY = Math.min(Math.max(position.y + info.offset.y, 20), window.innerHeight - 100);
    setPosition({ x: newX, y: newY });
    
    // If the drag distance was significant, mark as dragged to prevent dialog opening
    if (Math.abs(info.offset.x) > 5 || Math.abs(info.offset.y) > 5) {
      setWasDragged(true);
      setTimeout(() => setWasDragged(false), 300); // Reset after a short delay
    }
  };

  return (
    <motion.div
      ref={containerRef}
      drag={!isMobile}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      initial={false}
      animate={{
        x: position.x,
        y: position.y,
        scale: isDragging ? 1.05 : 1,
        opacity: isDragging ? 0.9 : 1
      }}
      className="fixed z-50 cursor-grab active:cursor-grabbing"
      whileDrag={{ scale: 1.05, opacity: 0.9 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <MallyAI 
        onScheduleEvent={onScheduleEvent} 
        preventOpenOnClick={wasDragged}
      />
    </motion.div>
  );
};

export default DraggableMallyAI;
