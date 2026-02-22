import * as React from 'react';
import { cn } from '../../lib/utils';

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn('rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700', className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mb-1 font-medium text-slate-900', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-slate-600', className)} {...props} />;
}
