import React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className = "", ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={`fixed bottom-4 right-4 z-50 flex max-h-screen w-full max-w-[360px] flex-col gap-2 p-4 outline-none ${className}`.trim()}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

export const Toast = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & { variant?: "default" | "danger" }
>(({ className = "", variant = "default", children, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={`relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-[10px] border p-3.5 shadow-layer animate-layer-in ${
      variant === "danger"
        ? "border-danger/30 bg-paper text-danger"
        : "border-line bg-paper text-ink"
    } ${className}`.trim()}
    {...props}
  >
    <div className="flex flex-col gap-1 flex-1">{children}</div>
    <ToastPrimitive.Close
      aria-label="Close notification"
      className="shrink-0 rounded-[4px] p-0.5 text-ink-soft hover:bg-wash focus-visible:outline-2 focus-visible:outline-focus cursor-pointer"
    >
      <X className="w-3.5 h-3.5" />
    </ToastPrimitive.Close>
  </ToastPrimitive.Root>
));
Toast.displayName = ToastPrimitive.Root.displayName;

export const ToastTitle = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className = "", ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={`text-ui-sm font-medium leading-none ${className}`.trim()}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className = "", ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={`text-ui-xs text-ink-soft mt-1 leading-normal ${className}`.trim()}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;
