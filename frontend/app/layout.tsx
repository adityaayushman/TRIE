import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import { AmbientBackground } from "@/components/AmbientBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Road Guardian AI X",
  description:
    "Explainable transportation risk intelligence for Indian roads. Predict. Explain. Prevent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* one persistent animated backdrop behind every page */}
        <AmbientBackground />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
