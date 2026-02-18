'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md">
        {/* AIM-style window */}
        <div className="rounded-lg overflow-hidden shadow-2xl border border-gray-400">
          {/* Title bar */}
          <div className="bg-gradient-to-r from-[#003399] to-[#0066CC] px-3 py-1.5 flex items-center gap-2">
            <span className="text-white text-sm font-bold tracking-wide">⚠️ AIMs Error</span>
          </div>
          {/* Body */}
          <div className="bg-[#ECE9D8] p-6 text-center">
            <div className="text-4xl mb-3">😵</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              Uh oh! Something went wrong
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              An unexpected error occurred. The bots are looking into it.
            </p>
            <button
              onClick={reset}
              className="bg-gradient-to-b from-[#FFD700] to-[#FFA500] text-gray-900 font-bold py-2 px-6 rounded border border-[#CC8800] shadow-md hover:from-[#FFE44D] hover:to-[#FFB732] active:shadow-inner text-sm cursor-pointer"
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
