import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // Required for accessibility (blueprint 4.12)
  size?: ("sm" | "md") | undefined;
  variant?: ("ghost" | "secondary") | undefined;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      size = "md",
      variant = "ghost",
      className = "",
      disabled = false,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-sans transition-colors select-none rounded-control focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

    const sizeStyles = {
      sm: "w-control-sm h-control-sm text-ui-xs",
      md: "w-control-md h-control-md text-ui-sm",
    }[size];

    const variantStyles = {
      ghost: "bg-transparent text-ink hover:bg-wash active:bg-line/30",
      secondary: "bg-paper text-ink border border-line hover:bg-wash active:bg-line/40",
    }[variant];

    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
