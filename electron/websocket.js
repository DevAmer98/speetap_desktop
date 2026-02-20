const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { getPairing, clearPairing, addTrustedToken, isTrustedToken } = require("./pairingStore");

let pairedDevices = [];
let deckState = {
  activeProfileId: "profile-1",
  activeProfileName: "Profile 1",
  profiles: [],
  slots: Array.from({ length: 6 }, (_, idx) => ({
    label: `Slot ${idx + 1}`,
    name: null,
    path: null,
    icon: null
  }))
};
const deckStateDir =
  process.env.TAPDECK_STATE_DIR || path.join(os.tmpdir(), "tapdeck-state");
const deckStateFile =
  process.env.TAPDECK_STATE_FILE || path.join(deckStateDir, "deck-state.json");

loadDeckStateFromDisk();

function createWebSocketServer(onPairCallback) {
  const wss = new WebSocket.Server({ port: 5173 });

  console.log("WS Server Running on :5173");

  wss.on("connection", (socket) => {
    socket.on("message", (msg) => {
      const data = JSON.parse(msg.toString());

      if (data.type === "pair_request") {
        socket.token = data.token;
      }

      if (data.type === "pair_verify") {
        const token = data.token || socket.token;
        const pairing = getPairing(token);
        const pinMatches = pairing && data.pin === pairing.pin;

        if (pinMatches) {
          socket.send(JSON.stringify({
            type: "pair_success",
            message: "Phone ↔ PC pairing successfully. Enjoy 😊"
          }));

          pairedDevices.push({
            device: data.deviceName || "Mobile",
            date: Date.now()
          });

          addTrustedToken(token);
          clearPairing(token);

          fs.writeFileSync(
            path.join(__dirname, "secureStore.json"),
            JSON.stringify(pairedDevices, null, 2)
          );

          if (typeof onPairCallback === "function") {
            onPairCallback({
              token,
              deviceName: data.deviceName || "Mobile"
            });
          }
        } else {
          socket.send(JSON.stringify({
            type: "pair_failed",
            message: pairing ? "Invalid PIN." : "Pairing session not found. Rescan the QR code."
          }));
        }
      }

      if (data.type === "action") {
        const token = data.token || socket.token;
        if (!isTrustedToken(token)) {
          socket.send(JSON.stringify({
            type: "action_error",
            actionId: data.actionId,
            message: "Device not paired or session expired. Please re-pair."
          }));
          return;
        }

        const actionId = data.actionId;

        handleAction(actionId)
          .then((message) => {
            socket.send(JSON.stringify({
              type: "action_ack",
              actionId,
              message
            }));
          })
          .catch((err) => {
            socket.send(JSON.stringify({
              type: "action_error",
              actionId,
              message: err?.message || "Failed to run action."
            }));
          });
      }

      if (data.type === "deck_subscribe") {
        const token = data.token || socket.token;
        if (!isTrustedToken(token)) {
          socket.send(JSON.stringify({
            type: "deck_error",
            message: "Not paired."
          }));
          return;
        }
        socket.token = token;
        socket.subscribedDeck = true;
        sendDeckUpdate(socket);
      }

      if (data.type === "deck_sync_request") {
        const token = data.token || socket.token;
        if (!isTrustedToken(token)) {
          socket.send(JSON.stringify({
            type: "deck_error",
            message: "Not paired."
          }));
          return;
        }
        sendDeckUpdate(socket);
      }

      if (data.type === "deck_open") {
        const token = data.token || socket.token;
        if (!isTrustedToken(token)) {
          socket.send(JSON.stringify({
            type: "deck_error",
            message: "Not paired."
          }));
          return;
        }
        const label = data.label;
        const profileId = data.profileId || deckState.activeProfileId;
        const sourceProfiles = Array.isArray(deckState.profiles) ? deckState.profiles : [];
        const profileSlots = sourceProfiles.find((p) => p.id === profileId)?.slots;
        const slotSource = Array.isArray(profileSlots) && profileSlots.length ? profileSlots : deckState.slots;
        const slot = slotSource.find((s) => s.label === label);
        if (!slot || !slot.path) {
          socket.send(JSON.stringify({
            type: "deck_open_error",
            label,
            message: "Slot has no app path."
          }));
          return;
        }
        runCommand(`open "${slot.path.replace(/"/g, '\\"')}"`)
          .then(() => {
            socket.send(JSON.stringify({
              type: "deck_open_ack",
              label,
              message: `Opening ${slot.name || "app"}`
            }));
          })
          .catch((err) => {
            socket.send(JSON.stringify({
              type: "deck_open_error",
              label,
              message: err?.message || "Failed to open app."
            }));
          });
      }
    });
  });

  return wss;
}

async function handleAction(actionId) {
  switch (actionId) {
    case "play_pause":
      await runCommand(`osascript -e 'tell application "System Events" to key code 16'`);
      return "Play/Pause sent.";
    case "mute_toggle":
      await runCommand(`osascript -e 'set volume output muted not (output muted of (get volume settings))'`);
      return "Mute toggled.";
    case "open_browser":
      await runCommand(`open "https://google.com"`);
      return "Browser launch requested.";
    default:
      throw new Error("Unknown action.");
  }
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      if (stderr) {
        console.warn(stderr);
      }
      resolve(stdout);
    });
  });
}

function sendDeckUpdate(targetSocket) {
  const payload = JSON.stringify({
    type: "deck_update",
    slots: deckState.slots,
    activeProfileId: deckState.activeProfileId,
    activeProfileName: deckState.activeProfileName,
    profiles: deckState.profiles
  });
  if (targetSocket) {
    targetSocket.send(payload);
  }
}

function broadcastDeckUpdate(wss) {
  const payload = JSON.stringify({
    type: "deck_update",
    slots: deckState.slots,
    activeProfileId: deckState.activeProfileId,
    activeProfileName: deckState.activeProfileName,
    profiles: deckState.profiles
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.subscribedDeck) {
      client.send(payload);
    }
  });
}

function setDeckSlots(payload) {
  if (Array.isArray(payload)) {
    deckState = { ...deckState, slots: payload };
    persistDeckState();
    return;
  }

  if (typeof payload === "object" && payload !== null) {
    deckState = {
      ...deckState,
      slots: Array.isArray(payload.slots) ? payload.slots : deckState.slots,
      activeProfileId: payload.activeProfileId || payload.profileId || deckState.activeProfileId,
      activeProfileName: payload.activeProfileName || payload.profileName || deckState.activeProfileName,
      profiles: Array.isArray(payload.profiles) ? payload.profiles : deckState.profiles
    };
    persistDeckState();
  }
}

function loadDeckStateFromDisk() {
  try {
    if (!fs.existsSync(deckStateFile)) return;
    const raw = fs.readFileSync(deckStateFile, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    setDeckSlots(parsed);
  } catch (err) {
    console.warn("Failed to load deck state from disk:", err?.message || err);
  }
}

function persistDeckState() {
  try {
    fs.mkdirSync(path.dirname(deckStateFile), { recursive: true });
    fs.writeFileSync(deckStateFile, JSON.stringify(deckState, null, 2));
  } catch (err) {
    console.warn("Failed to persist deck state:", err?.message || err);
  }
}

module.exports = { createWebSocketServer, broadcastDeckUpdate, setDeckSlots };
