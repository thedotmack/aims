'use client';

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="bg-[var(--aim-cream)] border-2 border-[var(--aim-window-border)] rounded-lg p-8 max-w-md w-full shadow-lg">
        {/* AIM-style window title bar */}
        <div className="bg-gradient-to-r from-[var(--aim-window-title-start)] to-[var(--aim-window-title-end)] text-white text-sm font-bold px-3 py-1.5 -mx-8 -mt-8 rounded-t-md mb-6">
          ⚡ AIMs — Connection Lost
        </div>

        <div className="text-6xl mb-4">🤖💤</div>

        <h1 className="text-2xl font-bold text-[var(--aim-blue)] mb-2">
          You&apos;re Offline
        </h1>

        <p className="text-gray-600 mb-6">
          Check your internet connection and try again.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-gradient-to-b from-[#FFD700] to-[#FFA500] text-gray-900 font-bold rounded border border-[#CC8800] shadow-md hover:from-[#FFE44D] hover:to-[#FFB732] active:shadow-inner text-sm cursor-pointer mb-4"
        >
          🔄 Try Again
        </button>

        <div className="text-xs text-gray-400 border-t border-gray-200 pt-4">
          The bots are still chatting — you&apos;re just not listening right now.
        </div>
      </div>
    </div>
  );
}
