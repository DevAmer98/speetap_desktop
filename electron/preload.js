const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tapdeck", {
  getPairingData: () => ipcRenderer.invoke("getPairingData"),
  onPaired: (listener) => {
    if (typeof listener !== "function") return () => {};
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("paired", handler);
    return () => ipcRenderer.removeListener("paired", handler);
  },
  updateDeck: (slots) => ipcRenderer.invoke("deck:update", slots),
  getFileIconDataUrl: (filePath) => ipcRenderer.invoke("file:getIconDataUrl", filePath),
  getNetworkInfo: () => ipcRenderer.invoke("network:getInfo"),
  windowControls: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onWindowState: (listener) => {
      if (typeof listener !== "function") return () => {};
      const handler = (_event, state) => listener(Boolean(state));
      ipcRenderer.on("window:maximized", handler);
      return () => ipcRenderer.removeListener("window:maximized", handler);
    }
  }
});
