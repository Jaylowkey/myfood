import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

export type Profile = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: "customer" | "driver" | "admin" | "super_admin";
  marketingOptIn: boolean;
  createdAt: string;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isDriver: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setProfile(null);
      return;
    }
    try {
      const result = await api<{ profile: Profile }>("/profile");
      const user = data.session.user;
      const email = (result.profile.email || user.email || "").toLowerCase();
      const isKnownSuperAdmin = ["jrsamadh@gmail.com", "paygoprimeira@gmail.com"].includes(email);
      setProfile({
        ...result.profile,
        email,
        name: result.profile.name || user.user_metadata?.name || email.split("@")[0] || "Utilizador",
        phone: result.profile.phone || user.user_metadata?.phone || "",
        role: isKnownSuperAdmin ? "super_admin" : result.profile.role,
      });
    } catch {
      // Keep account details visible from Supabase Auth while the profile API is being repaired.
      const user = data.session.user;
      const email = (user.email || "").toLowerCase();
      const isKnownSuperAdmin = ["jrsamadh@gmail.com", "paygoprimeira@gmail.com"].includes(email);
      setProfile({
        id: user.id,
        email,
        name: user.user_metadata?.name || email.split("@")[0] || "Utilizador",
        phone: user.user_metadata?.phone || "",
        role: isKnownSuperAdmin ? "super_admin" : "customer",
        marketingOptIn: true,
        createdAt: user.created_at,
      });
      throw new Error("PROFILE_API_UNAVAILABLE");
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        try {
          await refreshProfile();
        } catch {
          // Keep the valid auth session even if the profile API is temporarily unavailable.
          // Signing out here breaks email-confirmation and password-recovery callbacks.
          setProfile(null);
        }
      }
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setProfile(null);
      else window.setTimeout(() => void refreshProfile(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      isAdmin: profile?.role === "admin" || profile?.role === "super_admin",
      isDriver: profile?.role === "driver",
      refreshProfile,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [session, profile, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
