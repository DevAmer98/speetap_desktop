const activePairings = new Map(); // pending PIN validations
const trustedTokens = new Set(); // paired/trusted tokens for actions

function savePairing(token, pin) {
  if (!token || !pin) return;
  activePairings.set(token, { pin, createdAt: Date.now() });
}

function getPairing(token) {
  if (!token) return undefined;
  return activePairings.get(token);
}

function clearPairing(token) {
  if (!token) return;
  activePairings.delete(token);
}

function addTrustedToken(token) {
  if (!token) return;
  trustedTokens.add(token);
}

function isTrustedToken(token) {
  if (!token) return false;
  return trustedTokens.has(token);
}

module.exports = {
  savePairing,
  getPairing,
  clearPairing,
  addTrustedToken,
  isTrustedToken
};
