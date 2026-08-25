"use client";

import { useState, useEffect } from "react";
import { X, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const INK = "#1E1B4B";

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function tryLogin() {
    setLoginLoading(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.trim(),
      password: passwordInput,
    });
    setLoginLoading(false);
    if (error) {
      setLoginError("Identifiants incorrects.");
      return;
    }
    setEmailInput("");
    setPasswordInput("");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (!authLoaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFEEE2" }} />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFEEE2",
        fontFamily: "'Poppins', 'Nunito', sans-serif",
        color: INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          background: "#FFFFFF",
          borderRadius: 22,
          padding: "22px 22px 24px",
          boxShadow: "0 24px 60px rgba(30,27,75,0.15)",
        }}
      >
        {session ? (
          <>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Connecté en tant qu'admin</div>
            <div style={{ fontSize: 13, color: "#9A8F84", marginBottom: 18 }}>{session.user?.email}</div>
            <a
              href="/"
              style={{
                display: "block",
                textAlign: "center",
                width: "100%",
                boxSizing: "border-box",
                background: "linear-gradient(135deg, #FF477E, #7B5CFA)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 12,
                padding: "11px 0",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                marginBottom: 10,
              }}
            >
              Retour au site
            </a>
            <button
              onClick={logout}
              style={{
                width: "100%",
                background: "#F5F1FF",
                color: INK,
                border: "none",
                borderRadius: 12,
                padding: "11px 0",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <LogOut size={15} /> Se déconnecter
            </button>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>Connexion admin</div>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                setLoginError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && tryLogin()}
              placeholder="Email"
              autoFocus
              style={{
                width: "100%",
                background: "#F7F3FF",
                border: `2px solid ${loginError ? "#FF477E" : "#EDE5FA"}`,
                borderRadius: 12,
                color: INK,
                fontSize: 14,
                fontWeight: 500,
                padding: "10px 13px",
                boxSizing: "border-box",
                outline: "none",
                marginBottom: 8,
              }}
            />
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setLoginError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && tryLogin()}
              placeholder="Mot de passe"
              style={{
                width: "100%",
                background: "#F7F3FF",
                border: `2px solid ${loginError ? "#FF477E" : "#EDE5FA"}`,
                borderRadius: 12,
                color: INK,
                fontSize: 14,
                fontWeight: 500,
                padding: "10px 13px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            {loginError && (
              <div style={{ fontSize: 11.5, color: "#FF477E", fontWeight: 600, marginTop: 6 }}>{loginError}</div>
            )}
            <button
              onClick={tryLogin}
              disabled={loginLoading}
              style={{
                width: "100%",
                marginTop: 14,
                background: "linear-gradient(135deg, #FF477E, #7B5CFA)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 12,
                padding: "11px 0",
                fontSize: 14,
                fontWeight: 700,
                cursor: loginLoading ? "default" : "pointer",
                opacity: loginLoading ? 0.7 : 1,
              }}
            >
              {loginLoading ? "Connexion..." : "Se connecter"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
