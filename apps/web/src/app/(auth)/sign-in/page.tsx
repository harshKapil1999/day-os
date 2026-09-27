import { AuthCard } from "@/components/auth/auth-card";
export default function SignInPage() { return <AuthCard mode="sign-in" clerk={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && process.env.AUTH_MODE !== "demo"}/>; }
