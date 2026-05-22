import React from "react";
import { cn } from "@/lib/utils";

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function OnlineIndicator({
  isOnline,
  size = "lg",
  className,
}: OnlineIndicatorProps) {
  if (!isOnline) return null;

  const sizeClasses = {
    sm: "h-1 w-2",
    md: "h-2 w-3",
    lg: "h-3 w-4",
  };

  return (
    <span
      className={cn("relative flex shrink-0", sizeClasses[size], className)}
      title="Online"
    >
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span
        className={cn(
          "relative inline-flex rounded-full bg-green-500 border border-white dark:border-zinc-950",
          sizeClasses[size]
        )}
      ></span>
    </span>
  );
}
