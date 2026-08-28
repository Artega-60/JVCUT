"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { Plus, X, ExternalLink, Trash2, Pencil, Zap, Share2, Flame, ThumbsDown, PartyPopper, Search, Sun, Moon, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const REACTIONS = [
  { id: "fire", Icon: Flame, color: "#FF7A19" },
  { id: "thumbsdown", Icon: ThumbsDown, color: "#FF477E" },
  { id: "party", Icon: PartyPopper, color: "#7B5CFA" },
];

const LIGHT_THEME = {
  bg: "#FFEEE2",
  card: "#FFFFFF",
  ink: "#1E1B4B",
  muted: "#9A8F84",
  border: "#EADFF2",
  subtle: "#F7F3FF",
  subtleBorder: "#EDE5FA",
  placeholder: "#B3A6CC",
  reactedBg: "#FFE9D6",
  errorBg: "#FFF0F4",
  dateLine: "#E9DCEF",
};

const DARK_THEME = {
  bg: "#15121F",
  card: "#211D30",
  ink: "#F1EDFB",
  muted: "#9C93B5",
  border: "#332C49",
  subtle: "#2A2440",
  subtleBorder: "#3B3355",
  placeholder: "#7A7295",
  reactedBg: "#3A2A22",
  errorBg: "#3A1E28",
  dateLine: "#332C49",
};

const THEME_KEY = "jvcut:theme";

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
  { id: "multi", label: "Multi", color: "var(--muted)" },
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
    reactionCounts: row.reaction_counts || {},
    featured: !!row.featured,
    commentCount: row.comment_count || 0,
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

function reactionKey(postId, reactionType) {
  return `${postId}:${reactionType}`;
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

const PAGE_SIZE = 30;

export default function JvCut() {
  const [posts, setPosts] = useState([]);
  const [featuredPost, setFeaturedPost] = useState(null);
  const [ticker, setTicker] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ text: "", tag: "annonce", platforms: ["multi"], source: "", sourceWords: "", featured: false });
  const [activeFilter, setActiveFilter] = useState("all");
  const [activePlatform, setActivePlatform] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [reactedIds, setReactedIds] = useState(() => new Set());
  const [copiedId, setCopiedId] = useState(null);

  const [session, setSession] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "dark") setIsDark(true);
      else if (saved === "light") setIsDark(false);
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setIsDark(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch (e) {
        // ignore
      }
      return next;
    });
  }

  const theme = isDark ? DARK_THEME : LIGHT_THEME;

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

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // La recherche interroge la base après une courte pause (pas à chaque
  // frappe), pour éviter de surcharger Supabase pendant que l'utilisateur tape.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const noFiltersActive = activeFilter === "all" && activePlatform === "all" && !debouncedSearch;

  // Charge une page de news depuis Supabase, en tenant compte des filtres actifs.
  // append=false : remplace la liste (nouveau chargement / filtre changé).
  // append=true  : ajoute la page suivante (bouton "charger plus").
  async function fetchPosts({ append = false } = {}) {
    if (append) setLoadingMore(true);
    let query = supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (activeFilter !== "all") query = query.eq("tag", activeFilter);
    if (activePlatform !== "all") query = query.contains("platforms", [activePlatform]);
    if (debouncedSearch) query = query.ilike("text", `%${debouncedSearch}%`);
    const from = append ? posts.length : 0;
    query = query.range(from, from + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (!error && data) {
      const mapped = data.map(rowToPost);
      setPosts((prev) => (append ? [...prev, ...mapped] : mapped));
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoaded(true);
    setLoadingMore(false);
  }

  // La news "à la une" est cherchée séparément de la pagination, pour
  // qu'elle s'affiche correctement même si elle n'est plus dans les
  // dernières news chargées (utile une fois qu'il y a beaucoup de news).
  async function fetchFeatured() {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("featured", true)
      .order("created_at", { ascending: false })
      .limit(1);
    setFeaturedPost(data && data[0] ? rowToPost(data[0]) : null);
  }

  // Le bandeau défilant montre toujours les toutes dernières news, peu
  // importe les filtres actifs sur la grille en dessous.
  async function fetchTicker() {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);
    if (data) setTicker(data.map(rowToPost));
  }

  function loadMore() {
    if (!hasMore || loadingMore) return;
    fetchPosts({ append: true });
  }

  // Recharge la première page à chaque changement de filtre, plateforme ou recherche
  useEffect(() => {
    fetchPosts({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, activePlatform, debouncedSearch]);

  useEffect(() => {
    fetchFeatured();
    fetchTicker();
    setReactedIds(getReactedSet());
    logVisit();
  }, []);

  // Enregistre une visite une seule fois par session de navigation (pas à
  // chaque rafraîchissement de données), pour un compteur simple et sans
  // cookies de suivi.
  function logVisit() {
    try {
      if (window.sessionStorage.getItem("jvcut:visit-logged")) return;
      window.sessionStorage.setItem("jvcut:visit-logged", "1");
    } catch (e) {
      // si le sessionStorage est inaccessible, on enregistre quand même
    }
    supabase.from("page_views").insert({}).then(() => {});
  }

  // Mise à jour en temps réel : dès qu'une news est ajoutée, modifiée ou
  // supprimée (par n'importe qui, y compris depuis un autre appareil), le
  // site se rafraîchit automatiquement sans que le visiteur ait à recharger.
  useEffect(() => {
    const channel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        fetchPosts({ append: false });
        fetchFeatured();
        fetchTicker();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, activePlatform, debouncedSearch]);

  // Force un rafraîchissement périodique pour que les "il y a X min"
  // restent à jour même sans nouvelle news.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleReact(id, reactionType) {
    const key = reactionKey(id, reactionType);
    if (reactedIds.has(key)) return;
    const next = new Set(reactedIds);
    next.add(key);
    setReactedIds(next);
    saveReactedSet(next);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, reactionCounts: { ...p.reactionCounts, [reactionType]: (p.reactionCounts[reactionType] || 0) + 1 } }
          : p
      )
    );
    const { error } = await supabase.rpc("increment_post_reaction", { post_id: id, reaction_type: reactionType });
    if (error) {
      // en cas d'échec, on annule l'effet optimiste
      next.delete(key);
      setReactedIds(new Set(next));
      saveReactedSet(next);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, reactionCounts: { ...p.reactionCounts, [reactionType]: Math.max(0, (p.reactionCounts[reactionType] || 0) - 1) } }
            : p
        )
      );
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
    await fetchPosts({ append: false });
    await fetchFeatured();
    await fetchTicker();
    closeComposer();
  }

  async function deletePost(id) {
    await supabase.from("posts").delete().eq("id", id);
    await fetchPosts({ append: false });
    await fetchFeatured();
    await fetchTicker();
  }

  const isSearching = searchQuery.trim().length > 0;
  const manuallyFeatured = noFiltersActive ? featuredPost : posts.find((p) => p.featured);
  const featured = isSearching ? null : manuallyFeatured || posts[0];
  const rest = isSearching ? posts : posts.filter((p) => p.id !== featured?.id);
  const draftWords = wordCount(draft.text || "");
  const INK = "var(--ink)";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        fontFamily: "'Poppins', 'Nunito', sans-serif",
        color: "var(--ink)",
        padding: "18px 16px 100px",
        transition: "background 0.2s ease, color 0.2s ease",
        "--bg": theme.bg,
        "--card": theme.card,
        "--ink": theme.ink,
        "--muted": theme.muted,
        "--border": theme.border,
        "--subtle": theme.subtle,
        "--subtleBorder": theme.subtleBorder,
        "--placeholder": theme.placeholder,
        "--reactedBg": theme.reactedBg,
        "--errorBg": theme.errorBg,
        "--dateLine": theme.dateLine,
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
          <button
            onClick={toggleTheme}
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
            aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            title={isDark ? "Mode clair" : "Mode sombre"}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
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
              animation: "scroll-left 42s linear infinite",
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.02em",
              color: "#FFFFFF",
            }}
          >
            {ticker.map((p) => `${TAGS.find((t) => t.id === p.tag)?.emoji || "•"}  ${p.text}`).join("      ")}
            {ticker.length === 0 && "En attente de news..."}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginTop: 16, padding: "0 2px" }}>
          <Search
            size={16}
            color="var(--placeholder)"
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
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 14,
              fontFamily: "'Poppins', sans-serif",
              color: "var(--ink)",
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
                color: "var(--placeholder)",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, padding: "16px 2px 8px", flexWrap: "wrap" }}>
          <FilterPill active={activeFilter === "all"} onClick={() => setActiveFilter("all")} color={INK}>
            Tout
          </FilterPill>
          {TAGS.map((t) => (
            <FilterPill key={t.id} active={activeFilter === t.id} onClick={() => setActiveFilter(t.id)} color={t.color}>
              {t.emoji} {t.label}
            </FilterPill>
          ))}
        </div>
        <div style={{ height: 1, background: "var(--border)", margin: "0 2px" }} />
        <div style={{ display: "flex", gap: 8, padding: "12px 2px 16px", flexWrap: "wrap" }}>
          <FilterPill active={activePlatform === "all"} onClick={() => setActivePlatform("all")} color="var(--muted)">
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
            reactedIds={reactedIds}
            onReact={(type) => handleReact(featured.id, type)}
            onShare={() => handleShare(featured)}
            copied={copiedId === featured.id}
            isAdmin={isAdmin}
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
                  reactedIds={reactedIds}
                  onReact={(type) => handleReact(post.id, type)}
                  onShare={() => handleShare(post)}
                  copied={copiedId === post.id}
                />
              </Fragment>
            );
          })}
        </div>

        {loaded && posts.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", fontWeight: 600, padding: "50px 0" }}>
            {isSearching ? `Aucun résultat pour "${searchQuery.trim()}".` : "Aucune news dans cette catégorie."}
          </div>
        )}

        {hasMore && posts.length > 0 && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                background: "var(--subtle)",
                color: "#7B5CFA",
                border: "none",
                borderRadius: 999,
                padding: "10px 22px",
                fontSize: 13,
                fontWeight: 700,
                cursor: loadingMore ? "default" : "pointer",
                opacity: loadingMore ? 0.7 : 1,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {loadingMore ? "Chargement..." : "Charger plus de news"}
            </button>
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

        <div style={{ textAlign: "center", marginTop: 34, paddingBottom: 6 }}>
          <a
            href="/contact"
            style={{
              fontSize: 12.5,
              color: "var(--muted)",
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Nous contacter
          </a>
        </div>
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
              background: "var(--card)",
              borderRadius: 26,
              padding: "22px 22px 26px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>{editingId ? "Modifier la news" : "Nouvelle news"}</span>
              <button onClick={closeComposer} style={{ background: "var(--subtle)", border: "none", borderRadius: 999, width: 30, height: 30, color: INK, cursor: "pointer" }}>
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
                background: "var(--subtle)",
                border: "2px solid var(--subtleBorder)",
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
            <div style={{ fontSize: 11, fontWeight: 700, color: draftWords > 30 ? "#FF477E" : "var(--muted)", marginTop: 5, textAlign: "right" }}>
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
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                Mettre à la une
              </span>
            </label>
            {draft.featured && (
              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "4px 0 0", fontFamily: "'Poppins', sans-serif" }}>
                Cette news remplacera celle actuellement à la une.
              </p>
            )}

            {saveError && (
              <div style={{ fontSize: 12, color: "#FF477E", fontWeight: 600, marginTop: 10, background: "var(--errorBg)", padding: "8px 10px", borderRadius: 10 }}>
                {saveError}
              </div>
            )}

            <button
              onClick={savePost}
              disabled={!draft.text.trim()}
              style={{
                width: "100%",
                marginTop: 18,
                background: draft.text.trim() ? "linear-gradient(135deg, #FF477E, #7B5CFA)" : "var(--subtleBorder)",
                color: draft.text.trim() ? "#FFFFFF" : "var(--placeholder)",
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

      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        textarea:focus, input:focus { border-color: #7B5CFA !important; }
        ::placeholder { color: var(--placeholder); }
      `}</style>
    </div>
  );
}

const COMMENT_MIN_TIME_MS = 1500;
const COMMENT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes entre deux commentaires
const COMMENT_COOLDOWN_KEY = "jvcut:last-comment-at";

function getCooldownRemaining() {
  try {
    const last = parseInt(window.localStorage.getItem(COMMENT_COOLDOWN_KEY) || "0", 10);
    const remaining = COMMENT_COOLDOWN_MS - (Date.now() - last);
    return remaining > 0 ? remaining : 0;
  } catch (e) {
    return 0;
  }
}

function markCommentPosted() {
  try {
    window.localStorage.setItem(COMMENT_COOLDOWN_KEY, String(Date.now()));
  } catch (e) {
    // ignore
  }
}

function formatCooldown(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes <= 1) return "moins d'une minute";
  return `${totalMinutes} minutes`;
}

function CommentsSection({ postId, isAdmin }) {
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [posting, setPosting] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(0);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    let active = true;
    supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (active && !error && data) setComments(data);
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [postId]);

  useEffect(() => {
    setCooldownMs(getCooldownRemaining());
    const interval = setInterval(() => setCooldownMs(getCooldownRemaining()), 15000);
    return () => clearInterval(interval);
  }, []);

  async function submitComment(e) {
    e.preventDefault();
    if (!content.trim()) return;
    if (getCooldownRemaining() > 0) {
      setCooldownMs(getCooldownRemaining());
      return;
    }
    // Piège à robots + délai minimum, même principe que le formulaire de contact
    if (honeypot.trim() || Date.now() - openedAt.current < COMMENT_MIN_TIME_MS) {
      setContent("");
      return;
    }
    setPosting(true);
    const payload = { post_id: postId, author: authorName.trim() || null, content: content.trim() };
    const { data, error } = await supabase.from("comments").insert(payload).select().single();
    setPosting(false);
    if (!error && data) {
      setComments((prev) => [...prev, data]);
      setContent("");
      markCommentPosted();
      setCooldownMs(COMMENT_COOLDOWN_MS);
    }
  }

  async function deleteComment(id) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("comments").delete().eq("id", id);
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10, fontFamily: "'Poppins', sans-serif" }}>
        {comments.length > 0 ? `${comments.length} commentaire${comments.length > 1 ? "s" : ""}` : "Aucun commentaire"}
      </div>

      {!loaded && <div style={{ fontSize: 12, color: "var(--muted)" }}>Chargement...</div>}

      {comments.map((c) => (
        <div key={c.id} style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
              {c.author || "Anonyme"}{" "}
              <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: 10.5 }}>· {timeAgo(new Date(c.created_at).getTime())}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.35 }}>{c.content}</div>
          </div>
          {isAdmin && (
            <button
              onClick={() => deleteComment(c.id)}
              style={{ background: "none", border: "none", color: "#FF477E", cursor: "pointer", padding: 0, flexShrink: 0 }}
              aria-label="Supprimer ce commentaire"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}

      {cooldownMs > 0 ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "var(--muted)",
            background: "var(--subtle)",
            borderRadius: 10,
            padding: "9px 11px",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          Tu as déjà posté un commentaire récemment. Tu peux en poster un nouveau dans {formatCooldown(cooldownMs)}.
        </div>
      ) : (
        <form onSubmit={submitComment} style={{ marginTop: 10 }}>
          {/* Champ piège invisible, même principe que le formulaire de contact */}
          <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
            <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Ton nom (optionnel)"
            style={{ ...commentInputStyle, marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Écrire un commentaire..."
              style={{ ...commentInputStyle, flex: 1 }}
            />
            <button
              type="submit"
              disabled={posting || !content.trim()}
              style={{
                background: content.trim() ? "linear-gradient(135deg, #FF477E, #7B5CFA)" : "var(--subtleBorder)",
                color: content.trim() ? "#FFFFFF" : "var(--placeholder)",
                border: "none",
                borderRadius: 10,
                padding: "0 14px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: content.trim() ? "pointer" : "default",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Envoyer
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const commentInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--subtle)",
  border: "2px solid var(--subtleBorder)",
  borderRadius: 10,
  color: "var(--ink)",
  fontFamily: "'Poppins', sans-serif",
  fontSize: 12.5,
  fontWeight: 500,
  padding: "9px 11px",
  outline: "none",
};

function FeaturedCard({ post, reactedIds, onReact, onShare, copied, isAdmin }) {
  const [showComments, setShowComments] = useState(false);
  const tagMeta = TAGS.find((t) => t.id === post.tag) || TAGS[0];
  const platMetas = (post.platforms || []).map((id) => PLATFORMS.find((p) => p.id === id)).filter(Boolean);
  return (
    <div
      style={{
        background: "var(--card)",
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
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{timeAgo(post.ts)}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, margin: 0, color: "var(--ink)" }}>{post.text}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <ReactionBar post={post} reactedIds={reactedIds} onReact={onReact} size="normal" />
        <button
          onClick={onShare}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "var(--subtle)",
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
        <button
          onClick={() => setShowComments((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "var(--subtle)",
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
          <MessageCircle size={14} /> {post.commentCount || 0}
        </button>
        {post.source && (
          <a href={post.source} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: "#7B5CFA", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <ExternalLink size={12} /> source
          </a>
        )}
      </div>
      {showComments && <CommentsSection postId={post.id} isAdmin={isAdmin} />}
    </div>
  );
}

function ReactionBar({ post, reactedIds, onReact, size }) {
  const compact = size === "compact";
  return (
    <>
      {REACTIONS.map(({ id, Icon, color }) => {
        const has = reactedIds.has(reactionKey(post.id, id));
        const count = (post.reactionCounts && post.reactionCounts[id]) || 0;
        return (
          <button
            key={id}
            onClick={() => onReact(id)}
            disabled={has}
            style={{
              display: "flex",
              alignItems: "center",
              gap: compact ? 3 : 5,
              background: has ? color + "26" : "var(--subtle)",
              border: has ? `1.5px solid ${color}` : "1.5px solid transparent",
              borderRadius: 999,
              padding: compact ? "2.5px 7px" : "5.5px 11px",
              fontSize: compact ? 11 : 13,
              fontWeight: 700,
              color: has ? color : "var(--muted)",
              cursor: has ? "default" : "pointer",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <Icon size={compact ? 12 : 14} strokeWidth={has ? 2.5 : 2} /> {count}
          </button>
        );
      })}
    </>
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
      <div style={{ flex: 1, height: 1, background: "var(--dateLine)" }} />
      <span
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.06em",
          color: "var(--muted)",
          background: "var(--bg)",
          padding: "3px 12px",
          borderRadius: 999,
        }}
      >
        {label.toUpperCase()}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--dateLine)" }} />
    </div>
  );
}

function TileCard({ post, expanded, onToggleExpand, onEdit, onDelete, isAdmin, reactedIds, onReact, onShare, copied }) {
  const tagMeta = TAGS.find((t) => t.id === post.tag) || TAGS[0];
  const platMetas = (post.platforms || []).map((id) => PLATFORMS.find((p) => p.id === id)).filter(Boolean);
  const myWords = wordCount(post.text);
  const isLong = myWords > TILE_TRUNCATE_WORDS;
  const showFull = expanded || !isLong;
  return (
    <div
      style={{
        background: "var(--card)",
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
          color: "var(--ink)",
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
        <ReactionBar post={post} reactedIds={reactedIds} onReact={onReact} size="compact" />
        <button
          onClick={onShare}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: "var(--subtle)",
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
        <button
          onClick={onToggleExpand}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: "var(--subtle)",
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
          <MessageCircle size={11} /> {post.commentCount || 0}
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
      {expanded && <CommentsSection postId={post.id} isAdmin={isAdmin} />}
    </div>
  );
}

function FilterPill({ active, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: active ? color : "var(--card)",
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
  color: "var(--muted)",
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
  background: "var(--subtle)",
  border: "2px solid var(--subtleBorder)",
  borderRadius: 12,
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 500,
  padding: "11px 13px",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "'Poppins', sans-serif",
};
