'use client';

export default function AnalyticsExportButton({ data, username }: { data: Record<string, unknown>; username: string }) {
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aims-analytics-${username}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors"
    >
      📥 Export JSON
    </button>
  );
}
