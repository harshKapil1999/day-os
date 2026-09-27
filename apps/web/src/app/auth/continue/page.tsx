"use client";

import { LoaderCircle } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDayOS } from "@/components/providers";

export default function AuthContinuePage() {
  const router = useRouter(); const { isLoaded, isSignedIn } = useAuth(); const { profile, loading, error, refresh } = useDayOS();
  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
    else if (profile) router.replace(profile.onboardingCompleted ? "/app/today" : "/onboarding");
  }, [isLoaded, isSignedIn, profile, router]);
  return <main className="auth-continue ambient-page"><div className="glass glass-depth-3"><LoaderCircle className="spin"/><span className="overline">PREPARING YOUR SPACE</span><h1>{error?"We couldn’t open your DayOS.":"Finding your rhythm…"}</h1><p>{error?error:"Your account and saved preferences are being securely loaded."}</p>{error&&<button className="button button-primary" onClick={()=>void refresh()}>Try again</button>}{loading&&<span className="sr-only">Loading</span>}</div></main>;
}
