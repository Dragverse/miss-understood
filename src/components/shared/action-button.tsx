"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";
import { FiLoader } from "react-icons/fi";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ActionButton({
  children,
  icon,
  variant = "primary",
  loading = false,
  size = "md",
  disabled,
  className = "",
  ...props
}: ActionButtonProps) {
  const baseStyles = "rounded-full font-bold transition-all flex items-center justify-center gap-2";

  const sizeStyles = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const variantStyles = {
    primary:
      "bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] text-white shadow-lg shadow-[#EB83EA]/30 hover:shadow-xl hover:shadow-[#EB83EA]/40 hover:scale-[1.02]",
    secondary:
      "bg-[#2f2942] hover:bg-[#3d3450] text-white border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40 shadow-lg hover:shadow-[#EB83EA]/10 hover:scale-[1.02]",
    ghost:
      "bg-transparent hover:bg-[#EB83EA]/10 text-[#EB83EA] hover:text-white border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40",
  };

  const disabledStyles = "opacity-50 cursor-not-allowed hover:scale-100";

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${
        disabled || loading ? disabledStyles : ""
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <FiLoader className="animate-spin" size={20} />
          {children}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
