import { ReactNode } from 'react';

interface AimCardProps {
  variant?: 'cream' | 'blue';
  icon?: string;
  title: string;
  children: ReactNode;
}

export default function AimCard({ variant = 'cream', icon, title, children }: AimCardProps) {
  const variantClass = variant === 'cream' ? 'aim-card-cream' : 'aim-card-blue';
  
  return (
    <div className={`aim-card ${variantClass} hover:shadow-lg transition-shadow flex-1 min-w-0`}>
      <div className="flex items-center gap-1.5 font-bold text-sm sm:text-xl mb-2 sm:mb-4">
        {icon && <span className="text-lg sm:text-2xl">{icon}</span>}
        <span className="truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}
