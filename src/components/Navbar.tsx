import { Sparkles, Terminal, ExternalLink } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-zinc-100 group-hover:text-blue-400 transition-colors">
              Curases
            </span>
            <span className="ml-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              v1.0
            </span>
          </div>
        </a>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
          <a href="#playground" className="hover:text-zinc-200 transition-colors">
            Playground
          </a>
          <a href="#catalog" className="hover:text-zinc-200 transition-colors">
            Cursor Registry
          </a>
          <a href="#docs" className="hover:text-zinc-200 transition-colors">
            Integration Guide
          </a>
          <a
            href="/llms.txt"
            target="_blank"
            className="flex items-center gap-1 hover:text-blue-400 transition-colors"
          >
            <span>llms.txt</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a
            href="#playground"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-md shadow-blue-600/25"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Try in Playground</span>
          </a>
        </div>
      </div>
    </header>
  );
}
