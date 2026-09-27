"use client";
import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/glass/glass";

export function AuthCard({ mode, clerk }: { mode: "sign-in" | "sign-up"; clerk: boolean }) {
  if (clerk) return <div className="clerk-wrap">{mode === "sign-in" ? <SignIn routing="hash" forceRedirectUrl="/auth/continue" signUpForceRedirectUrl="/auth/continue"/> : <SignUp routing="hash" forceRedirectUrl="/auth/continue"/>}</div>;
  const signup = mode === "sign-up";
  return <GlassCard className="auth-card"><span className="overline">{signup ? "CREATE YOUR SPACE" : "WELCOME BACK"}</span><h1>{signup ? "Start with today." : "Return to your day."}</h1><p>{signup ? "A few calm questions, then DayOS will shape your first balanced plan." : "Your plan is waiting, ready to adapt."}</p><label>Email<input type="email" defaultValue="alex@example.com" aria-label="Email"/></label><label>Password<input type="password" defaultValue="dayos-demo" aria-label="Password"/></label><Link className="button button-primary button-lg full" href={signup ? "/onboarding" : "/app/today"}>{signup ? "Continue" : "Sign in"}<ArrowRight size={17}/></Link><small>Demo mode is active until Clerk keys are configured.</small><div className="auth-switch">{signup ? "Already have a space?" : "New to DayOS?"} <Link href={signup ? "/sign-in" : "/sign-up"}>{signup ? "Sign in" : "Create one"}</Link></div></GlassCard>;
}
