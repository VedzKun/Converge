// ============================================
// AUTHENTICATION API - LOGIN
// POST /api/auth/login
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Session } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  comparePassword,
  generateToken,
  getSessionExpiry,
  generateSessionToken,
} from "@/lib/auth/utils";
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth/session";

// Validation schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await comparePassword(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create safe user object (without password)
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      color: user.color,
    };

    // Generate JWT token
    const token = generateToken(safeUser);

    // Create session in database
    const sessionToken = generateSessionToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt: getSessionExpiry(),
      },
    });

    // Clean up old sessions (keep only last 5)
    const userSessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: 5,
    });

    if (userSessions.length > 0) {
      await prisma.session.deleteMany({
        where: {
          id: { in: userSessions.map((s: Session) => s.id) },
        },
      });
    }

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: safeUser,
      token,
    });

    // Set auth cookie
    response.cookies.set(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
