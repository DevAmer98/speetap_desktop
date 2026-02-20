const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const { savePairing } = require("./pairingStore");

function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] || [];
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return "127.0.0.1";
}

function generatePairingData() {
  const token = uuidv4();
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const ip = getLocalIPv4();

  const payload = {
    ip,
    port: 5173,
    token
  };

  const qrString = JSON.stringify(payload);

  return new Promise((resolve) => {
    QRCode.toDataURL(qrString, (err, qrImage) => {
      savePairing(token, pin);

      resolve({
        qr: qrImage,
        pin,
        token
      });
    });
  });
}

module.exports = { generatePairingData };
