import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_-4px_rgba(0,0,0,0.65)] hover:bg-primary/90 hover:-translate-y-px",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_-4px_rgba(0,0,0,0.6)] hover:bg-destructive/90",
        outline:
          "border border-white/15 bg-white/[0.03] shadow-sm hover:bg-white/[0.08] hover:border-white/25 hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border border-white/[0.08] shadow-sm hover:bg-secondary/80 hover:border-white/15",
        ghost: "hover:bg-white/[0.08] hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        ivory:
          "bg-primary text-primary-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_8px_24px_-8px_rgba(0,0,0,0.7)] hover:bg-primary/90 hover:-translate-y-px",
        discord:
          "bg-gradient-discord text-foreground font-semibold glow-discord hover:brightness-110 hover:-translate-y-px",
        glass: "glass text-foreground hover:bg-white/10 hover:border-white/25",
        svc: "bg-svc text-background font-semibold glow-svc hover:brightness-110 hover:-translate-y-px",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        xl: "h-12 rounded-xl px-7 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
