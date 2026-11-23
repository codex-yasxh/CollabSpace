import React from "react";
import { Spinner } from "./Spinner.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  loading?: boolean | undefined;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-sans font-medium transition-colors select-none rounded-control focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:bg-wash disabled:text-ink-soft disabled:cursor-not-allowed cursor-pointer";

    const sizeStyles = {
      sm: "h-control-sm px-2.5 text-ui-xs gap-1.5",
      md: "h-control-md px-3.5 text-ui-sm gap-2",
    }[size];

    const variantStyles = {
      primary:
        "bg-ink text-paper hover:bg-ink/90 active:bg-ink disabled:bg-wash disabled:text-ink-soft disabled:border-transparent",
      secondary:
        "bg-paper text-ink border border-line hover:bg-wash active:bg-line/40 disabled:bg-wash disabled:text-ink-soft disabled:border-line",
      ghost:
        "bg-transparent text-ink hover:bg-wash active:bg-line/30 disabled:bg-transparent disabled:text-ink-soft/40",
      danger:
        "bg-danger text-paper hover:bg-danger/90 active:bg-danger disabled:bg-wash disabled:text-ink-soft disabled:border-transparent",
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`.trim()}
        {...props}
      >
        {loading && <Spinner size="sm" color={variant === "primary" || variant === "danger" ? "paper" : "ink"} />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
