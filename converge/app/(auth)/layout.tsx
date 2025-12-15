// ============================================
// AUTH LAYOUT
// Layout for authentication pages
// ============================================

import { AuthProvider } from "@/components/providers/auth-provider";
import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
