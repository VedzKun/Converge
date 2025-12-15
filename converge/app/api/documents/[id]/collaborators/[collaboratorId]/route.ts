// ============================================
// SINGLE COLLABORATOR API
// PATCH /api/documents/[id]/collaborators/[collaboratorId] - Update role
// DELETE /api/documents/[id]/collaborators/[collaboratorId] - Remove collaborator
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { protectDocumentRoute, getCurrentUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";

// Validation schema for updating role
const updateRoleSchema = z.object({
  role: z.enum(["EDITOR", "VIEWER"]),
});

// ============================================
// PATCH - Update Collaborator Role
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const { id, collaboratorId } = await params;

  // Only OWNER can update roles
  const authResult = await protectDocumentRoute(request, id, Role.OWNER);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();

    // Validate input
    const result = updateRoleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { role } = result.data;

    // Update collaborator
    const collaborator = await prisma.collaborator.update({
      where: { id: collaboratorId },
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

    return NextResponse.json({ collaborator });
  } catch (error) {
    console.error("Update collaborator error:", error);
    return NextResponse.json(
      { error: "Failed to update collaborator" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove Collaborator
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const { id, collaboratorId } = await params;

  // Get current user
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the collaborator to check permissions
  const collaborator = await prisma.collaborator.findUnique({
    where: { id: collaboratorId },
    select: { userId: true, documentId: true },
  });

  if (!collaborator || collaborator.documentId !== id) {
    return NextResponse.json(
      { error: "Collaborator not found" },
      { status: 404 }
    );
  }

  // Allow if:
  // 1. User is the document owner, OR
  // 2. User is removing themselves
  const document = await prisma.document.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  const isOwner = document?.ownerId === currentUser.id;
  const isRemovingSelf = collaborator.userId === currentUser.id;

  if (!isOwner && !isRemovingSelf) {
    return NextResponse.json(
      { error: "Only the owner can remove other collaborators" },
      { status: 403 }
    );
  }

  try {
    await prisma.collaborator.delete({
      where: { id: collaboratorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove collaborator error:", error);
    return NextResponse.json(
      { error: "Failed to remove collaborator" },
      { status: 500 }
    );
  }
}
