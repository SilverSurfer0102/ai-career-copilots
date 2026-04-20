import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Crimson_Pro } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NavBar } from "@/components/nav-bar";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const crimsonPro = Crimson_Pro({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "AI Career Copilot",
  description: "Evidence-grounded resume and cover letter generation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${crimsonPro.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <NavBar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">{children}</main>
        <Toaster richColors />
      </body>
    </html>
  );
}
