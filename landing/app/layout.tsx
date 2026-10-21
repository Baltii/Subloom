import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./features.css";
import "./theme.css";
import { themeBootstrap } from "../components/theme-init";

const manrope = localFont({ src: "../public/fonts/manrope-bold.ttf", variable: "--font-display", weight: "700", display: "swap" });
const dmSans = localFont({ src: [
  { path: "../public/fonts/dm-sans-regular.ttf", weight: "400" },
  { path: "../public/fonts/dm-sans-semibold.ttf", weight: "600" },
], variable: "--font-body", display: "swap" });

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(productionHost ? `https://${productionHost}` : "http://localhost:3000"),
  alternates: { canonical: "/" },
  title: "Subloom — Subscriptions, in a calmer place",
  description: "Spot forgotten subscriptions, review recurring charges, and see renewals coming. Subloom helps you decide what is still worth paying for.",
  openGraph: { title: "Subloom — Subscriptions, in a calmer place", description: "Your subscriptions. A clearer picture. A little more peace of mind.", type: "website", images: [{ url: "/social.png", width: 1200, height: 630, alt: "Subloom — Less money admin. More peace of mind. A green wallet and gold coins." }, { url: "/social-dark.png", width: 1200, height: 630, alt: "Subloom social preview in forest and mint." }] },
  twitter: { card: "summary_large_image", images: [{ url: "/social.png", alt: "Subloom — Less money admin. More peace of mind." }] },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F4F5ED" }, { media: "(prefers-color-scheme: dark)", color: "#101A16" }], colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${dmSans.variable}`}><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }}/></head><body>{children}</body></html>;
}
