import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/useAuth";

const SLOT_COUNT = 6;

const createEmptySlots = () =>
  Array.from({ length: SLOT_COUNT }, (_, idx) => ({
    id: `slot-${idx + 1}`,
    label: `Slot ${idx + 1}`,
    payload: null,
    path: null,
    icon: null
  }));

const defaultProfile = {
  id: "profile-1",
  name: "Profile 1",
  slots: createEmptySlots(),
  lastSync: 0
};

export default function DeckPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [profiles, setProfiles] = useState([defaultProfile]);
  const [activeProfileId, setActiveProfileId] = useState(defaultProfile.id);
  const [activeSlot, setActiveSlot] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [profileDraft, setProfileDraft] = useState("");
  const [dropError, setDropError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [dragPreview, setDragPreview] = useState(null);
  const dragPreviewSeq = useRef(0);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  const lastSyncLabel = activeProfile?.lastSync
    ? new Date(activeProfile.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "No sync yet";

  useEffect(() => {
    localStorage.setItem("tapdeck_connected", "true");

    // Prevent Electron from navigating when files are dropped outside a slot.
    const stop = (e) => {
      const target = e.target;
      const isSlot = typeof target?.closest === "function" && target.closest(".deck-cell");
      if (!isSlot) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("dragover", stop, false);
    window.addEventListener("drop", stop, false);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("tapdeck_profiles");
    if (!stored) {
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        setProfiles(parsed);
        setActiveProfileId(parsed[0]?.id || defaultProfile.id);
      }
    } catch (_) {
      setProfiles([defaultProfile]);
      setActiveProfileId(defaultProfile.id);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("tapdeck_profiles", JSON.stringify(profiles));
  }, [profiles, hydrated]);

  useEffect(() => {
    if (!activeProfile) return;
    pushDeckUpdate(activeProfile.slots);
  }, [activeProfileId, profiles]);

  async function handleDrop(event, slotId) {
    event.preventDefault();
    event.stopPropagation();
    const dropData = extractDropData(event);
    const names = dropData.names;

    if (!names.length) {
      setDropError("Drop not recognized. Try dragging the app bundle (.app) from Finder.");
      setActiveSlot(null);
      return;
    }

    const name = names[0];
    const filePath = dropData.path || null;
    const icon = await resolveDropIcon(filePath, name);
    const timestamp = Date.now();
    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === activeProfileId
          ? {
              ...profile,
              slots: (Array.isArray(profile.slots) ? profile.slots : createEmptySlots()).map((slot) =>
                slot.id === slotId
                  ? { ...slot, payload: name.replace(/\.[^/.]+$/, ""), path: filePath, icon }
                  : slot
              ),
              lastSync: timestamp
            }
          : profile
      )
    );
    setActiveSlot(null);
    setDragPreview(null);
    setDropError("");
  }

  async function resolveDropIcon(filePath, name) {
    const isApp = (name || "").trim().toLowerCase().endsWith(".app");
    const fallback = isApp ? null : (name || "").trim().charAt(0).toUpperCase() || null;
    if (typeof window === "undefined") return fallback;
    const resolver = window.tapdeck?.getFileIconDataUrl;
    if (typeof resolver !== "function") return fallback;
    try {
      const request = { path: filePath, name };
      console.log("[tapdeck] icon request", request);
      if (filePath || name) {
        const iconDataUrl = await resolver(request);
        console.log("[tapdeck] icon response", {
          ok: Boolean(iconDataUrl),
          length: iconDataUrl ? iconDataUrl.length : 0
        });
        if (iconDataUrl) return iconDataUrl;
      }
      return fallback;
    } catch (_) {
      console.log("[tapdeck] icon request failed");
      return fallback;
    }
  }

  async function primeDragPreview(event, slotId) {
    if (!event?.dataTransfer) return;
    if (dragPreview?.slotId === slotId) return;

    const dropData = extractDropData(event);
    if (!dropData.names.length) return;

    const name = dropData.names[0] || "";
    const filePath = dropData.path || null;
    const seq = ++dragPreviewSeq.current;
    setDragPreview({ slotId, name, icon: null });

    const icon = await resolveDropIcon(filePath, name);
    if (dragPreviewSeq.current !== seq) return;
    setDragPreview({ slotId, name, icon });
  }

  function handleDragOver(event, slotId) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setActiveSlot(slotId);
    primeDragPreview(event, slotId);
  }

  function handleDragEnter(event, slotId) {
    handleDragOver(event, slotId);
  }

  function handleDragLeave() {
    setActiveSlot(null);
    setDragPreview(null);
  }

  function clearSlots() {
    if (!activeProfile) return;
    const emptySlots = createEmptySlots();
    const timestamp = Date.now();
    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === activeProfileId ? { ...profile, slots: emptySlots, lastSync: timestamp } : profile
      )
    );
  }

  function goHome() {
    localStorage.setItem("tapdeck_connected", "false");
    router.push("/");
  }

  function addProfile() {
    const newProfile = {
      id: `profile-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name: "New profile",
      slots: createEmptySlots(),
      lastSync: 0
    };
    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    setEditingProfileId(newProfile.id);
    setProfileDraft(newProfile.name);
    setActiveSlot(null);
    setDropError("");
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function selectProfile(id) {
    setActiveProfileId(id);
    setActiveSlot(null);
    setDropError("");
    setDragPreview(null);
    setEditingProfileId(null);
  }

  function deleteProfile(id) {
    setProfiles((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((profile) => profile.id !== id);
      const nextList = filtered.length ? filtered : [defaultProfile];
      const nextActiveId = activeProfileId === id ? nextList[0].id : activeProfileId;
      setActiveProfileId(nextActiveId);
      return nextList;
    });
    setActiveSlot(null);
    setDropError("");
    setDragPreview(null);
    setEditingProfileId(null);
  }

  function startProfileRename(profile) {
    setEditingProfileId(profile.id);
    setProfileDraft(profile.name || "");
  }

  function updateProfileName(profileId, nextName) {
    const name = (nextName || "").trim() || "Untitled profile";
    setProfiles((prev) =>
      prev.map((profile) => (profile.id === profileId ? { ...profile, name } : profile))
    );
  }

  function finishProfileRename(profile) {
    updateProfileName(profile.id, profileDraft);
    setEditingProfileId(null);
  }

  function pushDeckUpdate(current = null) {
    if (!window.tapdeck?.updateDeck) return;
    const slotsToSend = current || activeProfile?.slots || createEmptySlots();
    const mapSlot = (slot) => ({
      label: slot.label,
      name: slot.payload,
      path: slot.path,
      icon: slot.icon
    });

    const payload = slotsToSend.map(mapSlot);
    const profilePayload = profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      slots: (profile.slots || createEmptySlots()).map(mapSlot)
    }));

    window.tapdeck.updateDeck({
      slots: payload,
      activeProfileId: activeProfileId,
      activeProfileName: activeProfile?.name,
      profiles: profilePayload
    });
  }

  return (
    <div className="app-shell">
      <div className="container deck-layout">
        <div className="card hero-card">
          <div className="hero-left">
            <div className="pill">
              <span>Mobile connected</span>
            </div>
            <h1 className="title">Deck workspace</h1>
            <p className="subtitle">
              Drop apps into the small squares. Each drop mirrors the slot to your TapDeck mobile app.
            </p>
            <div className="status-row">
              <span className="status-chip online">Connected</span>
              <span className="status-chip soft">Profile: {activeProfile?.name || "Profile 1"}</span>
              <span className="status-chip soft">Last sync: {lastSyncLabel}</span>
            </div>
            {dropError && <p className="subtitle" style={{ color: "#f7d774", margin: 0 }}>{dropError}</p>}
          </div>
          <div className="hero-actions">
            <button className="button ghost" onClick={goHome}>Back home</button>
            <button className="button primary" onClick={clearSlots}>Clear slots</button>
            <button className="button ghost" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>

        <div className="card grid-card">
          <div className="profile-bar">
            <div className="pill" style={{ background: "rgba(108, 123, 255, 0.12)", borderColor: "rgba(108, 123, 255, 0.35)" }}>
              Drop targets
            </div>
            <div className="profile-tabs">
              {profiles.map((profile) => (
                <div className="profile-tab" key={profile.id}>
                  {editingProfileId === profile.id ? (
                    <input
                      className="profile-input"
                      value={profileDraft}
                      onChange={(e) => setProfileDraft(e.target.value)}
                      onBlur={() => finishProfileRename(profile)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          finishProfileRename(profile);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingProfileId(null);
                          setProfileDraft(profile.name || "");
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      className={`profile-chip ${profile.id === activeProfileId ? "active" : ""}`}
                      onClick={() => selectProfile(profile.id)}
                      onDoubleClick={() => startProfileRename(profile)}
                    >
                      {profile.name}
                    </button>
                  )}
                  {profiles.length > 1 && (
                    <button
                      className="profile-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProfile(profile.id);
                      }}
                      aria-label={`Delete ${profile.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button className="profile-chip add" onClick={addProfile}>+ New profile</button>
            </div>
          </div>
          <h2 className="section-title">Small squares for quick placement</h2>
          <p className="subtitle">
            Drag from Finder or Launchpad. Each square accepts a drop. Profiles keep separate sets of six slots.
          </p>

          <div className="deck-grid">
            {(activeProfile?.slots || []).map((slot) => (
              <div
                key={slot.id}
                className={`deck-cell ${activeSlot === slot.id ? "active" : ""} ${slot.payload ? "filled" : ""}`}
                onDrop={(e) => handleDrop(e, slot.id)}
                onDragOver={(e) => handleDragOver(e, slot.id)}
                onDragEnter={(e) => handleDragEnter(e, slot.id)}
                onDragLeave={handleDragLeave}
              >
                <div className="deck-cell__label">{slot.label}</div>
              <div className="deck-cell__icon">
                  {activeSlot === slot.id && dragPreview?.slotId === slot.id && dragPreview?.icon ? (
                    dragPreview.icon.startsWith("data:image") ? (
                      <img src={dragPreview.icon} alt={`${dragPreview.name || slot.label} icon`} />
                    ) : (
                      <span>{dragPreview.icon}</span>
                    )
                  ) : typeof slot.icon === "string" && slot.icon.startsWith("data:image") ? (
                    <img src={slot.icon} alt={`${slot.payload || slot.label} icon`} />
                  ) : (
                    <span>{slot.icon || ""}</span>
                  )}
                </div>
                <div className="deck-cell__payload">
                  {activeSlot === slot.id && dragPreview?.slotId === slot.id && dragPreview?.name
                    ? dragPreview.name
                    : slot.payload || "Drop app here"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function extractDropData(event) {
  const dt = event.dataTransfer;
  if (!dt) return { names: [], path: null };

  const itemFile = extractFileFromItems(dt.items);
  if (itemFile) {
    console.log("[tapdeck] drop items file", { name: itemFile.name, path: itemFile.path });
    return {
      names: [itemFile.name].filter(Boolean),
      path: itemFile.path || null
    };
  }

  const files = Array.from(dt.files || []);
  if (files.length) {
    console.log("[tapdeck] drop files", files.map((file) => ({ name: file.name, path: file.path })));
    return {
      names: files.map((f) => f.name).filter(Boolean),
      path: files[0]?.path || null
    };
  }

  const uriList = dt.getData && dt.getData("text/uri-list");
  if (uriList) {
    console.log("[tapdeck] drop uri-list", uriList);
    const lines = uriList.split("\n").filter((line) => line && !line.startsWith("#"));
    const names = lines
      .map((uri) => {
        try {
          const url = new URL(uri);
          return decodeURIComponent(url.pathname.split("/").pop() || "");
        } catch (_) {
          return uri.split("/").pop() || uri;
        }
      })
      .filter(Boolean);
    const path = extractPathFromUri(lines[0]);
    return { names, path };
  }

  const plain = dt.getData && dt.getData("text/plain");
  if (plain) {
    console.log("[tapdeck] drop text/plain", plain);
    return { names: [plain.split("/").pop() || plain], path: null };
  }

  return { names: [], path: null };
}

function extractFileFromItems(items) {
  const list = Array.from(items || []);
  for (const item of list) {
    if (item.kind === "file" && typeof item.getAsFile === "function") {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

function extractPathFromUri(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "file:") {
      return decodeURIComponent(url.pathname);
    }
    return null;
  } catch (_) {
    return null;
  }
}
