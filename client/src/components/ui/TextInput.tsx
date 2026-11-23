import React, { useId } from "react";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, hint, id, className = "", disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-ui-xs font-medium text-ink select-none">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={`h-[36px] px-3 font-sans text-ui-sm text-ink bg-paper border rounded-[6px] transition-colors placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:bg-wash disabled:text-ink-soft disabled:cursor-not-allowed ${
            error ? "border-danger focus-visible:outline-danger" : "border-line hover:border-ink-soft/40 focus:border-line"
          } ${className}`.trim()}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-ui-xs text-danger">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={hintId} className="text-ui-xs text-ink-soft">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

TextInput.displayName = "TextInput";
