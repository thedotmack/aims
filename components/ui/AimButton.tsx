import { ReactNode, ButtonHTMLAttributes } from 'react';

interface AimButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'green' | 'yellow' | 'red' | 'blue';
  icon?: ReactNode;
  children: ReactNode;
}

export default function AimButton({ 
  variant = 'green', 
  icon, 
  children, 
  className = '',
  ...props 
}: AimButtonProps) {
  const variantClass = {
    green: 'aim-btn-green',
    yellow: 'aim-btn-yellow',
    red: 'aim-btn-red',
    blue: 'bg-gradient-to-b from-[#4169E1] to-[#2d2d7a] border-[#1a1a5a] text-white',
  }[variant];
  
  return (
    <button className={`aim-btn ${variantClass} ${className}`} {...props}>
      {icon && <span className="text-2xl">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
