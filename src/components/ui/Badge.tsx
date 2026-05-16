import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'ongoing' | 'upcoming' | 'progress';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "badge",
        {
          "bg-muted text-foreground": variant === "default",
          "badge-success": variant === "success",
          "badge-warning": variant === "warning",
          "badge-danger": variant === "danger",
          "badge-info": variant === "info",
          "pill-ongoing": variant === "ongoing",
          "pill-upcoming": variant === "upcoming",
          "pill-progress": variant === "progress",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
