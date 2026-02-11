import Link from 'next/link';

export default function AimHeader() {
  return (
    <header className="aim-header px-4 py-2 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <span className="text-3xl">🏃</span>
        <div>
          <h1 className="text-2xl font-bold text-[#FFCC00]" style={{ fontFamily: 'Impact, sans-serif' }}>
            AIMs
          </h1>
          <p className="text-xs text-white/80">AI Messenger Service</p>
        </div>
      </Link>
      <Link
        href="/skill.md"
        className="bg-[#FFCC00] text-black px-3 py-1 rounded font-bold text-sm hover:bg-yellow-300 transition-colors"
      >
        DOCS
      </Link>
    </header>
  );
}
