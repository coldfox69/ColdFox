import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-[1.07] hover:-translate-y-px active:shadow-[var(--shadow-inset-sm)] active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-105 hover:-translate-y-px focus-visible:ring-destructive/20 active:shadow-[var(--shadow-inset-sm)]",
        outline:
          "bg-card text-foreground shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised)] hover:-translate-y-px active:shadow-[var(--shadow-inset-sm)] active:translate-y-0",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-[1.03] hover:-translate-y-px active:shadow-[var(--shadow-inset-sm)]",
        ghost:
          "text-foreground hover:bg-muted active:bg-muted active:shadow-[var(--shadow-inset-sm)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-[12px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[8px] px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-[10px] px-5 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
