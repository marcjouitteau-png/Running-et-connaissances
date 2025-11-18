// utils.js
// — Petites fonctions robustes et réutilisables —

// ✅ Lecture / écriture sécurisée dans localStorage
export const safeJSON = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn(`[safeJSON.get] Erreur lecture ${key}`, err);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[safeJSON.set] Erreur écriture ${key}`, err);
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[safeJSON.del] Erreur suppression ${key}`, err);
    }
  }
};

// ✅ Extraction simple des paramètres d’URL
export const getQuery = () =>
  Object.fromEntries(new URLSearchParams(window.location.search).entries());

// ✅ Clamp du niveau entre 1 et 6 (borne de sécurité)
export const clampLevel = (val) => {
  const n = Number(val);
  return isNaN(n) ? 1 : Math.max(1, Math.min(6, n));
};

// ✅ Vérifie si deux plages de dates se chevauchent
export const isOverlap = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd);

// ✅ Date du jour au format ISO (YYYY-MM-DD)
export const todayISO = () =>
  new Date().toISOString().slice(0, 10);

// ✅ Optionnel : utilitaire pour formater une date lisible
export const formatDate = (isoStr) => {
  const d = new Date(isoStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
