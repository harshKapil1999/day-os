import { AuthCard } from "@/components/auth/auth-card";
export default function SignUpPage() { return <AuthCard mode="sign-up" clerk={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)}/>; }
