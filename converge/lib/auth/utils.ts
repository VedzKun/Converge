// ============================================
// AUTHENTICATION UTILITIES
// JWT token handling and password hashing
// ============================================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWTPayload, SafeUser } from "@/types";

// ============================================
// CONSTANTS
// ============================================

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "7d"; // 7 days
const JWT_REFRESH_THRESHOLD = 60 * 60 * 24; // 1 day in seconds

// ============================================
// PASSWORD HASHING
// ============================================

/**
 * Hash a password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with its hash
 * @param password Plain text password
 * @param hash Hashed password
 * @returns True if password matches
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// JWT TOKEN HANDLING
// ============================================

/**
 * Get the JWT secret from environment
 * Throws if not configured
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Generate a JWT token for a user
 * @param user User data to encode
 * @returns JWT token string
 */
export function generateToken(user: SafeUser): string {
  const payload: Omit<JWTPayload, "iat" | "exp"> = {
    userId: user.id,
    email: user.email,
    name: user.name,
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Check if a token needs refresh (within threshold of expiry)
 * @param token JWT token string
 * @returns True if token should be refreshed
 */
export function shouldRefreshToken(token: string): boolean {
  const payload = verifyToken(token);
  if (!payload) return true;

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = payload.exp - now;

  return timeUntilExpiry < JWT_REFRESH_THRESHOLD;
}

/**
 * Refresh a token if valid and close to expiry
 * @param token Current token
 * @param user User data
 * @returns New token or original token
 */
export function refreshTokenIfNeeded(
  token: string,
  user: SafeUser
): { token: string; refreshed: boolean } {
  if (shouldRefreshToken(token)) {
    return { token: generateToken(user), refreshed: true };
  }
  return { token, refreshed: false };
}

/**
 * Extract token from Authorization header
 * @param authHeader Authorization header value
 * @returns Token string or null
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Calculate session expiry date
 * @returns Date when session expires
 */
export function getSessionExpiry(): Date {
  // 7 days from now
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Generate a secure session token
 * @returns Random session token
 */
export function generateSessionToken(): string {
  // Use Web Crypto API for secure random generation
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
