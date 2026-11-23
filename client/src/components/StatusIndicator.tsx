import { useState, useEffect } from "react";

export interface StatusIndicatorProps {
  text: string;
  className?: string;
}

/**
 * Renders save/connection status text with a 120ms crossfade animation.
 */
export function StatusIndicator({ text, className = "" }: StatusIndicatorProps) {
  const [displayText, setDisplayText] = useState(text);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (text !== displayText) {
      setFading(true);
      const timeout = setTimeout(() => {
        setDisplayText(text);
        setFading(false);
      }, 120);
      return () => clearTimeout(timeout);
    }
  }, [text, displayText]);

  return (
    <span
      className={`text-ui-xs text-ink-soft select-none transition-status ${
        fading ? "opacity-0" : "opacity-100"
      } ${className}`.trim()}
      aria-live="polite"
    >
      {displayText}
    </span>
  );
}
