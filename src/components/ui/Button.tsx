// ================================================================
// <Button /> — Nút bấm chuẩn với variants & loading state
// ================================================================

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      icon,
      children,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "btn--sm",
      md: "btn--md",
      lg: "btn--lg",
    };

    const variantClasses = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      danger: "btn-danger",
      outline: "btn-outline",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        style={style}
        {...props}
      >
        {loading ? (
          <Loader2 size={16} className="spinner" aria-hidden="true" />
        ) : (
          icon && <span className="btn-icon" aria-hidden="true">{icon}</span>
        )}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
