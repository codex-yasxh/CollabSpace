import { useState, useEffect, useRef } from "react";

export interface DocumentTitleInputProps {
  title: string;
  canEdit: boolean;
  onSave: (newTitle: string) => Promise<void> | void;
}

/**
 * Inline editable document title.
 * - Looks like plain text until hover/focus.
 * - PATCH on blur or Enter.
 * - Escape reverts without saving.
 * - Owner/Editor only (plain text for viewers).
 * - Not live-synced.
 */
export function DocumentTitleInput({
  title,
  canEdit,
  onSave,
}: DocumentTitleInputProps) {
  const [val, setVal] = useState(title);
  const revertedRef = useRef(false);

  useEffect(() => {
    setVal(title);
  }, [title]);

  if (!canEdit) {
    return (
      <span className="text-ui-sm font-medium text-ink truncate max-w-xs">
        {title}
      </span>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      revertedRef.current = true;
      setVal(title);
      e.currentTarget.blur();
    }
  };

  const handleBlur = async () => {
    if (revertedRef.current) {
      revertedRef.current = false;
      return;
    }
    const trimmed = val.trim();
    if (!trimmed) {
      setVal(title);
      return;
    }
    if (trimmed !== title) {
      await onSave(trimmed);
    }
  };

  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      aria-label="Document title"
      className="text-ui-sm font-medium text-ink bg-transparent hover:bg-wash focus:bg-paper border border-transparent hover:border-line focus:border-line rounded-control px-2 py-0.5 max-w-xs md:max-w-sm transition-colors cursor-text focus-visible:outline-2 focus-visible:outline-focus"
      style={{ width: `${Math.max(val.length + 2, 8)}ch` }}
    />
  );
}
