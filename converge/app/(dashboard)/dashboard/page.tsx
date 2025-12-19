// ============================================
// DASHBOARD PAGE
// Main dashboard with document list
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { Spinner, LoadingOverlay } from "@/components/ui/spinner";
import { formatRelativeTime } from "@/lib/utils";
import { Role } from "@prisma/client";
import {
  Plus,
  Search,
  FileText,
  Users,
  MoreVertical,
  Trash2,
  LogOut,
  Settings,
  Crown,
  Edit3,
  Eye,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface DocumentItem {
  id: string;
  title: string;
  ownerId: string;
  version: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  userRole: Role;
  owner: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    color: string;
  };
  collaborators: Array<{
    id: string;
    role: Role;
    user: {
      id: string;
      name: string;
      avatar?: string | null;
      color: string;
    };
  }>;
}

// ============================================
// COMPONENT
// ============================================

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // ==========================================
  // AUTH CHECK
  // ==========================================

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // ==========================================
  // FETCH DOCUMENTS
  // ==========================================

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/documents?search=${encodeURIComponent(searchQuery)}`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated, fetchDocuments]);

  // ==========================================
  // CREATE DOCUMENT
  // ==========================================

  const handleCreateDocument = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Document" }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/documents/${data.document.id}`);
      }
    } catch (error) {
      console.error("Failed to create document:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // ==========================================
  // DELETE DOCUMENT
  // ==========================================

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // ==========================================
  // LOADING STATE
  // ==========================================

  if (authLoading) {
    return <LoadingOverlay message="Loading..." />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // ==========================================
  // RENDER
  // ==========================================

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case Role.OWNER:
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case Role.EDITOR:
        return <Edit3 className="h-3 w-3 text-cyan-500" />;
      case Role.VIEWER:
        return <Eye className="h-3 w-3 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gradient-to-b from-black/30 to-transparent backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-md">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <span className="hidden sm:inline-block text-lg font-semibold text-white">Converge</span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 pr-3 border-r border-gray-800">
                <UserAvatar user={user} size="sm" />
                <span className="text-sm text-gray-300 hidden sm:inline">{user.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Your Documents</h1>
            <p className="text-gray-400 mt-1">
              Create and collaborate on documents in real-time
            </p>
          </div>

          <Button onClick={handleCreateDocument} disabled={isCreating}>
            {isCreating ? (
              <Spinner size="sm" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New Document
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="pl-10"
          />
        </div>

        {/* Documents grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : documents.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No documents yet
              </h3>
              <p className="text-gray-400 mb-4">
                Create your first document to get started
              </p>
              <Button onClick={handleCreateDocument} disabled={isCreating}>
                <Plus className="h-4 w-4" />
                Create Document
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Link key={doc.id} href={`/documents/${doc.id}`}>
                <Card className="group hover:border-cyan-500/50 transition-all cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-cyan-500" />
                        <span className="flex items-center gap-1">
                          {getRoleIcon(doc.userRole)}
                        </span>
                      </div>

                      {doc.userRole === Role.OWNER && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteDocument(doc.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      )}
                    </div>

                    <h3 className="font-medium text-white mb-1 truncate">
                      {doc.title}
                    </h3>

                    <p className="text-sm text-gray-500 mb-3">
                      Updated {formatRelativeTime(doc.updatedAt)}
                    </p>

                    {/* Collaborators */}
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        <UserAvatar
                          user={doc.owner}
                          size="sm"
                          className="ring-2 ring-gray-900"
                        />
                        {doc.collaborators.slice(0, 3).map((collab) => (
                          <UserAvatar
                            key={collab.id}
                            user={collab.user}
                            size="sm"
                            className="ring-2 ring-gray-900"
                          />
                        ))}
                        {doc.collaborators.length > 3 && (
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-800 text-xs text-gray-400 ring-2 ring-gray-900">
                            +{doc.collaborators.length - 3}
                          </div>
                        )}
                      </div>

                      {doc.collaborators.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="h-3 w-3" />
                          {doc.collaborators.length + 1}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
