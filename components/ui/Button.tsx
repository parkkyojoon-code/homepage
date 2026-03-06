"use client"

import { ButtonHTMLAttributes, forwardRef } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline"
  size?: "sm" | "md" | "lg"
  animate?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", animate = true, children, ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-white hover:bg-primary-dark",
      secondary: "bg-secondary text-white hover:bg-secondary/90",
      outline: "border-2 border-primary text-primary hover:bg-primary hover:text-white",
    }

    const sizes = {
      sm: "px-6 py-2 text-sm",
      md: "px-8 py-4 text-base",
      lg: "px-10 py-5 text-lg",
    }

    const Component = animate ? motion.button : "button"

    return (
      // @ts-expect-error - React 19 and framer-motion type mismatch
      <Component
        ref={ref}
        className={cn(
          "rounded-lg font-semibold transition-all duration-300",
          variants[variant],
          sizes[size],
          animate && "hover:scale-105 hover:shadow-xl",
          className
        )}
        whileHover={animate ? { scale: 1.05 } : undefined}
        whileTap={animate ? { scale: 0.95 } : undefined}
        {...props}
      >
        {children}
      </Component>
    )
  }
)

Button.displayName = "Button"

export default Button