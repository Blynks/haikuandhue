import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haiku & Hue · Your private daily studio",
  description: "A feeling. Three lines. A little color. A private creative journal.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
