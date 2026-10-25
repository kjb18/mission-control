import { createContext, useContext, useEffect, useState } from "react";
import { supabase, OWNER_EMAIL } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function sendMagicLink(email) {
    const normalized = email.trim().toLowerCase();
    if (normalized !== OWNER_EMAIL.toLowerCase()) {
      return {
        error: {
          message: "This device is registered to a single Mission Control owner account.",
        },
      };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  }

  // Password sign-in. The password is only ever the value the user types; it is
  // set by the user in the Supabase Auth dashboard, never stored in the code.
  // ADMIN SETUP: in the Supabase dashboard go to Authentication settings and make
  // sure the Email provider is enabled with password sign-in turned on, otherwise
  // signInWithPassword fails for every account.
  async function signInWithPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = {
    session,
    user: session?.user ?? null,
    isLoading: session === undefined,
    sendMagicLink,
    signInWithPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
