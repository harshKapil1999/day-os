import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const styles = cva("button", { variants: { variant: { primary: "button-primary", secondary: "button-secondary", ghost: "button-ghost", danger: "button-danger" }, size: { sm: "button-sm", md: "button-md", lg: "button-lg", icon: "button-icon" } }, defaultVariants: { variant: "primary", size: "md" } });
export function Button({ className, variant, size, asChild, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof styles> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button"; return <Component className={cn(styles({ variant, size }), className)} {...props} />;
}
