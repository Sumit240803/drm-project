"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedKey = key.trim();

    if (!normalizedEmail || !trimmedKey) {
      setStatus("Please enter both your email and access key.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, key: trimmedKey }),
      });

      if (res.ok) {
        router.push("/watch");
        return;
      }
      if (res.status === 401) {
        setStatus("Invalid email or access key.");
      } else if (res.status === 403) {
        setStatus("This access key has expired.");
      } else {
        setStatus("Something went wrong. Please try again.");
      }
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          background: "#171a21",
          padding: "1.5rem",
          borderRadius: 8,
          border: "1px solid #262b36",
        }}
      >
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
          Watch Protected Video
        </h1>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.85rem" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.85rem" }}>Access Key</span>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={busy} style={buttonStyle}>
          {busy ? "Checking…" : "Submit"}
        </button>

        <p
          aria-live="polite"
          style={{
            minHeight: "1.2em",
            margin: 0,
            fontSize: "0.85rem",
            color: "#ff7676",
          }}
        >
          {status}
        </p>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.6rem",
  borderRadius: 6,
  border: "1px solid #2e3440",
  background: "#0f1115",
  color: "#e8e8e8",
  fontSize: "1rem",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.6rem",
  borderRadius: 6,
  border: "none",
  background: "#3b82f6",
  color: "#fff",
  fontSize: "1rem",
  cursor: "pointer",
  marginTop: "0.25rem",
};
