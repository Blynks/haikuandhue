import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { isAuthenticated } from "@/lib/auth";
import { signOutAction } from "@/lib/studio";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-cormorant" });

export const metadata: Metadata = {
  title: "Haiku & Hue",
  description: "A feeling. Three lines. A little color."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authed = await isAuthenticated();
  return (
    <html lang="en">
      <body className={`${geist.variable} ${cormorant.variable}`}>
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
          <header className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/60 bg-white/35 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
            <Link href="/" className="group">
              <p className="text-sm uppercase tracking-[0.34em] text-[#8b6f5c]">Haiku & Hue</p>
              <h1 className="font-[var(--font-cormorant)] text-3xl font-semibold">A feeling. Three lines. A little color.</h1>
            </Link>
            <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#4d4038]" aria-label="Main navigation">
              {[ ["Today", "/"], ["Review", "/review"], ["Almanac", "/almanac"], ["Settings", "/settings"] ].map(([label, href]) => (
                <Link key={href} href={href} className="rounded-full bg-white/55 px-4 py-2 transition hover:bg-white">{label}</Link>
              ))}
              {authed ? <form action={signOutAction}><button className="rounded-full border border-[#bda58d] px-4 py-2">Sign out</button></form> : null}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
