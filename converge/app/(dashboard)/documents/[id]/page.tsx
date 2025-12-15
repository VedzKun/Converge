// ============================================
// DOCUMENT PAGE
// Real-time collaborative document editor
// ============================================

"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { CollaborativeEditor } from "@/components/editor/collaborative-editor";
import { LoadingOverlay } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";

// ============================================
// TYPES
// ============================================

interface DocumentData {
  id: string;
  title: string;
  version: number;
  userRole: string;
}

// ============================================
// COMPONENT
// ============================================

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, isLoading: authLoading, isAuthenticated } = useAuth();

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================
  // AUTH CHECK
  // ==========================================

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // ==========================================
  // FETCH DOCUMENT
  // ==========================================

  useEffect(() => {
    if (!isAuthenticated || !id) return;

    const fetchDocument = async () => {
      try {
        const response = await fetch(`/api/documents/${id}`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError("Document not found");
          } else if (response.status === 403) {
            setError("You don't have access to this document");
          } else {
            setError("Failed to load document");
          }
          return;
        }

        const data = await response.json();
        setDocument(data.document);
      } catch (err) {
        console.error("Failed to fetch document:", err);
        setError("Failed to load document");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [id, isAuthenticated]);

  // ==========================================
  // LOADING STATE
  // ==========================================

  if (authLoading || isLoading) {
    return <LoadingOverlay message="Loading document..." />;
  }

  if (!isAuthenticated || !user || !token) {
    return null;
  }

  // ==========================================
  // ERROR STATE
  // ==========================================

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">{error}</h1>
          <p className="text-gray-400 mb-4">
            The document you're looking for might have been removed or you don't have permission to access it.
          </p>
          <Button onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Top navigation */}
      <nav className="flex items-center justify-between border-b border-gray-800 px-4 py-2 bg-gray-900/50">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </nav>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CollaborativeEditor
          documentId={id}
          token={token}
          user={{
            id: user.id,
            name: user.name,
            color: user.color,
          }}
          initialTitle={document.title}
          readOnly={document.userRole === "VIEWER"}
        />
      </div>
    </div>
  );
}
