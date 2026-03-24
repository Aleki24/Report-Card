import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PremiumIconProps {
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'emerald';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  glow?: boolean;
}

const colorMap = {
  blue: { 
    bg: 'from-blue-500/20 to-cyan-500/10', 
    border: 'border-blue-500/30', 
    icon: 'text-blue-400', 
    shadow: 'shadow-blue-500/20' 
  },
  green: { 
    bg: 'from-emerald-500/20 to-teal-500/10', 
    border: 'border-emerald-500/30', 
    icon: 'text-emerald-400', 
    shadow: 'shadow-emerald-500/20' 
  },
  purple: { 
    bg: 'from-purple-500/20 to-fuchsia-500/10', 
    border: 'border-purple-500/30', 
    icon: 'text-purple-400', 
    shadow: 'shadow-purple-500/20' 
  },
  orange: { 
    bg: 'from-orange-500/20 to-amber-500/10', 
    border: 'border-orange-500/30', 
    icon: 'text-orange-400', 
    shadow: 'shadow-orange-500/20' 
  },
  red: { 
    bg: 'from-rose-500/20 to-red-500/10', 
    border: 'border-rose-500/30', 
    icon: 'text-rose-400', 
    shadow: 'shadow-rose-500/20' 
  },
  indigo: { 
    bg: 'from-indigo-500/20 to-violet-500/10', 
    border: 'border-indigo-500/30', 
    icon: 'text-indigo-400', 
    shadow: 'shadow-indigo-500/20' 
  },
  emerald: { 
    bg: 'from-green-500/20 to-emerald-500/10', 
    border: 'border-green-500/30', 
    icon: 'text-green-400', 
    shadow: 'shadow-green-500/20' 
  },
};

const sizeMap = {
  sm: { container: 'w-8 h-8 rounded-lg', icon: 16 },
  md: { container: 'w-12 h-12 rounded-xl', icon: 24 },
  lg: { container: 'w-16 h-16 rounded-2xl', icon: 32 },
  xl: { container: 'w-24 h-24 rounded-3xl', icon: 48 },
};

export const PremiumIcon = ({
  icon: Icon,
  color = 'blue',
  size = 'md',
  className = '',
  glow = true,
}: PremiumIconProps) => {
  const c = colorMap[color];
  const s = sizeMap[size];

  return (
    <div
      className={`relative flex items-center justify-center bg-gradient-to-br ${c.bg} backdrop-blur-xl border ${c.border} ${s.container} ${glow ? `shadow-[0_0_20px_rgba(0,0,0,0.2)] ${c.shadow}` : ''} transition-all duration-300 ${className}`}
      style={{
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Top inner highlight for 3D glass effect */}
      <div className={`absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none ${s.container}`} />
      
      {/* Actual Icon with text shadow */}
      <Icon 
        className={`relative z-10 ${c.icon}`} 
        size={s.icon} 
        strokeWidth={2} 
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
      />
    </div>
  );
};
