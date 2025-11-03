// src/hooks/useAppVersion.ts
export function useAppVersion() {
  return {
    version: import.meta.env.VITE_APP_VERSION || '0.0.1',
    buildDate: import.meta.env.VITE_APP_BUILD_DATE || new Date().toISOString()
  };
}
