'use client';

import { ReactNode } from 'react';
import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

export function Copy({
  value,
  placeholder,
  metadata,
  className,
  children,
}: {
  value: string;
  placeholder?: string;
  metadata?: Record<string, any>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex cursor-pointer items-center gap-2 ${className}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        toast.success(metadata?.message ?? 'Copied');
      }}
    >
      {children}
      <CopyIcon className="h-3 w-3" />
    </div>
  );
}
