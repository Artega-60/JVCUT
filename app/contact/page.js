"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

const INK = "#1E1B4B";
const MIN_FILL_TIME_MS = 2500; // en dessous, très probablement un robot

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // champ piège invisible pour les robots
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const loadedAt = useRef(Date.now());

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;

    // Piège à robots : ce champ est invisible pour un humain, donc s'il est
    // rempli, c'est qu'un script l'a fait automatiquement. On fait
    // semblant que tout s'est bien passé, sans rien enregistrer.
    if (website.trim()) {
      setSent(true);
      return;
    }

    // Un formulaire rempli en moins de 2,5 secondes est presque toujours
    // un envoi automatisé plutôt qu'une vraie personne qui tape.
    if (Date.now() - loadedAt.current < MIN_FILL_TIME_MS) {
      setSent(true);
      return;
    }

    setSending(true);
    setError("");
    const { error: insertError } = await supabase.from("contact_messages").insert({
      name: name.trim() || null,
      email: email.trim(),
      message: message.trim(),
    });
    setSending(false);
    if (insertError) {
      setError("Le message n'a pas pu être envoyé. Réessaie dans un instant.");
      return;
    }
    setSent(true);
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
          maxWidth: 420,
          background: "#FFFFFF",
          borderRadius: 22,
          padding: "26px 24px 28px",
          boxShadow: "0 24px 60px rgba(30,27,75,0.12)",
        }}
      >
        <a href="/" style={{ fontSize: 12, color: "#9A8F84", textDecoration: "none", fontWeight: 600 }}>
          ← Retour au site
        </a>

        {sent ? (
          <div style={{ textAlign: "center", padding: "30px 0 10px" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚡</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Message envoyé !</div>
            <div style={{ fontSize: 13.5, color: "#9A8F84" }}>Merci, on te répond dès que possible.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontWeight: 800, fontSize: 19, marginTop: 14, marginBottom: 4 }}>Nous contacter</div>
            <div style={{ fontSize: 13, color: "#9A8F84", marginBottom: 18 }}>
              Une question, une info à nous signaler, une remarque ? Écris-nous.
            </div>

            {/* Champ piège : invisible et inaccessible pour un humain, mais
                que la plupart des robots remplissent automatiquement. */}
            <div
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
            >
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ton nom (optionnel)"
              style={inputStyle}
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ton email"
              style={{ ...inputStyle, marginTop: 10 }}
            />
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ton message..."
              rows={5}
              style={{ ...inputStyle, marginTop: 10, resize: "none" }}
            />

            {error && (
              <div style={{ fontSize: 12, color: "#FF477E", fontWeight: 600, marginTop: 10 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={sending}
              style={{
                width: "100%",
                marginTop: 16,
                background: "linear-gradient(135deg, #FF477E, #7B5CFA)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 12,
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 700,
                cursor: sending ? "default" : "pointer",
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? "Envoi..." : "Envoyer"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "#F7F3FF",
  border: "2px solid #EDE5FA",
  borderRadius: 12,
  color: INK,
  fontFamily: "'Poppins', sans-serif",
  fontSize: 14,
  fontWeight: 500,
  padding: "11px 13px",
  outline: "none",
};
