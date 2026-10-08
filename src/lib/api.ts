import { publicAnonKey } from "../../utils/supabase/info";
import { apiUrl, supabase } from "./supabase";

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: publicAnonKey,
      ...(data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Não foi possível concluir a operação.");
  }
  return payload;
}
