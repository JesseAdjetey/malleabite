import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoiceState } from '@/hooks/use-mally-voice';

interface VoiceOverlayProps {
  voiceState: VoiceState;
  transcript: string;
  assistantText: string;
  lastAction: string;
  volume: number;
  onStop: () => void;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  voiceState,
  transcript,
  assistantText,
  lastAction,
  volume,
  onStop,
}) => {
  const isActive = voiceState !== 'idle';
  const isConnecting = voiceState === 'connecting';
  const isLive = voiceState !== 'idle' && voiceState !== 'connecting';
  
  // Apple-style vibrant blur nodes
  const SiriNode = ({ color, baseScale, delay, yOffset, xOffset, duration }: { color: string, baseScale: number, delay: number, yOffset: number[], xOffset: number[], duration: number }) => (
    <motion.div
      className={cn("absolute rounded-full mix-blend-screen", color)}
      style={{ filter: "blur(40px)" }}
      animate={{
        scale: [baseScale, baseScale + volume * 0.9, baseScale],
        x: xOffset,
        y: yOffset,
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: duration - (volume * 1.5),
        ease: "linear",
        repeat: Infinity,
        delay,
      }}
    />
  );

  return (
    <>
      {/* Non-blocking connecting pill — shown only during initial WebRTC handshake */}
      <AnimatePresence>
        {isConnecting && (
          <motion.div
            key="connecting-pill"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-5 py-3 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl"
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-violet-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-white/70 text-sm font-medium tracking-wide">Connecting to Mally…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen overlay — only shown once the call is actually live */}
      <AnimatePresence>
      {isLive && (
        <motion.div
          key="apple-voice-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(20px)" }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center overflow-hidden select-none"
        >
          {/* Absolute pitch black glass canvas */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[60px]" />
          
          {/* Subtle noise for premium dark mode banding reduction */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E")' }} />

          {/* Dismiss Button (Top Right Apple Style) */}
          <motion.button
            onClick={onStop}
            className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl flex items-center justify-center transition-colors !outline-none"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="h-5 w-5 text-white/70" strokeWidth={2.5} />
          </motion.button>

          {/* Central Floating Typography Canvas */}
          <div className="relative z-10 w-full max-w-4xl px-8 flex-grow flex flex-col justify-center items-center text-center -mt-20">
            <AnimatePresence mode="wait">
              {(!transcript && !assistantText) ? (
                <motion.div
                  key="listening-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <h1 className="text-[2.5rem] md:text-[3.5rem] font-semibold text-white/40 tracking-tight">
                    Go ahead, Mally is listening
                  </h1>
                </motion.div>
              ) : (
                <motion.div
                  key="transcript-state"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full flex flex-col gap-12 items-center"
                >
                  {transcript && (
                    <div className="w-full">
                      <p className="text-white/40 text-sm font-semibold tracking-widest uppercase mb-4">You</p>
                      <h2 className="text-[2.5rem] md:text-[4rem] font-medium text-white tracking-tight leading-[1.1]">
                        {transcript}
                      </h2>
                    </div>
                  )}

                  {assistantText && (
                    <motion.div
                      key="assistant"
                      initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
                      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                      className="w-full"
                    >
                      <p className="text-white/30 text-sm font-semibold tracking-widest uppercase mb-4">Mally</p>
                      <h2 className="text-[2rem] md:text-[3rem] font-medium text-white/90 tracking-tight leading-[1.1]">
                        {assistantText}
                      </h2>
                    </motion.div>
                  )}

                  <AnimatePresence>
                    {lastAction && (
                      <motion.div
                        key="last-action"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 self-center"
                      >
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-violet-400"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                        <span className="text-white/70 text-sm font-medium">{lastAction}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* The Siri Orb (Anchored to exact bottom edge) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3 w-[300px] h-[300px] flex justify-center items-center pointer-events-none">
            
            {/* Base ambient glow */}
            <motion.div 
              className="absolute w-[400px] h-[400px] rounded-full bg-white/5"
              style={{ filter: "blur(80px)" }}
              animate={{ opacity: 1, scale: 1 + volume * 0.5 }}
              transition={{ ease: "easeOut", duration: 0.5 }}
            />

            {voiceState === 'error' ? (
              <p className="text-red-400 font-semibold text-lg -translate-y-24 shadow-2xl">Network Error</p>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center mix-blend-screen opacity-90">
                {/* 
                  Apple Siri mesh colors: 
                  Cyan: #00e5ff
                  Magenta: #ff00ff
                  Deep Blue: #2979ff
                  Pink: #ff4081
                */}
                <SiriNode 
                  color="bg-[#00e5ff]" 
                  baseScale={voiceState === 'speaking' ? 1.4 : 1.1} 
                  delay={0} 
                  xOffset={[0, -40, 20, 0]}
                  yOffset={[0, 30, -20, 0]}
                  duration={6}
                />
                <SiriNode 
                  color="bg-[#ff00ff]" 
                  baseScale={voiceState === 'speaking' ? 1.3 : 1.0} 
                  delay={0.5} 
                  xOffset={[0, 40, -10, 0]}
                  yOffset={[0, -40, 20, 0]}
                  duration={7}
                />
                <SiriNode 
                  color="bg-[#2979ff]" 
                  baseScale={voiceState === 'speaking' ? 1.5 : 1.2} 
                  delay={1} 
                  xOffset={[-20, 30, -30, -20]}
                  yOffset={[20, -20, 30, 20]}
                  duration={5}
                />
                <SiriNode 
                  color="bg-[#ff4081]" 
                  baseScale={voiceState === 'speaking' ? 1.2 : 0.9} 
                  delay={1.5} 
                  xOffset={[30, -20, 40, 30]}
                  yOffset={[-30, 20, -10, -30]}
                  duration={8}
                />
                
                {/* Intense central core when loud */}
                <motion.div 
                  className="absolute w-24 h-24 rounded-full bg-white mix-blend-overlay"
                  style={{ filter: "blur(20px)" }}
                  animate={{ scale: volume * 1.5, opacity: volume * 0.8 }}
                  transition={{ ease: "easeOut", duration: 0.1 }}
                />
              </div>
            )}
          </div>
          
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
};
