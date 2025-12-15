// ============================================
// SINGLE DOCUMENT API
// GET /api/documents/[id] - Get document
// PATCH /api/documents/[id] - Update document
// DELETE /api/documents/[id] - Delete document
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { protectDocumentRoute } from "@/lib/auth/session";
import { Role } from "@prisma/client";

// Validation schema for updating a document
const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  isPublic: z.boolean().optional(),
});

// ============================================
// GET - Get Single Document
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await protectDocumentRoute(request, id);
  if ("error" in authResult) return authResult.error;

  const { role } = authResult;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        ownerId: true,
        version: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            color: true,
          },
        },
        collaborators: {
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
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      document: {
        ...document,
        userRole: role,
      },
    });
  } catch (error) {
    console.error("Get document error:", error);
    return NextResponse.json(
      { error: "Failed to get document" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update Document
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Require EDITOR role to update
  const authResult = await protectDocumentRoute(request, id, Role.EDITOR);
  if ("error" in authResult) return authResult.error;

  const { role } = authResult;

  try {
    const body = await request.json();

    // Validate input
    const result = updateDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title, isPublic } = result.data;

    // Only owner can change public status
    if (isPublic !== undefined && role !== Role.OWNER) {
      return NextResponse.json(
        { error: "Only the document owner can change visibility" },
        { status: 403 }
      );
    }

    // Update document
    const document = await prisma.document.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(isPublic !== undefined && { isPublic }),
      },
      select: {
        id: true,
        title: true,
        ownerId: true,
        version: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Update document error:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete Document
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Require OWNER role to delete
  const authResult = await protectDocumentRoute(request, id, Role.OWNER);
  if ("error" in authResult) return authResult.error;

  try {
    // Delete document (cascades to collaborators, operations, snapshots)
    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
