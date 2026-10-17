import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}) => {
  const borderVariants = {
    default: 'border-slate-200 bg-white',
    success: 'border-slate-200 bg-white',
    warning: 'border-slate-200 bg-white',
    danger: 'border-slate-200 bg-white',
  };

  const iconColors = {
    default: 'text-blue-600 bg-blue-50',
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-rose-600 bg-rose-50',
  };

  return (
    <div className={`p-4 md:p-5 rounded-2xl border ${borderVariants[variant]} shadow-xs flex items-start justify-between gap-4 transition-all hover:border-slate-300`}>
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500 pt-0.5">{subtitle}</p>
        )}
      </div>

      {Icon && (
        <div className={`p-2.5 rounded-xl ${iconColors[variant]} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
};
