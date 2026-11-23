import React from "react";

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: ("sm" | "md" | "lg") | undefined;
  color?: ("ink" | "paper" | "soft") | undefined;
}

export function Spinner({ size = "md", color = "ink", className = "", ...props }: SpinnerProps) {
  const sizeClass = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  }[size];

  const strokeColor = {
    ink: "stroke-ink",
    paper: "stroke-paper",
    soft: "stroke-ink-soft",
  }[color];

  return (
    <svg
      role="status"
      aria-label="Loading"
      className={`animate-spin ${sizeClass} ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className={strokeColor}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        d="M12 2a10 10 0 0 1 10 10"
      />
    </svg>
  );
}
