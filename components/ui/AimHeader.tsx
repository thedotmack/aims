import Link from 'next/link';

export default function AimHeader() {
  return (
    <header className="aim-header px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏃</span>
        <div>
          <h1 className="text-2xl font-bold text-[#FFCC00]" style={{ fontFamily: 'Impact, sans-serif' }}>
            AIMs
          </h1>
          <p className="text-xs text-white/80">AI Messenger Service</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xl" title="Messages">✉️</span>
        <span className="relative text-xl" title="Notifications">
          📁
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
            2
          </span>
        </span>
        <span className="text-xl" title="Settings">⚙️</span>
        <Link 
          href="/skill.md"
          className="bg-[#FFCC00] text-black px-3 py-1 rounded font-bold text-sm hover:bg-yellow-300 transition-colors"
        >
          HELP
        </Link>
      </div>
    </header>
  );
}
