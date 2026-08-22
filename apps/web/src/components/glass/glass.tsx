import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function GlassSurface({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("glass glass-depth-1", className)} {...props} />; }
export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("glass glass-depth-2 glass-card", className)} {...props} />; }
export function GlassPill({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("glass glass-depth-3 glass-pill", className)} {...props} />; }
