import React from 'react';
import { Users } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-lg bg-popover border border-border flex items-center justify-center mb-4 text-muted-foreground">
        {icon || <Users className="w-6 h-6" />}
      </div>
      <h3 className="font-sans text-[15px] font-bold text-foreground mb-1.5">
        {title}
      </h3>
      <p className={`text-xs text-muted-foreground leading-relaxed max-w-xs ${action ? 'mb-4' : ''}`}>
        {description}
      </p>
      {action}
    </div>
  );
}
