// ============================================
// DASHBOARD LAYOUT
// Protected layout for authenticated pages
// ============================================

import { AuthProvider } from "@/components/providers/auth-provider";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
