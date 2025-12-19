// ============================================
// LANDING PAGE
// Main entry point with hero section
// ============================================

import Link from "next/link";
import { FileText, Users, Zap, Shield, ArrowRight } from "lucide-react";
import Navbar from "@/components/ui/navbar";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 grid-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      {/* Use reusable Navbar component for consistent styling */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <header className="relative z-10 border-b border-gray-800/40 bg-gradient-to-b from-black/30 to-transparent backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Navbar />
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-8">
            <Zap className="w-4 h-4" />
            Real-time collaboration powered by CRDT
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Collaborate in{" "}
            <span className="gradient-text">Real-Time</span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            A scalable collaboration platform where teams can edit documents
            simultaneously with instant sync, conflict-free editing, and
            enterprise-grade security.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-lg hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/25"
            >
              Start Collaborating
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-gray-700 text-white font-semibold text-lg hover:bg-gray-800 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Built for Teams That Move Fast
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Powered by cutting-edge distributed systems technology
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-cyan-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-cyan-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Instant Sync
              </h3>
              <p className="text-gray-400">
                Changes propagate in milliseconds using WebSockets and CRDT
                technology. No lag, no conflicts.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-cyan-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Live Presence
              </h3>
              <p className="text-gray-400">
                See who&apos;s online, where they&apos;re editing, and what they&apos;re
                typing in real-time.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-cyan-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Role-Based Access
              </h3>
              <p className="text-gray-400">
                Fine-grained permissions with Owner, Editor, and Viewer roles.
                Control who can see and edit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="relative z-10 py-20 px-4 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-8">
            Powered by Modern Technology
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              "Next.js",
              "TypeScript",
              "Socket.IO",
              "Yjs CRDT",
              "PostgreSQL",
              "Prisma",
              "Redis",
            ].map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700 text-gray-300 text-sm"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>&copy; 2025 Converge. Built with ❤️ for real-time collaboration.</p>
        </div>
      </footer>
    </div>
  );
}
