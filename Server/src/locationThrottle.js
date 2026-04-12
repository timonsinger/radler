// Throttle: Kunden-Positionsupdates nur alle 30 Sekunden senden
const lastSent = new Map(); // rideId -> timestamp

const THROTTLE_MS = 30000;

function shouldSendToCustomer(rideId) {
  const now = Date.now();
  const last = lastSent.get(rideId) || 0;
  if (now - last >= THROTTLE_MS) {
    lastSent.set(rideId, now);
    return true;
  }
  return false;
}

// Aufräumen wenn Ride abgeschlossen
function clearRide(rideId) {
  lastSent.delete(rideId);
}

module.exports = { shouldSendToCustomer, clearRide };
