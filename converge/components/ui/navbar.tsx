import Link from "next/link";
import Logo from "./logo";

export default function Navbar() {
  return (
    <nav className="relative z-20 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo at the left corner */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shadow-lg">
                <Logo className="w-8 h-8" />
              </div>
              <span className="hidden sm:inline-block text-lg font-semibold text-white">
                Converge
              </span>
            </Link>
          </div>

          {/* Center links (hidden on small screens) */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="#docs" className="text-gray-300 hover:text-white transition-colors">
              Docs
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-all shadow-md"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
