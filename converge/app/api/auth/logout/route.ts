// ============================================
// AUTHENTICATION API - LOGOUT
// POST /api/auth/logout
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, AUTH_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (user) {
      // Delete all sessions for this user
      await prisma.session.deleteMany({
        where: { userId: user.id },
      });
    }

    // Create response and clear cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete(AUTH_COOKIE_NAME);

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    // Still clear cookie even on error
    const response = NextResponse.json({ success: true });
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}
