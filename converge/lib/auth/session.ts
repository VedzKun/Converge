// ============================================
// AUTHENTICATION MIDDLEWARE & HELPERS
// Server-side auth utilities for API routes
// ============================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken, extractBearerToken } from "./utils";
import { SafeUser } from "@/types";
import { Role } from "@prisma/client";
import { cookies } from "next/headers";

// ============================================
// COOKIE CONFIGURATION
// ============================================

export const AUTH_COOKIE_NAME = "converge_auth_token";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

// ============================================
// GET CURRENT USER
// ============================================

/**
 * Get the current authenticated user from request
 * Checks both cookie and Authorization header
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<SafeUser | null> {
  // First try Authorization header
  let token = extractBearerToken(request.headers.get("authorization"));

  // Fall back to cookie
  if (!token) {
    token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
  }

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  // Verify user still exists in database
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      color: true,
    },
  });

  return user;
}

/**
 * Get the current user from server component context
 * Uses Next.js cookies() function
 */
export async function getServerUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      color: true,
    },
  });

  return user;
}

// ============================================
// DOCUMENT ACCESS CONTROL
// ============================================

/**
 * Check if a user has access to a document
 * Returns the user's role if they have access, null otherwise
 */
export async function checkDocumentAccess(
  userId: string,
  documentId: string
): Promise<{ hasAccess: boolean; role: Role | null }> {
  // First check if user is the owner
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      ownerId: true,
      isPublic: true,
    },
  });

  if (!document) {
    return { hasAccess: false, role: null };
  }

  // Owner has full access
  if (document.ownerId === userId) {
    return { hasAccess: true, role: Role.OWNER };
  }

  // Check collaborator status
  const collaborator = await prisma.collaborator.findUnique({
    where: {
      userId_documentId: {
        userId,
        documentId,
      },
    },
    select: {
      role: true,
    },
  });

  if (collaborator) {
    return { hasAccess: true, role: collaborator.role };
  }

  // Check if document is public
  if (document.isPublic) {
    return { hasAccess: true, role: Role.VIEWER };
  }

  return { hasAccess: false, role: null };
}

/**
 * Require a specific minimum role for document access
 */
export async function requireDocumentRole(
  userId: string,
  documentId: string,
  minRole: Role
): Promise<{
  allowed: boolean;
  role: Role | null;
  error?: string;
}> {
  const { hasAccess, role } = await checkDocumentAccess(userId, documentId);

  if (!hasAccess) {
    return { allowed: false, role: null, error: "Document not found" };
  }

  const roleHierarchy: Record<Role, number> = {
    VIEWER: 1,
    EDITOR: 2,
    OWNER: 3,
  };

  const userLevel = role ? roleHierarchy[role] : 0;
  const requiredLevel = roleHierarchy[minRole];

  if (userLevel < requiredLevel) {
    return { allowed: false, role, error: "Insufficient permissions" };
  }

  return { allowed: true, role };
}

// ============================================
// API ROUTE PROTECTION
// ============================================

/**
 * Protect an API route - returns error response or user
 */
export async function protectRoute(
  request: NextRequest
): Promise<{ user: SafeUser } | { error: Response }> {
  const user = await getCurrentUser(request);

  if (!user) {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { user };
}

/**
 * Protect a route and check document access
 */
export async function protectDocumentRoute(
  request: NextRequest,
  documentId: string,
  minRole: Role = Role.VIEWER
): Promise<
  { user: SafeUser; role: Role } | { error: Response }
> {
  const authResult = await protectRoute(request);
  if ("error" in authResult) {
    return authResult;
  }

  const { user } = authResult;
  const accessResult = await requireDocumentRole(user.id, documentId, minRole);

  if (!accessResult.allowed || !accessResult.role) {
    return {
      error: new Response(
        JSON.stringify({ error: accessResult.error || "Access denied" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  return { user, role: accessResult.role };
}
