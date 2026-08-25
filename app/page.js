"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { Plus, X, ExternalLink, Trash2, Pencil, Zap, Lock, LockOpen, Share2, Flame, Search } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

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

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

function dateLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function dateKey(ts) {
  return new Date(ts).toDateString();
}

// Convertit une ligne Supabase (snake_case) en objet post utilisé par l'UI
function rowToPost(row) {
  return {
    id: row.id,
    text: row.text,
    tag: row.tag,
    platforms: row.platforms || [],
    source: row.source || "",
    sourceWords: row.source_words,
    reactions: row.reactions || 0,
    featured: !!row.featured,
    ts: new Date(row.created_at).getTime(),
  };
}

const REACTED_KEY = "jvcut:reacted-posts";

function getReactedSet() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(REACTED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
}

function saveReactedSet(set) {
  try {
    window.localStorage.setItem(REACTED_KEY, JSON.stringify([...set]));
  } catch (e) {
    // ignore
  }
}

async function sharePost(post) {
  const text = `${post.text} — via JvCut`;
  const url = typeof window !== "undefined" ? window.location.origin : "";
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
    } catch (e) {
      // annulé par l'utilisateur, on ne fait rien
    }
  } else {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

export default function JvCut() {
  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ text: "", tag: "annonce", platforms: ["multi"], source: "", sourceWords: "", featured: false });
  const [activeFilter, setActiveFilter] = useState("all");
  const [activePlatform, setActivePlatform] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [reactedIds, setReactedIds] = useState(() => new Set());
  const [copiedId, setCopiedId] = useState(null);

  const [session, setSession] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const isAdmin = !!session;
  const textareaRef = useRef(null);

  // Auth : session Supabase (persistée automatiquement par supabase-js)
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
    setLoginOpen(false);
    setEmailInput("");
    setPasswordInput("");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function fetchPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setPosts(data.map(rowToPost));
    }
    setLoaded(true);
  }

  useEffect(() => {
    fetchPosts();
    setReactedIds(getReactedSet());
  }, []);

  async function handleReact(id) {
    if (reactedIds.has(id)) return;
    const next = new Set(reactedIds);
    next.add(id);
    setReactedIds(next);
    saveReactedSet(next);
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, reactions: p.reactions + 1 } : p)));
    const { error } = await supabase.rpc("increment_post_reaction", { post_id: id });
    if (error) {
      // en cas d'échec, on annule l'effet optimiste
      next.delete(id);
      setReactedIds(new Set(next));
      saveReactedSet(next);
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, reactions: Math.max(0, p.reactions - 1) } : p)));
    }
  }

  async function handleShare(post) {
    const copied = await sharePost(post);
    if (copied) {
      setCopiedId(post.id);
      setTimeout(() => setCopiedId((cur) => (cur === post.id ? null : cur)), 1800);
    }
  }

  function togglePlatform(id) {
    setDraft((d) => {
      const has = d.platforms.includes(id);
      const next = has ? d.platforms.filter((p) => p !== id) : [...d.platforms, id];
      return { ...d, platforms: next.length ? next : d.platforms };
    });
  }

  function openComposer(post) {
    if (post) {
      setEditingId(post.id);
      setDraft({
        text: post.text,
        tag: post.tag,
        platforms: post.platforms && post.platforms.length ? post.platforms : ["multi"],
        source: post.source || "",
        sourceWords: post.sourceWords ? String(post.sourceWords) : "",
        featured: !!post.featured,
      });
    } else {
      setEditingId(null);
      setDraft({ text: "", tag: "annonce", platforms: ["multi"], source: "", sourceWords: "", featured: false });
    }
    setComposerOpen(true);
    setSaveError("");
    setTimeout(() => textareaRef.current && textareaRef.current.focus(), 50);
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditingId(null);
    setSaveError("");
  }

  const [saveError, setSaveError] = useState("");

  async function savePost() {
    const text = draft.text.trim();
    if (!text) return;
    setSaveError("");
    const payload = {
      text,
      tag: draft.tag,
      platforms: draft.platforms,
      source: draft.source.trim(),
      source_words: draft.sourceWords ? parseInt(draft.sourceWords, 10) : null,
      featured: draft.featured,
    };
    let error;
    // Une seule news à la une à la fois : si on en coche une nouvelle,
    // on décoche d'abord toutes les autres.
    if (draft.featured) {
      const { error: unfeaturedError } = await supabase
        .from("posts")
        .update({ featured: false })
        .neq("id", editingId || "00000000-0000-0000-0000-000000000000");
      if (unfeaturedError) {
        console.error("Erreur unfeature:", unfeaturedError);
      }
    }
    if (editingId) {
      ({ error } = await supabase.from("posts").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("posts").insert(payload));
    }
    if (error) {
      console.error("Erreur savePost:", error);
      setSaveError(error.message || "Une erreur est survenue.");
      return;
    }
    await fetchPosts();
    closeComposer();
  }

  async function deletePost(id) {
    await supabase.from("posts").delete().eq("id", id);
    await fetchPosts();
  }

  const filtered = posts
    .filter((p) => activeFilter === "all" || p.tag === activeFilter)
    .filter((p) => activePlatform === "all" || (p.platforms || []).includes(activePlatform))
    .filter((p) => !searchQuery.trim() || p.text.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const sorted = [...filtered].sort((a, b) => b.ts - a.ts);
  const isSearching = searchQuery.trim().length > 0;
  const manuallyFeatured = sorted.find((p) => p.featured);
  const featured = isSearching ? null : manuallyFeatured || sorted[0];
  const rest = isSearching ? sorted : sorted.filter((p) => p.id !== featured?.id);
  const draftWords = wordCount(draft.text || "");
  const INK = "#1E1B4B";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFEEE2",
        fontFamily: "'Poppins', 'Nunito', sans-serif",
        color: INK,
        padding: "18px 16px 100px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Hero */}
        <div
          style={{
            position: "relative",
            borderRadius: 28,
            overflow: "hidden",
            boxShadow: "0 16px 40px rgba(30,27,75,0.08)",
          }}
        >
          <img
            src="/logo.png"
            alt="JvCut — Toute l'actu, en un éclair"
            style={{ display: "block", width: "100%", height: "auto" }}
          />
          {authLoaded && (
            <button
              onClick={() => (isAdmin ? logout() : setLoginOpen(true))}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: "rgba(255,255,255,0.75)",
                backdropFilter: "blur(4px)",
                border: "none",
                borderRadius: 999,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#1E1B4B",
              }}
              aria-label={isAdmin ? "Se déconnecter" : "Connexion admin"}
              title={isAdmin ? "Déconnexion admin" : "Connexion admin"}
            >
              {isAdmin ? <LockOpen size={15} /> : <Lock size={15} />}
            </button>
          )}
        </div>

        {/* Breaking news ticker */}
        <div
          style={{
            marginTop: 12,
            background: "linear-gradient(120deg, #FF7A59 0%, #FF477E 55%, #7B5CFA 100%)",
            borderRadius: 14,
            padding: "10px 14px",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              display: "inline-block",
              animation: "scroll-left 18s linear infinite",
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.02em",
              color: "#FFFFFF",
            }}
          >
            {sorted.slice(0, 6).map((p) => `${TAGS.find((t) => t.id === p.tag)?.emoji || "•"}  ${p.text}`).join("      ")}
            {sorted.length === 0 && "En attente de news..."}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginTop: 16, padding: "0 2px" }}>
          <Search
            size={16}
            color="#B3A6CC"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une news..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px 14px 11px 38px",
              borderRadius: 14,
              border: "1px solid #EADFF2",
              background: "#FFFFFF",
              fontSize: 14,
              fontFamily: "'Poppins', sans-serif",
              color: "#1E1B4B",
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Effacer la recherche"
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                color: "#B3A6CC",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, padding: "16px 2px 8px", overflowX: "auto" }}>
          <FilterPill active={activeFilter === "all"} onClick={() => setActiveFilter("all")} color={INK}>
            Tout
          </FilterPill>
          {TAGS.map((t) => (
            <FilterPill key={t.id} active={activeFilter === t.id} onClick={() => setActiveFilter(t.id)} color={t.color}>
              {t.emoji} {t.label}
            </FilterPill>
          ))}
        </div>
        <div style={{ height: 1, background: "#EADFF2", margin: "0 2px" }} />
        <div style={{ display: "flex", gap: 8, padding: "12px 2px 16px", overflowX: "auto" }}>
          <FilterPill active={activePlatform === "all"} onClick={() => setActivePlatform("all")} color="#9A8F84">
            Toutes plateformes
          </FilterPill>
          {PLATFORMS.map((p) => (
            <FilterPill key={p.id} active={activePlatform === p.id} onClick={() => setActivePlatform(p.id)} color={p.color}>
              {p.label}
            </FilterPill>
          ))}
        </div>

        {/* Featured */}
        {featured && (
          <FeaturedCard
            post={featured}
            hasReacted={reactedIds.has(featured.id)}
            onReact={() => handleReact(featured.id)}
            onShare={() => handleShare(featured)}
            copied={copiedId === featured.id}
          />
        )}

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 12,
          }}
        >
          {rest.map((post, i) => {
            const prev = rest[i - 1];
            const showDateBar = !prev || dateKey(prev.ts) !== dateKey(post.ts);
            return (
              <Fragment key={post.id}>
                {showDateBar && <DateBar label={dateLabel(post.ts)} />}
                <TileCard
                  post={post}
                  expanded={expandedIds.has(post.id)}
                  onToggleExpand={() => toggleExpand(post.id)}
                  onEdit={() => openComposer(post)}
                  onDelete={() => deletePost(post.id)}
                  isAdmin={isAdmin}
                  hasReacted={reactedIds.has(post.id)}
                  onReact={() => handleReact(post.id)}
                  onShare={() => handleShare(post)}
                  copied={copiedId === post.id}
                />
              </Fragment>
            );
          })}
        </div>

        {loaded && sorted.length === 0 && (
          <div style={{ textAlign: "center", color: "#9A8F84", fontWeight: 600, padding: "50px 0" }}>
            {isSearching ? `Aucun résultat pour "${searchQuery.trim()}".` : "Aucune news dans cette catégorie."}
          </div>
        )}

        {featured && isAdmin && (
          <div style={{ display: "flex", gap: 16, marginTop: 4, padding: "10px 4px 0", justifyContent: "flex-end" }}>
            <button onClick={() => openComposer(featured)} style={iconBtnStyle}>
              <Pencil size={12} /> éditer la une
            </button>
            <button onClick={() => deletePost(featured.id)} style={{ ...iconBtnStyle, color: "#FF477E" }}>
              <Trash2 size={12} /> suppr.
            </button>
          </div>
        )}
      </div>

      {/* FAB */}
      {isAdmin && (
        <button
          onClick={() => openComposer(null)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "linear-gradient(135deg, #FF477E, #7B5CFA)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "50%",
            width: 58,
            height: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 24px rgba(123,92,250,0.45)",
            cursor: "pointer",
          }}
          aria-label="Nouvelle news"
        >
          <Plus size={26} strokeWidth={3} />
        </button>
      )}

      {/* Composer modal */}
      {composerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(30,27,75,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            padding: 16,
          }}
          onClick={closeComposer}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#FFFFFF",
              borderRadius: 26,
              padding: "22px 22px 26px",
              boxShadow: "0 24px 60px rgba(30,27,75,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>{editingId ? "Modifier la news" : "Nouvelle news"}</span>
              <button onClick={closeComposer} style={{ background: "#F5F1FF", border: "none", borderRadius: 999, width: 30, height: 30, color: INK, cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={draft.text}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              placeholder="Le fait, en une phrase. Pas de blabla !"
              rows={3}
              style={{
                width: "100%",
                background: "#F7F3FF",
                border: "2px solid #EDE5FA",
                borderRadius: 16,
                color: INK,
                fontFamily: "'Poppins', sans-serif",
                fontSize: 15,
                fontWeight: 500,
                padding: 14,
                resize: "none",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: draftWords > 30 ? "#FF477E" : "#9A8F84", marginTop: 5, textAlign: "right" }}>
              {draftWords} mot{draftWords > 1 ? "s" : ""} {draftWords > 30 ? "· déjà trop long !" : ""}
            </div>

            <div style={{ display: "flex", gap: 6, margin: "14px 0", flexWrap: "wrap" }}>
              {TAGS.map((t) => (
                <FilterPill key={t.id} active={draft.tag === t.id} onClick={() => setDraft((d) => ({ ...d, tag: t.id }))} color={t.color}>
                  {t.emoji} {t.label}
                </FilterPill>
              ))}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {PLATFORMS.map((p) => (
                <FilterPill key={p.id} active={draft.platforms.includes(p.id)} onClick={() => togglePlatform(p.id)} color={p.color}>
                  {p.label}
                </FilterPill>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={draft.source}
                onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                placeholder="Lien source (optionnel)"
                style={inputStyle}
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: "#7B5CFA", cursor: "pointer" }}
              />
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13.5, fontWeight: 600, color: "#1E1B4B" }}>
                Mettre à la une
              </span>
            </label>
            {draft.featured && (
              <p style={{ fontSize: 11.5, color: "#9A8F84", margin: "4px 0 0", fontFamily: "'Poppins', sans-serif" }}>
                Cette news remplacera celle actuellement à la une.
              </p>
            )}

            {saveError && (
              <div style={{ fontSize: 12, color: "#FF477E", fontWeight: 600, marginTop: 10, background: "#FFF0F4", padding: "8px 10px", borderRadius: 10 }}>
                {saveError}
              </div>
            )}

            <button
              onClick={savePost}
              disabled={!draft.text.trim()}
              style={{
                width: "100%",
                marginTop: 18,
                background: draft.text.trim() ? "linear-gradient(135deg, #FF477E, #7B5CFA)" : "#EDE5FA",
                color: draft.text.trim() ? "#FFFFFF" : "#B3A6CC",
                border: "none",
                borderRadius: 16,
                padding: "13px 0",
                fontSize: 15,
                fontWeight: 700,
                cursor: draft.text.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Zap size={16} /> {editingId ? "Enregistrer" : "Publier"}
            </button>
          </div>
        </div>
      )}

      {/* Admin login modal */}
      {loginOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(30,27,75,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
            padding: 16,
          }}
          onClick={() => setLoginOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              background: "#FFFFFF",
              borderRadius: 22,
              padding: "22px 22px 24px",
              boxShadow: "0 24px 60px rgba(30,27,75,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>Connexion admin</span>
              <button onClick={() => setLoginOpen(false)} style={{ background: "#F5F1FF", border: "none", borderRadius: 999, width: 28, height: 28, color: INK, cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>
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
      )}

      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        textarea:focus, input:focus { border-color: #7B5CFA !important; }
        ::placeholder { color: #B3A6CC; }
      `}</style>
    </div>
  );
}

function FeaturedCard({ post, hasReacted, onReact, onShare, copied }) {
  const tagMeta = TAGS.find((t) => t.id === post.tag) || TAGS[0];
  const platMetas = (post.platforms || []).map((id) => PLATFORMS.find((p) => p.id === id)).filter(Boolean);
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 22,
        padding: "18px 20px",
        marginTop: 4,
        boxShadow: "0 12px 30px rgba(30,27,75,0.08)",
        borderLeft: `8px solid ${tagMeta.color}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 20 }}>{tagMeta.emoji}</span>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 12, color: tagMeta.color, letterSpacing: "0.03em" }}>
          {tagMeta.label.toUpperCase()} · À LA UNE
        </span>
        {platMetas.map((platMeta) => (
          <span
            key={platMeta.id}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: 11,
              color: "#FFFFFF",
              background: platMeta.color,
              borderRadius: 6,
              padding: "2px 8px",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {platMeta.label}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9A8F84", fontWeight: 600 }}>{timeAgo(post.ts)}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, margin: 0, color: "#1E1B4B" }}>{post.text}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
        <button
          onClick={onReact}
          disabled={hasReacted}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: hasReacted ? "#FFE9D6" : "#F7F3FF",
            border: "none",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 700,
            color: hasReacted ? "#FF7A19" : "#7B5CFA",
            cursor: hasReacted ? "default" : "pointer",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Flame size={14} fill={hasReacted ? "#FF7A19" : "none"} /> {post.reactions || 0}
        </button>
        <button
          onClick={onShare}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "#F7F3FF",
            border: "none",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 700,
            color: "#7B5CFA",
            cursor: "pointer",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Share2 size={14} /> {copied ? "Copié !" : "Partager"}
        </button>
        {post.source && (
          <a href={post.source} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: "#7B5CFA", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <ExternalLink size={12} /> source
          </a>
        )}
      </div>
    </div>
  );
}

const TILE_TRUNCATE_WORDS = 12;

function DateBar({ label }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "6px 2px 0",
      }}
    >
      <div style={{ flex: 1, height: 1, background: "#E9DCEF" }} />
      <span
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.06em",
          color: "#9A8F84",
          background: "#FFEEE2",
          padding: "3px 12px",
          borderRadius: 999,
        }}
      >
        {label.toUpperCase()}
      </span>
      <div style={{ flex: 1, height: 1, background: "#E9DCEF" }} />
    </div>
  );
}

function TileCard({ post, expanded, onToggleExpand, onEdit, onDelete, isAdmin, hasReacted, onReact, onShare, copied }) {
  const tagMeta = TAGS.find((t) => t.id === post.tag) || TAGS[0];
  const platMetas = (post.platforms || []).map((id) => PLATFORMS.find((p) => p.id === id)).filter(Boolean);
  const myWords = wordCount(post.text);
  const isLong = myWords > TILE_TRUNCATE_WORDS;
  const showFull = expanded || !isLong;
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 18,
        padding: "14px 14px 12px",
        boxShadow: "0 6px 16px rgba(30,27,75,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        gridColumn: expanded ? "1 / -1" : "auto",
        transition: "grid-column 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", rowGap: 6 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: tagMeta.color + "22",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {tagMeta.emoji}
        </span>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 11, color: tagMeta.color, letterSpacing: "0.02em" }}>
          {tagMeta.label.toUpperCase()}
        </span>
        {platMetas.map((platMeta) => (
          <span
            key={platMeta.id}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: 10,
              color: "#FFFFFF",
              background: platMeta.color,
              borderRadius: 6,
              padding: "2px 6px",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {platMeta.label}
          </span>
        ))}
      </div>
      <p
        style={{
          fontSize: 14.5,
          fontWeight: 600,
          lineHeight: 1.35,
          margin: 0,
          color: "#1E1B4B",
          flex: 1,
          display: showFull ? "block" : "-webkit-box",
          WebkitLineClamp: showFull ? "unset" : 3,
          WebkitBoxOrient: "vertical",
          overflow: showFull ? "visible" : "hidden",
        }}
      >
        {post.text}
      </p>
      {isLong && (
        <button
          onClick={onToggleExpand}
          style={{
            alignSelf: "flex-start",
            background: tagMeta.color + "1A",
            color: tagMeta.color,
            border: "none",
            borderRadius: 8,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Poppins', sans-serif",
            marginTop: -4,
          }}
        >
          {expanded ? "réduire ▲" : "… voir plus"}
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <button
          onClick={onReact}
          disabled={hasReacted}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: hasReacted ? "#FFE9D6" : "#F7F3FF",
            border: "none",
            borderRadius: 999,
            padding: "3px 8px",
            fontSize: 11,
            fontWeight: 700,
            color: hasReacted ? "#FF7A19" : "#7B5CFA",
            cursor: hasReacted ? "default" : "pointer",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Flame size={11} fill={hasReacted ? "#FF7A19" : "none"} /> {post.reactions || 0}
        </button>
        <button
          onClick={onShare}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: "#F7F3FF",
            border: "none",
            borderRadius: 999,
            padding: "3px 8px",
            fontSize: 11,
            fontWeight: 700,
            color: "#7B5CFA",
            cursor: "pointer",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Share2 size={11} /> {copied ? "Copié !" : ""}
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
        {post.source && (
          <a href={post.source} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: "#7B5CFA", fontWeight: 700, textDecoration: "none" }}>
            source
          </a>
        )}
        {isAdmin && (
          <>
            <button onClick={onEdit} style={{ ...iconBtnStyle, fontSize: 10.5 }}>éditer</button>
            <button onClick={onDelete} style={{ ...iconBtnStyle, fontSize: 10.5, color: "#FF477E" }}>suppr.</button>
          </>
        )}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: active ? color : "#FFFFFF",
        color: active ? "#FFFFFF" : color,
        border: `2px solid ${color}`,
        borderRadius: 999,
        padding: "6px 13px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "'Poppins', sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const iconBtnStyle = {
  background: "none",
  border: "none",
  color: "#9A8F84",
  fontSize: 11,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: 4,
  cursor: "pointer",
  padding: 0,
  fontFamily: "'Poppins', sans-serif",
};

const inputStyle = {
  flex: 1,
  background: "#F7F3FF",
  border: "2px solid #EDE5FA",
  borderRadius: 12,
  color: "#1E1B4B",
  fontSize: 13,
  fontWeight: 500,
  padding: "11px 13px",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "'Poppins', sans-serif",
};
