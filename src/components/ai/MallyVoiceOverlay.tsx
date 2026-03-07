// Full-screen Siri/Gemini-like voice activation overlay for "Hey Mally"
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MallyVoiceOverlayProps {
  isOpen: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isConnecting?: boolean; // True while Vapi WebRTC session is being established
  transcript: string;
  responseText: string;
  onClose: () => void;
  onInterrupt?: () => void; // Tap orb while speaking to interrupt and listen
}

// Animated orb component — the "Mally orb" (like Siri's sphere)
const MallyOrb: React.FC<{
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
}> = ({ isListening, isSpeaking, isProcessing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    let t = 0;

    const draw = () => {
      t += 0.02;
      ctx.clearRect(0, 0, size, size);

      // Determine intensity based on state
      const intensity = isSpeaking ? 1.2 : isListening ? 0.8 : isProcessing ? 0.5 : 0.3;
      const speed = isSpeaking ? 3 : isListening ? 2 : 1;

      // Draw layered glowing rings
      for (let ring = 0; ring < 4; ring++) {
        const baseRadius = 35 + ring * 12;
        ctx.beginPath();

        for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
          const wave1 = Math.sin(angle * 3 + t * speed + ring) * 6 * intensity;
          const wave2 = Math.cos(angle * 5 - t * speed * 0.7 + ring * 2) * 4 * intensity;
          const wave3 = Math.sin(angle * 7 + t * speed * 1.3) * 2 * intensity;
          const r = baseRadius + wave1 + wave2 + wave3;

          const x = center + r * Math.cos(angle);
          const y = center + r * Math.sin(angle);

          if (angle === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.closePath();

        const alpha = 0.15 - ring * 0.03;
        const purpleShade = ring === 0 ? '139, 92, 246' : ring === 1 ? '168, 85, 247' : ring === 2 ? '192, 132, 252' : '216, 180, 254';
        ctx.strokeStyle = `rgba(${purpleShade}, ${alpha + intensity * 0.15})`;
        ctx.lineWidth = 2.5 - ring * 0.3;
        ctx.stroke();

        // Fill the inner ring
        if (ring === 0) {
          const gradient = ctx.createRadialGradient(center, center, 0, center, center, baseRadius + 10);
          gradient.addColorStop(0, `rgba(139, 92, 246, ${0.25 + intensity * 0.15})`);
          gradient.addColorStop(0.5, `rgba(139, 92, 246, ${0.1 + intensity * 0.08})`);
          gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      // Center glow
      const glow = ctx.createRadialGradient(center, center, 0, center, center, 30);
      glow.addColorStop(0, `rgba(255, 255, 255, ${0.6 + Math.sin(t * 2) * 0.2 * intensity})`);
      glow.addColorStop(0.5, `rgba(192, 132, 252, ${0.3 + Math.sin(t * 2) * 0.1 * intensity})`);
      glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(center, center, 30, 0, Math.PI * 2);
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening, isSpeaking, isProcessing]);

  return (
    <canvas
      ref={canvasRef}
      className="w-[200px] h-[200px]"
    />
  );
};

export const MallyVoiceOverlay: React.FC<MallyVoiceOverlayProps> = ({
  isOpen,
  isListening,
  isSpeaking,
  isProcessing,
  isConnecting = false,
  transcript,
  responseText,
  onClose,
  onInterrupt,
}) => {
  const [displayedResponse, setDisplayedResponse] = useState('');
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayedResponseRef = useRef('');

  // Smart typewriter: when responseText GROWS (streaming), only animate the new tail.
  // When responseText is replaced (new response), reset and animate from scratch.
  useEffect(() => {
    if (!responseText) {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      setDisplayedResponse('');
      displayedResponseRef.current = '';
      return;
    }

    const prev = displayedResponseRef.current;

    // Determine starting position for animation
    let startIdx: number;
    if (responseText.startsWith(prev)) {
      // Streaming append — just animate the new characters
      startIdx = prev.length;
    } else {
      // New response — reset and animate from start
      startIdx = 0;
      setDisplayedResponse('');
      displayedResponseRef.current = '';
    }

    if (startIdx >= responseText.length) return; // Nothing new to animate

    if (typewriterRef.current) clearInterval(typewriterRef.current);
    let i = startIdx;
    // Faster speed for streaming (12ms) vs full response (18ms)
    const speed = startIdx === 0 ? 18 : 12;
    typewriterRef.current = setInterval(() => {
      if (i < responseText.length) {
        const slice = responseText.slice(0, i + 1);
        setDisplayedResponse(slice);
        displayedResponseRef.current = slice;
        i++;
      } else {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      }
    }, speed);

    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current); };
  }, [responseText]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
        >
          {/* Background blur overlay — tap to interrupt while speaking, close when idle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/80 dark:bg-black/70 backdrop-blur-2xl"
            onClick={isSpeaking && onInterrupt ? onInterrupt : onClose}
          />

          {/* Close button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.2 }}
            onClick={onClose}
            className="absolute top-12 right-6 z-10 p-3 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6 text-foreground" />
          </motion.button>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center gap-6 px-8 max-w-md w-full">
            {/* Mally orb — tap while speaking to interrupt */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.1 }}
              onClick={isSpeaking && onInterrupt ? onInterrupt : undefined}
              className={cn(
                'select-none',
                isSpeaking && onInterrupt && 'cursor-pointer active:scale-95 transition-transform'
              )}
              title={isSpeaking ? 'Tap to interrupt' : undefined}
            >
              <MallyOrb
                isListening={isListening}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing || isConnecting}
              />
            </motion.div>

            {/* Status label */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2"
            >
              {isListening && (
                <div className="flex items-center gap-2">
                  <div className="mally-voice-bars">
                    <span /><span /><span /><span /><span />
                  </div>
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    Listening...
                  </span>
                </div>
              )}
              {isConnecting && (
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400 animate-pulse">
                  Connecting...
                </span>
              )}
              {!isConnecting && isProcessing && (
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400 animate-pulse">
                  Thinking...
                </span>
              )}
              {isSpeaking && (
                <div className="flex items-center gap-2">
                  <div className="mally-voice-bars speaking">
                    <span /><span /><span /><span /><span />
                  </div>
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    Mally · <span className="opacity-60 text-xs">tap to interrupt</span>
                  </span>
                </div>
              )}
              {!isListening && !isProcessing && !isSpeaking && !isConnecting && (
                <span className="text-sm text-muted-foreground">
                  Say something...
                </span>
              )}
            </motion.div>

            {/* Live transcript (user speaking) */}
            <AnimatePresence mode="wait">
              {transcript && (
                <motion.div
                  key="transcript"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-center"
                >
                  <p className="text-lg font-medium text-foreground">
                    {transcript}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI response */}
            <AnimatePresence mode="wait">
              {displayedResponse && (
                <motion.div
                  key="response"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-center max-h-[30vh] overflow-y-auto scrollbar-hide"
                >
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {displayedResponse}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-xs text-muted-foreground/60 mt-4"
            >
              {isSpeaking ? 'Tap anywhere to interrupt' : 'Say "Goodbye" to close · tap \u00D7 to dismiss'}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MallyVoiceOverlay;
