'use client';

import { createContext, useContext } from 'react';

const AdminPermissionsContext = createContext<string[]>([]);

export function AdminPermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  return (
    <AdminPermissionsContext.Provider value={permissions}>
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export function useAdminPermissions() {
  return useContext(AdminPermissionsContext);
}

export function adminCan(permissions: string[], permission: string | undefined) {
  if (!permission) return false;
  return permissions.includes('*') || permissions.includes(permission);
}
