import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/app-shell";
export default async function ApplicationLayout({ children }: { children: ReactNode }) { if (process.env.AUTH_MODE !== "demo" && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) { const session = await auth(); if (!session.isAuthenticated) return session.redirectToSignIn(); } return <AppShell>{children}</AppShell>; }
