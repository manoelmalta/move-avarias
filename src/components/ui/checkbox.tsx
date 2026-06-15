"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Checkbox({ className, checked, onCheckedChange, ...props }: CheckboxProps) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onCheckedChange?.(!checked)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onCheckedChange?.(!checked);
        }
      }}
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input bg-background cursor-pointer transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked && "bg-primary border-primary",
        className
      )}
      {...(props as React.HTMLAttributes<HTMLSpanElement>)}
    >
      {checked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
    </span>
  );
}

export { Checkbox };
