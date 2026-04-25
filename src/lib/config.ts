const envBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? undefined;
export const API_BASE = envBase ?? "http://127.0.0.1:11424";
