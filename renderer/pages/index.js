import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/useAuth";

const palette = [
  { color: "#a3c7ff", glow: "rgba(163, 199, 255, 0.28)" },
  { color: "#8ce7c0", glow: "rgba(140, 231, 192, 0.26)" },
  { color: "#f7d774", glow: "rgba(247, 215, 116, 0.24)" },
  { color: "#f79ac0", glow: "rgba(247, 154, 192, 0.2)" },
  { color: "#c1a6ff", glow: "rgba(193, 166, 255, 0.28)" }
];

const seededApps = [
  { id: "figma", name: "Figma", tag: "Design board", color: palette[0].color, glow: palette[0].glow },
  { id: "spotify", name: "Spotify", tag: "Media control", color: palette[1].color, glow: palette[1].glow },
  { id: "notion", name: "Notion", tag: "Docs & notes", color: palette[2].color, glow: palette[2].glow },
  { id: "chrome", name: "Chrome", tag: "Browser", color: palette[3].color, glow: palette[3].glow },
  { id: "terminal", name: "Terminal", tag: "Automation", color: palette[4].color, glow: palette[4].glow }
];

export default function Home() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [apps, setApps] = useState(seededApps);
  const [isDragging, setIsDragging] = useState(false);
  const [lastSync, setLastSync] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("tapdeck_connected") === "true";
    setIsConnected(stored);
  }, []);

  useEffect(() => {
    if (!window.tapdeck?.onPaired) return;
    const off = window.tapdeck.onPaired(() => {
      localStorage.setItem("tapdeck_connected", "true");
      setIsConnected(true);
      router.push("/deck");
    });
    return () => off && off();
  }, [router]);


  useEffect(() => {
    if (isConnected) {
      router.push("/deck");
    }
  }, [isConnected, router]);

  const lastSyncLabel = useMemo(() => {
    if (!lastSync) return "Waiting for first sync";
    const date = new Date(lastSync);
    return `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [lastSync]);

  function createTileFromName(name = "New shortcut") {
    const baseName = name.replace(/\.[^/.]+$/, "") || "New shortcut";
    const swatch = palette[Math.floor(Math.random() * palette.length)];

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name: baseName,
      tag: "Just added",
      color: swatch.color,
      glow: swatch.glow
    };
  }

  function handleDrop(event) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    const fresh = files.map((file) => createTileFromName(file.name));

    if (!fresh.length) {
      setIsDragging(false);
      return;
    }

    setApps((prev) => [...fresh, ...prev].slice(0, 16));
    setLastSync(Date.now());
    setIsDragging(false);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function goToDeck() {
    localStorage.setItem("tapdeck_connected", "true");
    setIsConnected(true);
    router.push("/deck");
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="app-shell">
      <div className="container deck-layout">
        <div className="card hero-card">
          <div className="hero-left">
            <div className="pill">
              <span>Desktop Companion</span>
            </div>
            <h1 className="title">TapDeck Desktop</h1>
            <p className="subtitle">
              Drag your apps or shortcuts into the deck. We keep the desktop and phone in perfect sync.
            </p>
            <div className="status-row">
              <span className="status-chip online">Live to mobile</span>
            </div>
          </div>
          <div className="hero-actions">
            <a href="/pairing" className="button ghost">Pair another phone</a>
            <button className="button primary" onClick={goToDeck}>
              {isConnected ? "Go to my deck" : "Open deck (connected)"}
            </button>
            <button className="button ghost" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>

        <div className="deck-panels">
          <div className="card drop-card">
            <div className="pill" style={{ background: "rgba(108, 123, 255, 0.12)", borderColor: "rgba(108, 123, 255, 0.35)" }}>
              Connection status
            </div>
            <h2 className="section-title">Ready to mirror to mobile</h2>
            <p className="subtitle">
              Pair once, then jump into the deck workspace. If you’re already paired, you’ll be redirected automatically.
            </p>

            <div className={`dropzone ${isDragging ? "active" : ""}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
              <div className="drop-cta">
                <div className="drop-dot" />
                <div>
                  <div className="drop-title">Quick check</div>
                  <div className="drop-subtitle">
                    We detected {isConnected ? "an active mobile session" : "no mobile session yet"}. Drop a file to refresh status.
                  </div>
                </div>
              </div>
              <div className="drop-hint">Drop anything to update sync timestamp: {lastSyncLabel}</div>
            </div>

            <div className="sync-row">
              <span className={`status-chip ${isConnected ? "online" : ""}`}>
                {isConnected ? "Mobile connected" : "Waiting for mobile"}
              </span>
              <button className="button ghost" onClick={goToDeck}>
                {isConnected ? "Open deck" : "Skip & open deck"}
              </button>
            </div>
          </div>

          <div className="card mobile-card">
            <div className="pill" style={{ background: "rgba(41, 212, 166, 0.1)", borderColor: "rgba(41, 212, 166, 0.4)" }}>
              What’s inside the deck
            </div>
            <h3 style={{ margin: "12px 0 6px", color: "var(--text-primary)" }}>Small squares ready for drops</h3>
            <p className="subtitle">Each square is a slot. Drag an app onto a slot to mirror it on mobile.</p>

            <div className="slot-preview">
              <div className="slot-row">
                <div className="slot-sim" />
                <div className="slot-sim active" />
                <div className="slot-sim" />
                <div className="slot-sim" />
              </div>
              <div className="slot-row">
                <div className="slot-sim" />
                <div className="slot-sim" />
                <div className="slot-sim active" />
                <div className="slot-sim" />
              </div>
            </div>

            <div className="tile-grid">
              {apps.slice(0, 3).map((app) => (
                <div
                  className="app-tile"
                  key={app.id}
                  style={{
                    borderColor: app.color,
                    boxShadow: `0 14px 28px ${app.glow}`,
                    background: `linear-gradient(135deg, rgba(255,255,255,0.05), ${app.glow})`
                  }}
                >
                  <div className="app-tile__top">
                    <div className="app-dot" style={{ background: app.color }} />
                    <span className="app-tag">{app.tag}</span>
                  </div>
                  <div className="app-name">{app.name}</div>
                  <div className="app-meta">
                    <span className="sync-pill">Slot ready</span>
                    <span className="ghost-text">drag to place</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
