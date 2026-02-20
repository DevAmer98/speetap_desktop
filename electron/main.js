const { app, BrowserWindow, ipcMain, Tray, nativeImage } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createWebSocketServer, broadcastDeckUpdate, setDeckSlots } = require('./websocket');
const { generatePairingData } = require('./pairing');

let mainWindow;
let tray;
let wsServer;
const rendererUrl = "http://127.0.0.1:3000";
const appIconPath = path.join(__dirname, "icon.png");

app.setName("TapDeck");

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in main process:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in main process:', reason);
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const execFilePromise = (command, args, timeout = 1200) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { timeout }, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(stdout);
    });
  });

async function resolveWifiDevice() {
  try {
    const output = await execFilePromise('/usr/sbin/networksetup', ['-listallhardwareports']);
    const match = String(output).match(/Hardware Port:\s*Wi-Fi[\s\S]*?Device:\s*(\S+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (_) {
    // Fall back to the default Wi-Fi interface.
  }
  return 'en0';
}

async function resolveHardwarePortName(device) {
  if (!device) return null;
  try {
    const output = await execFilePromise('/usr/sbin/networksetup', ['-listallhardwareports']);
    const blockRegex = new RegExp(
      `Hardware Port:\\s*([^\\n]+)\\n\\s*Device:\\s*${device}\\b`,
      'i'
    );
    const match = String(output).match(blockRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (_) {
    // Ignore.
  }
  return null;
}

async function readWifiFromIpconfig(device) {
  try {
    const output = await execFilePromise('/usr/sbin/ipconfig', ['getsummary', device]);
    const match = String(output).match(/SSID\s*:\s*(.+)$/m);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value && value !== '<redacted>') {
        return value;
      }
    }
  } catch (_) {
    // Ignore and try other methods.
  }
  return null;
}

async function readWifiFromAirport() {
  try {
    const output = await execFilePromise(
      '/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport',
      ['-I']
    );
    const match = String(output).match(/^\s*SSID:\s*(.+)$/m);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (_) {
    // Ignore and try other methods.
  }
  return null;
}

async function readWifiSsid() {
  if (process.platform !== 'darwin') return null;
  const device = await resolveWifiDevice();
  const ipconfigSsid = await readWifiFromIpconfig(device);
  if (ipconfigSsid) return ipconfigSsid;

  const airportSsid = await readWifiFromAirport();
  if (airportSsid) return airportSsid;

  try {
    const output = await execFilePromise('/usr/sbin/networksetup', ['-getairportnetwork', device]);
    const match = String(output).match(/Current Wi-Fi Network:\s*(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (_) {
    // Ignore.
  }

  return null;
}

async function getNetworkInfo() {
  if (process.platform !== 'darwin') {
    return { ssid: null, device: null, portName: null };
  }
  const device = await resolveWifiDevice();
  const ssid = await readWifiSsid();
  const portName = await resolveHardwarePortName(device);
  return { ssid, device, portName };
}

async function loadRenderer(url, retries = 10, retryDelayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mainWindow.loadURL(url);
      return;
    } catch (err) {
      console.warn(
        `Failed to load renderer (attempt ${attempt}/${retries}): ${err.message || err}`
      );
      await delay(retryDelayMs);
    }
  }

  console.error(`Renderer not reachable at ${url} after ${retries} attempts.`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -100, y: -100 },
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.on('maximize', () => {
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('window:maximized', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('window:maximized', false);
    }
  });

  loadRenderer(rendererUrl);
}

// Start Electron App
app.whenReady().then(() => {
  createWindow();

  if (app.dock && fs.existsSync(appIconPath)) {
    app.dock.setIcon(appIconPath);
  }

  const trayIcon = fs.existsSync(appIconPath) ? appIconPath : nativeImage.createEmpty();

  if (!fs.existsSync(appIconPath)) {
    console.warn("Tray icon not found at electron/icon.png, using empty icon.");
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("TapDeck Desktop Running");

  wsServer = createWebSocketServer(({ token, deviceName }) => {
    if (mainWindow?.webContents) {
      mainWindow.webContents.send("paired", { token, deviceName });
    }
  });

  ipcMain.handle("getPairingData", () => {
    return generatePairingData();
  });

  ipcMain.handle("deck:update", (_event, slots) => {
    setDeckSlots(slots);
    if (wsServer) {
      broadcastDeckUpdate(wsServer);
    }
    return true;
  });

  ipcMain.handle("file:getIconDataUrl", async (_event, payload) => {
    const { filePath, appName } = normalizeIconRequest(payload);
    const resolvedPath = resolveAppPath(filePath, appName);
    console.log("[tapdeck] icon ipc", { filePath, appName, resolvedPath });
    if (!resolvedPath) return null;
    try {
      let iconImage = await resolveIconForPath(resolvedPath);
      console.log("[tapdeck] icon resolve", { empty: !iconImage || iconImage.isEmpty() });
      if (!iconImage || iconImage.isEmpty()) return null;
      const size = iconImage.getSize ? iconImage.getSize() : { width: 0, height: 0 };
      console.log("[tapdeck] icon size", size);
      if (size.width === 0 || size.height === 0) {
        iconImage = await createThumbnail(resolvedPath, 256);
        console.log("[tapdeck] icon thumbnail", {
          empty: !iconImage || iconImage.isEmpty(),
          size: iconImage?.getSize ? iconImage.getSize() : { width: 0, height: 0 }
        });
        if (!iconImage || iconImage.isEmpty()) return null;
      }
      let png = iconImage.toPNG();
      if (!png || !png.length) {
        const resized = iconImage.resize({ width: 128, height: 128, quality: "best" });
        png = resized.toPNG();
      }
      console.log("[tapdeck] icon png bytes", png ? png.length : 0);
      if (png && png.length) {
        return `data:image/png;base64,${png.toString("base64")}`;
      }
      const dataUrl = iconImage.toDataURL();
      if (typeof dataUrl === "string" && dataUrl.startsWith("data:image")) {
        return dataUrl;
      }
      return null;
    } catch (err) {
      console.warn("Failed to read file icon:", err?.message || err);
      return null;
    }
  });

  ipcMain.handle("window:minimize", () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
    return true;
  });

  ipcMain.handle("window:toggle-maximize", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized();
  });

  ipcMain.handle("window:close", () => {
    if (mainWindow) {
      mainWindow.close();
    }
    return true;
  });

  ipcMain.handle("window:isMaximized", () => {
    if (!mainWindow) return false;
    return mainWindow.isMaximized();
  });

  ipcMain.handle("network:getInfo", async () => {
    return getNetworkInfo();
  });
});

function normalizeIconRequest(payload) {
  if (!payload) return { filePath: null, appName: null };
  if (typeof payload === "string") {
    return { filePath: normalizeFilePath(payload), appName: null };
  }
  if (typeof payload === "object") {
    const path = normalizeFilePath(payload.path || payload.filePath || "");
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    return { filePath: path, appName: name };
  }
  return { filePath: null, appName: null };
}

function normalizeFilePath(input) {
  if (!input || typeof input !== "string") return null;
  let normalized = input.trim();
  if (!normalized) return null;
  if (normalized.startsWith("file://")) {
    normalized = normalized.slice("file://".length);
  }
  normalized = decodeURIComponent(normalized);
  normalized = normalized.replace(/\/+$/, "");
  return normalized || null;
}

function resolveAppPath(filePath, appName) {
  if (filePath && fs.existsSync(filePath)) return filePath;
  const cleanedName = (appName || "").replace(/\.app$/i, "").trim();
  if (!cleanedName) return null;
  const appBundleName = `${cleanedName}.app`;
  const candidates = [
    path.join("/Applications", appBundleName),
    path.join("/System/Applications", appBundleName),
    path.join("/System/Applications/Utilities", appBundleName)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function resolveIconForPath(filePath) {
  if (process.platform === "darwin" && filePath.toLowerCase().endsWith(".app")) {
    const bundleIcon = readAppBundleIcon(filePath);
    if (bundleIcon && !bundleIcon.isEmpty()) return bundleIcon;
    const bundleImage = nativeImage.createFromPath(filePath);
    if (bundleImage && !bundleImage.isEmpty()) return bundleImage;
  }
  try {
    return await app.getFileIcon(filePath, { size: "large" });
  } catch (_) {
    try {
      return await app.getFileIcon(filePath, { size: "normal" });
    } catch (_) {
      return null;
    }
  }
}

function readAppBundleIcon(appPath) {
  try {
    const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
    if (!fs.existsSync(infoPlistPath)) return null;
    const plist = fs.readFileSync(infoPlistPath, "utf8");
    const match = plist.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/i);
    let iconName = match && match[1] ? match[1].trim() : "";
    if (iconName && !iconName.toLowerCase().endsWith(".icns")) {
      iconName += ".icns";
    }
    const resourcesPath = path.join(appPath, "Contents", "Resources");
    if (iconName) {
      const iconPath = path.join(resourcesPath, iconName);
      const image = createImageFromPath(iconPath);
      if (image) return image;
    }
    if (!fs.existsSync(resourcesPath)) return null;
    const entries = fs.readdirSync(resourcesPath);
    const firstIcns = entries.find((entry) => entry.toLowerCase().endsWith(".icns"));
    if (!firstIcns) return null;
    return createImageFromPath(path.join(resourcesPath, firstIcns));
  } catch (_) {
    return null;
  }
}

function createImageFromPath(iconPath) {
  if (!iconPath || !fs.existsSync(iconPath)) return null;
  const image = nativeImage.createFromPath(iconPath);
  if (image && !image.isEmpty()) return image;
  try {
    const buffer = fs.readFileSync(iconPath);
    const bufferImage = nativeImage.createFromBuffer(buffer);
    if (bufferImage && !bufferImage.isEmpty()) return bufferImage;
  } catch (_) {
    // Ignore and fall through.
  }
  return null;
}

async function createThumbnail(filePath, size) {
  try {
    if (typeof nativeImage.createThumbnailFromPath !== "function") return null;
    return await nativeImage.createThumbnailFromPath(filePath, { width: size, height: size });
  } catch (_) {
    return null;
  }
}
