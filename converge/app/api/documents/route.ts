// ============================================
// DOCUMENTS API - LIST & CREATE
// GET /api/documents - List user's documents
// POST /api/documents - Create new document
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { protectRoute } from "@/lib/auth/session";
import { Role, Document, User, Collaborator } from "@prisma/client";

// Type for the document query result with relations
type DocumentWithRelations = {
  id: string;
  title: string;
  ownerId: string;
  version: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    color: string;
  };
  collaborators: {
    id: string;
    role: Role;
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
      color: string;
    };
  }[];
};

// Validation schema for creating a document
const createDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional().default("Untitled Document"),
});

// ============================================
// GET - List Documents
// ============================================

export async function GET(request: NextRequest) {
  const authResult = await protectRoute(request);
  if ("error" in authResult) return authResult.error;

  const { user } = authResult;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";

    // Build where clause
    const whereClause = {
      OR: [
        // Documents owned by user
        { ownerId: user.id },
        // Documents where user is a collaborator
        {
          collaborators: {
            some: { userId: user.id },
          },
        },
      ],
      ...(search && {
        title: {
          contains: search,
          mode: "insensitive" as const,
        },
      }),
    };

    // Get total count
    const total = await prisma.document.count({ where: whereClause });

    // Get documents with pagination
    const documents = await prisma.document.findMany({
      where: whereClause,
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
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Add user's role to each document
    const documentsWithRole = documents.map((doc: DocumentWithRelations) => {
      let role: Role = Role.VIEWER;

      if (doc.ownerId === user.id) {
        role = Role.OWNER;
      } else {
        const collaboration = doc.collaborators.find(
          (c: { user: { id: string } }) => c.user.id === user.id
        );
        if (collaboration) {
          role = collaboration.role;
        }
      }

      return {
        ...doc,
        userRole: role,
      };
    });

    return NextResponse.json({
      documents: documentsWithRole,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total,
      },
    });
  } catch (error) {
    console.error("List documents error:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create Document
// ============================================

export async function POST(request: NextRequest) {
  const authResult = await protectRoute(request);
  if ("error" in authResult) return authResult.error;

  const { user } = authResult;

  try {
    const body = await request.json();

    // Validate input
    const result = createDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title } = result.data;

    // Create document
    const document = await prisma.document.create({
      data: {
        title,
        ownerId: user.id,
      },
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
      },
    });

    return NextResponse.json(
      {
        document: {
          ...document,
          userRole: Role.OWNER,
          collaborators: [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create document error:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}
