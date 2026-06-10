"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

interface OtpData {
  otp: string;
  playbackInfo: string;
  ip: string;
}

// Minimal typings for VdoCipher's player API (loaded from their CDN).
type VdoVideo = { play?: () => void; pause?: () => void };
type VdoPlayerInstance = { video?: VdoVideo };
declare global {
  interface Window {
    VdoPlayer?: { getInstance: (el: HTMLIFrameElement) => VdoPlayerInstance };
  }
}

const VDO_API_SRC = "https://player.vdocipher.com/playerAssets/1/vdo.js";

export default function WatchClient({ email }: { email: string }) {
  const router = useRouter();
  const [otp, setOtp] = useState<OtpData | null>(null);
  const [error, setError] = useState("");
  const [obscured, setObscured] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [wm, setWm] = useState({ top: "12%", left: "8%", time: "" });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<VdoPlayerInstance | null>(null);

  // Fetch a fresh short-lived OTP from the guarded server route.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/vdo-otp", { method: "POST" });
        if (res.status === 401) {
          router.push("/");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError("Could not load the video. Please try again.");
          return;
        }
        const data = (await res.json()) as OtpData;
        if (!cancelled) setOtp(data);
      } catch {
        if (!cancelled) setError("Network error loading the video.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Deterrents: when the page is hidden or loses focus, pause the player and
  // black out the video. A recording captured while the viewer multitasks then
  // gets a paused, black frame — and they must keep the tab focused/foreground
  // the whole time. (Clicking the player moves focus INTO the iframe, which
  // fires a parent-window blur; we ignore that case via the activeElement check
  // so normal play/pause doesn't trip it.)
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const obscure = () => {
      setObscured(true);
      try {
        playerRef.current?.video?.pause?.();
      } catch {
        /* best-effort */
      }
    };
    const reveal = () => setObscured(false);

    const onVisibility = () => (document.hidden ? obscure() : reveal());
    const onBlur = () => {
      // activeElement updates after the event, so defer the check.
      setTimeout(() => {
        if (document.activeElement?.tagName === "IFRAME") return;
        obscure();
      }, 0);
    };
    const onFocus = () => reveal();

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Session heartbeat: poll the server so this device is kicked out the moment
  // its session is revoked — e.g. the same key logs in on another device, which
  // rotates the sid. Without this, a stale device keeps playing until reload.
  useEffect(() => {
    let stop = false;

    const check = async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!stop && res.status === 401) {
          stop = true;
          try {
            playerRef.current?.video?.pause?.();
          } catch {
            /* best-effort */
          }
          setKicked(true);
          setTimeout(() => router.push("/"), 3000);
        }
      } catch {
        /* ignore transient network errors — only an explicit 401 kicks */
      }
    };

    const id = setInterval(check, 10000);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  // App-level moving watermark: an overlay WE own (independent of VdoCipher's
  // in-player watermark), so the viewer can't disable it and any recording
  // catches it. Repositions every few seconds and stamps the current time.
  useEffect(() => {
    const move = () => {
      const top = Math.floor(6 + Math.random() * 78);
      const left = Math.floor(4 + Math.random() * 66);
      setWm({ top: `${top}%`, left: `${left}%`, time: new Date().toLocaleString() });
    };
    move();
    const id = setInterval(move, 3000);
    return () => clearInterval(id);
  }, []);

  // Load VdoCipher's player API and grab the instance so we can pause it.
  useEffect(() => {
    if (!otp) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || playerRef.current || !iframeRef.current || !window.VdoPlayer) {
        return;
      }
      try {
        playerRef.current = window.VdoPlayer.getInstance(iframeRef.current);
      } catch {
        /* pause becomes a no-op; black overlay still works */
      }
    };

    if (window.VdoPlayer) {
      init();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${VDO_API_SRC}"]`
      );
      if (existing) {
        existing.addEventListener("load", init);
      } else {
        const s = document.createElement("script");
        s.src = VDO_API_SRC;
        s.async = true;
        s.onload = init;
        document.body.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [otp]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  }

  const watermarkText = otp ? `${email} · ${otp.ip} · ${wm.time}` : email;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1.5rem 1rem",
        gap: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <span style={{ fontSize: "0.85rem", color: "#9aa3b2" }}>
          Signed in as {email}
        </span>
        <button
          onClick={logout}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: 6,
            border: "1px solid #2e3440",
            background: "#171a21",
            color: "#e8e8e8",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <div
        role="note"
        style={{
          width: "100%",
          maxWidth: 900,
          boxSizing: "border-box",
          padding: "0.7rem 0.9rem",
          borderRadius: 8,
          border: "1px solid #5a3a1a",
          background: "#241a10",
          color: "#e7c08a",
          fontSize: "0.82rem",
          lineHeight: 1.45,
        }}
      >
        ⚠️ <strong>This session is monitored and traceable.</strong> Your email{" "}
        <strong>{email}</strong>
        {otp?.ip ? (
          <>
            {" "}and IP address <strong>{otp.ip}</strong>
          </>
        ) : null}{" "}
        are embedded as a visible watermark across this video. Any recording,
        screenshot, or redistribution can be traced directly back to you.
      </div>

      <div style={{ width: "100%", maxWidth: 900 }}>
        {error ? (
          <p style={{ color: "#ff7676" }}>{error}</p>
        ) : otp ? (
          <div
            style={{ position: "relative", width: "100%", overflow: "hidden" }}
          >
            <iframe
              ref={iframeRef}
              src={`https://player.vdocipher.com/v2/?otp=${encodeURIComponent(
                otp.otp
              )}&playbackInfo=${encodeURIComponent(otp.playbackInfo)}`}
              allow="encrypted-media"
              allowFullScreen
              style={{ border: 0, width: "100%", height: "60vh", display: "block" }}
            />

            {/* App-level moving watermark (overlay we control). */}
            <div
              aria-hidden
              style={{
                ...watermarkStyle,
                top: wm.top,
                left: wm.left,
              }}
            >
              {watermarkText}
            </div>

            {/* Black-out shown when the page is hidden / unfocused. */}
            {obscured && !kicked ? (
              <div style={obscureStyle}>
                Playback paused — return to this tab to continue.
              </div>
            ) : null}

            {/* Shown when this session is revoked (key used on another device). */}
            {kicked ? (
              <div style={obscureStyle}>
                You’ve been signed out because this access key was opened on
                another device. Redirecting…
              </div>
            ) : null}
          </div>
        ) : (
          <p style={{ color: "#9aa3b2" }}>Loading video…</p>
        )}
      </div>
    </main>
  );
}

const watermarkStyle: CSSProperties = {
  position: "absolute",
  pointerEvents: "none",
  userSelect: "none",
  whiteSpace: "nowrap",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "rgba(255,255,255,0.55)",
  textShadow: "0 0 4px rgba(0,0,0,0.9)",
  transition: "top 0.6s ease, left 0.6s ease",
  zIndex: 5,
};

const obscureStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "#000",
  color: "#9aa3b2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "1rem",
  fontSize: "0.9rem",
  zIndex: 10,
};
