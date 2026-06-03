import { api, tokenStore } from "../api/client";

/** GET an authenticated CSV endpoint and trigger a browser download. */
export async function downloadAuthenticatedCsv(path: string, filename: string) {
  const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  const token = tokenStore.getAccess();
  const resp = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`);
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
