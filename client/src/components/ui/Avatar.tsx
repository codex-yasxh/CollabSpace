import React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { getPresenceColor, type PresenceColor } from "../../lib/presence.js";

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  name: string;
  userId?: string | undefined;
  presenceColor?: PresenceColor | undefined;
  isCurrentUser?: boolean | undefined;
  size?: ("sm" | "md") | undefined;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(
  (
    {
      name,
      userId,
      presenceColor,
      isCurrentUser = false,
      size = "md",
      className = "",
      ...props
    },
    ref,
  ) => {
    // Resolve presence color deterministically if not explicitly provided
    const resolvedColor = presenceColor
      ? presenceColor
      : userId
        ? getPresenceColor(userId).name
        : getPresenceColor(name).name;

    const bgClass = {
      coral: "bg-coral",
      ochre: "bg-ochre",
      moss: "bg-moss",
      teal: "bg-teal",
      cobalt: "bg-cobalt",
      violet: "bg-violet",
      magenta: "bg-magenta",
    }[resolvedColor];

    const sizeClass = size === "sm" ? "w-avatar-sm h-avatar-sm text-avatar-sm" : "w-avatar-md h-avatar-md text-avatar-md";
    const ringClass = isCurrentUser ? "ring-2 ring-ink" : "ring-2 ring-fog";

    return (
      <AvatarPrimitive.Root
        ref={ref}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full select-none ${sizeClass} ${ringClass} ${bgClass} text-paper font-medium ${className}`.trim()}
        {...props}
      >
        <AvatarPrimitive.Fallback className="flex items-center justify-center w-full h-full leading-none">
          {getInitials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
    );
  },
);

Avatar.displayName = "Avatar";
