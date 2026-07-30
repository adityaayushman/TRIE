"use client";

import { PageTransition } from "@/components/PageTransition";

export default function LoginTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
