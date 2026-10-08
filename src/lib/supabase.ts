import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
);

export const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-1c85eca0`;
