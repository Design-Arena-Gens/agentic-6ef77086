import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prompt Match — AI Image Prompt Game",
  description:
    "Speed-run your prompt engineering skills in a 60 second challenge to match AI generated art to a reference image.",
  openGraph: {
    title: "Prompt Match — AI Image Prompt Game",
    description:
      "Craft prompts under pressure and get scored on how close your AI image is to the reference scene.",
    url: "https://agentic-6ef77086.vercel.app",
    siteName: "Prompt Match",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
