import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const routeTitles = {
  "/": "Home",
  "/deck": "Deck workspace",
  "/pairing": "Pairing",
  "/login": "Sign in",
  "/trial-expired": "Trial status"
};

export default function TitleBar() {
  const router = useRouter();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const controls = typeof window !== "undefined" ? window.tapdeck?.windowControls : null;
    if (!controls) return undefined;

    let mounted = true;
    controls.isMaximized().then((state) => {
      if (mounted) setIsMaximized(Boolean(state));
    });
    const off = controls.onWindowState((state) => {
      if (mounted) setIsMaximized(Boolean(state));
    });

    return () => {
      mounted = false;
      if (typeof off === "function") off();
    };
  }, []);

  const controls = typeof window !== "undefined" ? window.tapdeck?.windowControls : null;
  const routeTitle = routeTitles[router.pathname] || "TapDeck Desktop";

  return (
    <div className="titlebar">
      <div className="titlebar__drag">
        <div className="titlebar__brand">
          <span className="titlebar__dot" />
          <span className="titlebar__name">TapDeck Desktop</span>
        </div>
        <div className="titlebar__route">{routeTitle}</div>
      </div>
      <div className="titlebar__controls">
        <button
          className="window-btn"
          onClick={() => controls?.minimize?.()}
          aria-label="Minimize window"
        >
          _
        </button>
        <button
          className={`window-btn ${isMaximized ? "restore" : "maximize"}`}
          onClick={() => controls?.toggleMaximize?.()}
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
        />
        <button
          className="window-btn close"
          onClick={() => controls?.close?.()}
          aria-label="Close window"
        >
          x
        </button>
      </div>
    </div>
  );
}
