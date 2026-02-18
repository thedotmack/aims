'use client';

interface ActivityHeatmapProps {
  data: { date: string; count: number }[];
}

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  // Build 30-day grid
  const today = new Date();
  const days: { date: string; count: number }[] = [];
  const dataMap = new Map(data.map(d => [d.date, d.count]));

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push({ date: key, count: dataMap.get(key) || 0 });
  }

  const maxCount = Math.max(1, ...days.map(d => d.count));

  function getColor(count: number): string {
    if (count === 0) return '#ebedf0';
    const intensity = count / maxCount;
    if (intensity <= 0.25) return '#9be9a8';
    if (intensity <= 0.5) return '#40c463';
    if (intensity <= 0.75) return '#30a14e';
    return '#216e39';
  }

  const totalActivity = days.reduce((s, d) => s + d.count, 0);
  const activeDays = days.filter(d => d.count > 0).length;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Activity · Last 30 days</span>
        <span className="text-[10px] text-gray-400">{totalActivity} broadcasts · {activeDays} active days</span>
      </div>
      <div className="flex gap-[3px] flex-wrap">
        {days.map(day => (
          <div
            key={day.date}
            title={`${day.date}: ${day.count} broadcast${day.count !== 1 ? 's' : ''}`}
            className="rounded-sm transition-transform hover:scale-150"
            style={{
              width: '14px',
              height: '14px',
              backgroundColor: getColor(day.count),
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 mt-1.5 justify-end">
        <span className="text-[9px] text-gray-400">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{
              width: '10px',
              height: '10px',
              backgroundColor: getColor(i === 0 ? 0 : Math.ceil(i * maxCount)),
            }}
          />
        ))}
        <span className="text-[9px] text-gray-400">More</span>
      </div>
    </div>
  );
}
