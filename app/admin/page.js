"use client";

import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const INK = "#1E1B4B";

const TAGS = [
  { id: "sortie", label: "Sortie", emoji: "🚀", color: "#FFB100" },
  { id: "patch", label: "Patch", emoji: "🛠️", color: "#17B3A3" },
  { id: "rumeur", label: "Rumeur", emoji: "👀", color: "#FF477E" },
  { id: "prix", label: "Prix", emoji: "💸", color: "#34C77A" },
  { id: "annonce", label: "Annonce", emoji: "📣", color: "#7B5CFA" },
];

const PLATFORMS = [
  { id: "playstation", label: "PlayStation", color: "#0070CC" },
  { id: "xbox", label: "Xbox", color: "#107C10" },
  { id: "nintendo", label: "Nintendo", color: "#E60012" },
  { id: "pc", label: "PC", color: "#4A4A4A" },
  { id: "multi", label: "Multi", color: "#9A8F84" },
  { id: "autre", label: "Autre", color: "#B98CFF" },
];

function computeStats(rows) {
  const byTag = {};
  const byPlatform = {};
  const reactionTotals = { fire: 0, thumbsdown: 0, party: 0 };
  for (const row of rows) {
    byTag[row.tag] = (byTag[row.tag] || 0) + 1;
    for (const p of row.platforms || []) {
      byPlatform[p] = (byPlatform[p] || 0) + 1;
    }
    const counts = row.reaction_counts || {};
    for (const key of Object.keys(reactionTotals)) {
      reactionTotals[key] += counts[key] || 0;
    }
  }
  return { total: rows.length, byTag, byPlatform, reactionTotals };
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [viewStats, setViewStats] = useState(null);

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

  useEffect(() => {
    if (!session) return;
    setStatsLoading(true);
    supabase
      .from("posts")
      .select("tag, platforms, reaction_counts")
      .then(({ data, error }) => {
        if (!error && data) setStats(computeStats(data));
        setStatsLoading(false);
      });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase.from("page_views").select("*", { count: "exact", head: true }),
      supabase.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", startOfToday),
      supabase.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    ]).then(([totalRes, todayRes, weekRes]) => {
      setViewStats({
        total: totalRes.count ?? 0,
        today: todayRes.count ?? 0,
        last7: weekRes.count ?? 0,
      });
    });
  }, [session]);

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

  if (!session) {
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
        </div>
      </div>
    );
  }

  const maxTagCount = stats ? Math.max(1, ...Object.values(stats.byTag)) : 1;
  const maxPlatformCount = stats ? Math.max(1, ...Object.values(stats.byPlatform)) : 1;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFEEE2",
        fontFamily: "'Poppins', 'Nunito', sans-serif",
        color: INK,
        padding: "24px 16px 60px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Tableau de bord admin</div>
            <div style={{ fontSize: 12.5, color: "#9A8F84" }}>{session.user?.email}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href="/"
              style={{
                background: "linear-gradient(135deg, #FF477E, #7B5CFA)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Retour au site
            </a>
            <button
              onClick={logout}
              style={{
                background: "#F5F1FF",
                color: INK,
                border: "none",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {statsLoading && <div style={{ color: "#9A8F84", fontSize: 13 }}>Chargement des statistiques...</div>}

        {viewStats && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 16, padding: "16px 14px", textAlign: "center", boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{viewStats.total}</div>
              <div style={{ fontSize: 11.5, color: "#9A8F84", fontWeight: 600 }}>visites totales</div>
            </div>
            <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 16, padding: "16px 14px", textAlign: "center", boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{viewStats.today}</div>
              <div style={{ fontSize: 11.5, color: "#9A8F84", fontWeight: 600 }}>aujourd'hui</div>
            </div>
            <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 16, padding: "16px 14px", textAlign: "center", boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{viewStats.last7}</div>
              <div style={{ fontSize: 11.5, color: "#9A8F84", fontWeight: 600 }}>7 derniers jours</div>
            </div>
          </div>
        )}

        {stats && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 16, padding: "16px 14px", textAlign: "center", boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{stats.total}</div>
                <div style={{ fontSize: 11.5, color: "#9A8F84", fontWeight: 600 }}>news publiées</div>
              </div>
              <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 16, padding: "16px 14px", textAlign: "center", boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>🔥 {stats.reactionTotals.fire}</div>
                <div style={{ fontSize: 11.5, color: "#9A8F84", fontWeight: 600 }}>flammes</div>
              </div>
              <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 16, padding: "16px 14px", textAlign: "center", boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>🎉 {stats.reactionTotals.party}</div>
                <div style={{ fontSize: 11.5, color: "#9A8F84", fontWeight: 600 }}>fêtes</div>
              </div>
              <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 16, padding: "16px 14px", textAlign: "center", boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>👎 {stats.reactionTotals.thumbsdown}</div>
                <div style={{ fontSize: 11.5, color: "#9A8F84", fontWeight: 600 }}>pouces bas</div>
              </div>
            </div>

            <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "16px 16px 18px", marginBottom: 14, boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Répartition par tag</div>
              {TAGS.map((t) => {
                const count = stats.byTag[t.id] || 0;
                return (
                  <div key={t.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                      <span>{t.emoji} {t.label}</span>
                      <span style={{ color: "#9A8F84" }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: "#F5F1FF", borderRadius: 999 }}>
                      <div style={{ height: 6, width: `${(count / maxTagCount) * 100}%`, background: t.color, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "16px 16px 18px", boxShadow: "0 6px 16px rgba(30,27,75,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Répartition par plateforme</div>
              {PLATFORMS.map((p) => {
                const count = stats.byPlatform[p.id] || 0;
                return (
                  <div key={p.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                      <span>{p.label}</span>
                      <span style={{ color: "#9A8F84" }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: "#F5F1FF", borderRadius: 999 }}>
                      <div style={{ height: 6, width: `${(count / maxPlatformCount) * 100}%`, background: p.color, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
