// ============================================
// COLLABORATORS API
// GET /api/documents/[id]/collaborators - List collaborators
// POST /api/documents/[id]/collaborators - Add collaborator
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { protectDocumentRoute } from "@/lib/auth/session";
import { Role } from "@prisma/client";

// Validation schema for adding a collaborator
const addCollaboratorSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["EDITOR", "VIEWER"]).default("VIEWER"),
});

// ============================================
// GET - List Collaborators
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await protectDocumentRoute(request, id);
  if ("error" in authResult) return authResult.error;

  try {
    const collaborators = await prisma.collaborator.findMany({
      where: { documentId: id },
      select: {
        id: true,
        role: true,
        invitedAt: true,
        acceptedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            color: true,
          },
        },
      },
      orderBy: { invitedAt: "desc" },
    });

    // Also get the owner
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json({
      owner: document?.owner,
      collaborators,
    });
  } catch (error) {
    console.error("List collaborators error:", error);
    return NextResponse.json(
      { error: "Failed to list collaborators" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Add Collaborator
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Only OWNER can add collaborators
  const authResult = await protectDocumentRoute(request, id, Role.OWNER);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();

    // Validate input
    const result = addCollaboratorSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, role } = result.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        color: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found with this email" },
        { status: 404 }
      );
    }

    // Check if user is the owner
    const document = await prisma.document.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (document?.ownerId === user.id) {
      return NextResponse.json(
        { error: "Cannot add the document owner as a collaborator" },
        { status: 400 }
      );
    }

    // Check if already a collaborator
    const existingCollaborator = await prisma.collaborator.findUnique({
      where: {
        userId_documentId: {
          userId: user.id,
          documentId: id,
        },
      },
    });

    if (existingCollaborator) {
      // Update role instead
      const updated = await prisma.collaborator.update({
        where: { id: existingCollaborator.id },
        data: { role: role as Role },
        select: {
          id: true,
          role: true,
          invitedAt: true,
          acceptedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              color: true,
            },
          },
        },
      });

      return NextResponse.json({ collaborator: updated });
    }

    // Create new collaborator
    const collaborator = await prisma.collaborator.create({
      data: {
        userId: user.id,
        documentId: id,
        role: role as Role,
      },
      select: {
        id: true,
        role: true,
        invitedAt: true,
        acceptedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json({ collaborator }, { status: 201 });
  } catch (error) {
    console.error("Add collaborator error:", error);
    return NextResponse.json(
      { error: "Failed to add collaborator" },
      { status: 500 }
    );
  }
}
