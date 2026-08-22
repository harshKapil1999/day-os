import Link from "next/link";
import type { ReactNode } from "react";
export default function AuthLayout({ children }: { children: ReactNode }) { return <main className="auth-page ambient-page"><Link href="/" className="brand auth-brand"><span className="brand-mark">D</span><span>DayOS</span></Link><div className="auth-orbit one"/><div className="auth-orbit two"/>{children}</main>; }
