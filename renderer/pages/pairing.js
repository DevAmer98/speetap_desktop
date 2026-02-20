import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/useAuth";

export default function PairingPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [qr, setQR] = useState("");
  const [pin, setPin] = useState("");
  const goHome = () => router.push("/");

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  useEffect(() => {
    if (!window.tapdeck?.getPairingData) return;
    window.tapdeck.getPairingData().then((data) => {
      setQR(data.qr);
      setPin(data.pin);
    });
  }, []);

  useEffect(() => {
    if (!window.tapdeck?.onPaired) return;
    const off = window.tapdeck.onPaired(() => {
      localStorage.setItem("tapdeck_connected", "true");
      router.push("/deck");
    });
    return () => off && off();
  }, [router]);

  return (
    <div className="app-shell">
      <div className="container">
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <button className="button ghost" onClick={goHome}>Back</button>
            <div className="pill" style={{ background: "rgba(108,123,255,0.12)", borderColor: "rgba(108,123,255,0.35)" }}>
              Pair your phone
            </div>
            <button className="button ghost" onClick={handleSignOut}>Sign out</button>
          </div>
          <h1 className="title" style={{ marginTop: 12 }}>Scan QR code</h1>
          <p className="subtitle" style={{ maxWidth: 600 }}>
            Point your phone at this QR code using the TapDeck mobile app, then enter the PIN to finish pairing.
          </p>
        </div>

        <div className="qr-wrap">
          <div className="card qr-card">
            {qr ? (
              <>
                <div style={{ padding: 14, display: "flex", justifyContent: "center" }}>
                  <div style={{ padding: 12, background: "var(--surface)", borderRadius: 24, border: "1px solid var(--stroke)" }}>
                    <img src={qr} width={240} height={240} alt="Pairing QR" />
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
                  <div className="pin-pill">
                    <span style={{ opacity: 0.8 }}>PIN</span>
                    <span>{pin}</span>
                  </div>
                </div>
                <p className="hint" style={{ marginTop: 10 }}>Keep this window open until your phone confirms pairing.</p>
              </>
            ) : (
              <p className="subtitle">Generating pairing data…</p>
            )}
          </div>

          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div className="pill" style={{ background: "rgba(41,212,166,0.1)", borderColor: "rgba(41,212,166,0.4)" }}>
              How it works
            </div>
            <Step title="Open TapDeck Mobile" desc="From the Connect screen, tap “Find my TapDeck” and scan this QR." />
            <Step title="Enter PIN" desc="Type the 6-digit PIN shown here when prompted on your phone." />
            <Step title="Stay on same Wi‑Fi" desc="Both devices should be on the same local network for fastest discovery." />
            <Step title="Done" desc="You’ll see “pairing successfully” on mobile when the handshake completes." />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ title, desc }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--stroke)" }}>
      <h3 style={{ margin: 0, color: "var(--text-primary)" }}>{title}</h3>
      <p className="subtitle" style={{ margin: "6px 0 0" }}>{desc}</p>
    </div>
  );
}
