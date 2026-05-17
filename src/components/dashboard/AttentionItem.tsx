import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type AttentionItemProps = {
  label: string;
  href?: string;
  tone?: 'warning' | 'danger' | 'info' | 'success';
  count?: number | string;
};

const toneClasses: Record<NonNullable<AttentionItemProps['tone']>, string> = {
  warning: 'bg-amber-500 text-amber-600',
  danger: 'bg-red-500 text-red-600',
  info: 'bg-blue-500 text-blue-600',
  success: 'bg-emerald-500 text-emerald-600',
};

export default function AttentionItem({ label, href, tone = 'info', count }: AttentionItemProps) {
  const content = (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/35 p-[5px] transition-colors hover:bg-muted/60">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', toneClasses[tone].split(' ')[0])} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight text-foreground">{label}</span>
      {count !== undefined && (
        <span className={cn('rounded-full bg-current/10 px-2 py-0.5 text-xs font-bold', toneClasses[tone].split(' ')[1])}>{count}</span>
      )}
      {href && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </div>
  );

  if (!href) return content;
  return <Link href={href} className="block no-underline">{content}</Link>;
}
