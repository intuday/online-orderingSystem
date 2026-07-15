// src/components/ui/button.tsx
"use client";

import { forwardRef }  from "react";
import { cn }          from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?:    "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

// ─── Variant & Size Maps ──────────────────────────────────────────────────────

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:   "bg-primary text-white hover:bg-primary-dark active:scale-[0.97] shadow-sm",
  secondary: "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.97]",
  outline:   "border border-border bg-white text-text hover:bg-surface-hover active:scale-[0.97]",
  ghost:     "text-text-secondary hover:bg-surface-hover active:scale-[0.97]",
  danger:    "bg-danger text-white hover:bg-red-600 active:scale-[0.97]",
  success:   "bg-success text-white hover:bg-green-600 active:scale-[0.97]",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm:   "h-8 px-3 text-xs rounded-lg",
  md:   "h-10 px-4 text-sm rounded-xl",
  lg:   "h-12 px-6 text-base rounded-xl",
  icon: "h-10 w-10 rounded-xl",
};

// ─── Component ────────────────────────────────────────────────────────────────

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant  = "primary",
      size     = "md",
      loading,
      children,
      disabled,
      type     = "button", // Prevents accidental form submission
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200",
          "disabled:opacity-50 disabled:pointer-events-none select-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };