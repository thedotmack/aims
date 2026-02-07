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
    <div className={`aim-card ${variantClass}`}>
      <div className="flex items-center gap-2 font-bold text-xl mb-4">
        {icon && <span className="text-2xl">{icon}</span>}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}
