import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";
import "./apple-glass.css";

export async function generateMetadata(): Promise<Metadata> {
  const values = await headers();
  const host = values.get("x-forwarded-host") ?? values.get("host") ?? "localhost:3000";
  const protocol = values.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "DayOS — Own your day";
  const description = "A calm, adaptive personal operating system for your day.";
  return { metadataBase: new URL(origin), title: { default: title, template: "%s · DayOS" }, description, openGraph: { title, description, type: "website", siteName: "DayOS", images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "DayOS — Own your day" }] }, twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] } };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f5f7" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }] };

export default function RootLayout({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; const clerk = Boolean(publishableKey) && process.env.AUTH_MODE !== "demo"; const content = <Providers clerk={clerk}>{children}</Providers>;
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth"><body>{clerk ? <ClerkProvider publishableKey={publishableKey!}>{content}</ClerkProvider> : content}</body></html>;
}
