// Animated streaming text display for AI responses (word-by-word appearance)
import React, { useEffect, useState } from "react";

interface StreamingTextProps {
  text: string;
  /** When true, text has finished streaming — display all immediately */
  complete: boolean;
}

export const StreamingText: React.FC<StreamingTextProps> = ({ text, complete }) => {
  const [visibleLength, setVisibleLength] = useState(complete ? text.length : 0);

  useEffect(() => {
    if (complete) {
      setVisibleLength(text.length);
      return;
    }

    // Reveal characters in bursts (word-ish chunks) for performance
    if (visibleLength >= text.length) return;

    const nextSpace = text.indexOf(' ', visibleLength + 1);
    const chunkEnd = nextSpace === -1 ? text.length : nextSpace + 1;
    const delay = 18 + Math.random() * 12; // 18-30ms per word, feels natural

    const timer = setTimeout(() => {
      setVisibleLength(chunkEnd);
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleLength, text, complete]);

  // Reset when text changes (new message)
  useEffect(() => {
    if (!complete) setVisibleLength(0);
  }, [text, complete]);

  return (
    <span className="whitespace-pre-wrap">
      {text.slice(0, visibleLength)}
      {!complete && visibleLength < text.length && (
        <span className="inline-block w-[2px] h-[1em] bg-purple-500/60 align-middle animate-pulse ml-px" />
      )}
    </span>
  );
};
