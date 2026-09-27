import { auth } from "@clerk/nextjs/server";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
export default async function OnboardingPage() { if (process.env.AUTH_MODE !== "demo" && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) { const session = await auth(); if (!session.isAuthenticated) return session.redirectToSignIn({ returnBackUrl: "/onboarding" }); } return <OnboardingFlow/>; }
