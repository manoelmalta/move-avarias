import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border border-slate-200 bg-slate-100 text-slate-700",
        destructive: "border border-red-200 bg-red-100 text-red-700",
        outline: "text-foreground border-border",
        success: "border border-green-200 bg-green-100 text-green-800",
        warning: "border border-amber-200 bg-amber-100 text-amber-800",
        info: "border border-blue-200 bg-blue-100 text-blue-800",
        purple: "border border-purple-200 bg-purple-100 text-purple-800",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
