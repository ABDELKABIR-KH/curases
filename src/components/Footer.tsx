import { Sparkles, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full border-t border-zinc-900 bg-zinc-950 py-12 text-zinc-500 text-xs">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-zinc-300">Curases</span>
          <span className="text-zinc-600">·</span>
          <span>The Agentic Custom Cursor Engine for the Web</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="/llms.txt" target="_blank" className="hover:text-zinc-300 transition-colors inline-flex items-center gap-1">
            llms.txt <ExternalLink className="w-3 h-3" />
          </a>
          <a href="/llms-full.txt" target="_blank" className="hover:text-zinc-300 transition-colors inline-flex items-center gap-1">
            llms-full.txt <ExternalLink className="w-3 h-3" />
          </a>
          <a href="/api/registry" target="_blank" className="hover:text-zinc-300 transition-colors inline-flex items-center gap-1">
            Registry API <ExternalLink className="w-3 h-3" />
          </a>
          <a href="/engine.js" target="_blank" className="hover:text-zinc-300 transition-colors inline-flex items-center gap-1">
            CDN Engine Script <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="text-zinc-600">
          Hosted on Vercel · Curases.com
        </div>
      </div>
    </footer>
  );
}
