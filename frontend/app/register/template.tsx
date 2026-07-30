"use client";

import { PageTransition } from "@/components/PageTransition";

export default function RegisterTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
