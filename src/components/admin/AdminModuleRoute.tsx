'use client';

import { AdminConsole } from '@/components/admin/AdminConsole';
import { ADMIN_MODULE_CONFIG } from '@/lib/admin/config';

/**
 * Server wrapper for a configured admin module. The configuration is static
 * and client safe, so it can be handed straight to the console.
 */
export function AdminModuleRoute({ module }: { module: string }) {
  const config = ADMIN_MODULE_CONFIG[module];
  if (!config) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-8">
        <h1 className="text-[22px] font-semibold text-foreground">Module not configured</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">No admin console configuration exists for {module}.</p>
      </div>
    );
  }
  return <AdminConsole config={config} />;
}
