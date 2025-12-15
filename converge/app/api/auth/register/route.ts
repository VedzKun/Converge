// ============================================
// AUTHENTICATION API - REGISTER
// POST /api/auth/register
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  hashPassword,
  generateToken,
  getSessionExpiry,
  generateSessionToken,
} from "@/lib/auth/utils";
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth/session";
import { generateUserColor } from "@/lib/utils";

// Validation schema
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = result.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with a random cursor color
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        color: generateUserColor(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        color: true,
      },
    });

    // Generate JWT token
    const token = generateToken(user);

    // Create session in database
    const sessionToken = generateSessionToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt: getSessionExpiry(),
      },
    });

    // Create response with cookie
    const response = NextResponse.json(
      {
        success: true,
        user,
        token,
      },
      { status: 201 }
    );

    // Set auth cookie
    response.cookies.set(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
