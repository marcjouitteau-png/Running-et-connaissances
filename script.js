





// Header qui apparaît au scroll
const header = document.getElementById('siteHeader');
const hero = document.querySelector('.hero');
const heroHeight = () => hero?.getBoundingClientRect().height || 300;
const onScroll = () => {
  if (window.scrollY > heroHeight() * 0.5) header.classList.add('visible');
  else header.classList.remove('visible');
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Révélations au scroll
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
  });
},{ threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// Onglet actif dans la nav
const page = document.body.dataset.page;
document.querySelectorAll('nav a[data-page]').forEach(a=>{
  if(a.dataset.page === page) a.classList.add('active');
});

// === Masque h:mm:ss + Bornes + Message inline (tolérant aux IDs) ===
(function timeMaskInit() {
  const READY = (fn) => {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  };

  READY(() => {
    // 1) Récupère les champs candidats (classe + plusieurs variantes d'IDs)
    const maskFields = document.querySelectorAll('input.time-mask');
    const idCandidates = [
      'ref_10k','ref10k','ref-10k',
      'ref_21k','ref21k','ref-21k',
      'ref_42k','ref42k','ref-42k'
    ];
    const byId = idCandidates
      .map(id => document.getElementById(id))
      .filter(Boolean);
    const fields = Array.from(new Set([...maskFields, ...byId]));
    if (!fields.length) return;

    // --- Masque inchangé ---
    const formatDigitsToHms = (raw) => {
      const d = (raw || '').replace(/\D/g, '').slice(0, 6); // hhmmss
      const L = d.length;
      if (L === 0) return '';
      if (L <= 2) return d; // h / hh
      if (L <= 4) return d.slice(0, L-2) + ':' + d.slice(L-2); // h:mm / hh:mm
      return d.slice(0, L-4) + ':' + d.slice(L-4, L-2) + ':' + d.slice(L-2); // h:mm:ss
    };
    const isValidHms = (val) => /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.test(val);
    const hmsToSeconds = (val) => {
      const m = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(val);
      if (!m) return NaN;
      return (+m[1])*3600 + (+m[2])*60 + (+m[3]);
    };

    // --- Bornes (clefs canoniques) ---
    const CANON_BOUNDS = {
      'ref10k': { min: 26*60,           max: 80*60           }, // 00:26:00 → 01:20:00
      'ref21k': { min: 60*60,           max: 2*60*60+35*60   }, // 01:00:00 → 02:35:00
      'ref42k': { min: 2*60*60,         max: 5*60*60+30*60   }  // 02:00:00 → 05:30:00
    };

    // Normalise un id en clé canonique : "ref_10k" / "ref-10k" / "ref10k" -> "ref10k"
    const toCanonKey = (el) => {
      // priorité à data-distance si tu veux l'ajouter: <input data-distance="10k">
      const data = (el.dataset && el.dataset.distance || '').toLowerCase().replace(/\s+/g,'');
      if (data === '10k') return 'ref10k';
      if (data === '21k' || data === 'semi' || data === 'half') return 'ref21k';
      if (data === '42k' || data === 'marathon') return 'ref42k';

      const id = (el.id || '').toLowerCase();
      const clean = id.replace(/[_-]/g,''); // supprime _ et -
      if (clean.includes('ref10k')) return 'ref10k';
      if (clean.includes('ref21k')) return 'ref21k';
      if (clean.includes('ref42k')) return 'ref42k';
      // fallback: essaye avec name=
      const name = (el.name || '').toLowerCase().replace(/[_-]/g,'');
      if (name.includes('ref10k')) return 'ref10k';
      if (name.includes('ref21k')) return 'ref21k';
      if (name.includes('ref42k')) return 'ref42k';
      return null;
    };

  

    const human = (sec) => {
      const h = Math.floor(sec/3600);
      const m = Math.floor((sec%3600)/60);
      const s = sec%60;
      return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };

    // --- Messages inline (en plus de l’UI native) ---
    function ensureHintEl(el) {
      let hint = el.nextElementSibling;
      if (!hint || !hint.classList || !hint.classList.contains('time-hint')) {
        hint = document.createElement('div');
        hint.className = 'time-hint';
        hint.setAttribute('aria-live', 'polite');
        el.insertAdjacentElement('afterend', hint);
      }
      return hint;
    }
    function showHint(el, msg) {
      const hint = ensureHintEl(el);
      hint.textContent = msg || '';
      hint.style.display = msg ? 'block' : 'none';
    }

    // --- Normalisation au blur ---
    function normalizeOnBlur(el) {
      const raw = el.value;
      const digits = raw.replace(/\D/g, '');
      if (!raw) return '';

      let norm = formatDigitsToHms(digits);
      const parts = norm.split(':');
      const key = toCanonKey(el);

      if (key === 'ref10k') {
        // 10K : "mm:ss" doit devenir "0:mm:ss"
        if (parts.length === 2) norm = `0:${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`;
        else if (parts.length === 1 && digits.length <= 2) norm = `0:${digits.padStart(2,'0')}:00`;
        // 3 parties → OK
      } else {
        // Semi/Marathon : "h:mm" -> "h:mm:00", "h" -> "h:00:00"
        if (parts.length === 2) norm = norm + ':00';
        else if (parts.length === 1 && digits.length <= 2) norm = `${digits}:00:00`;
      }
      el.value = norm;
      return norm;
    }

    function checkBounds(el) {
      const key = toCanonKey(el);
      const cfg = key ? CANON_BOUNDS[key] : null;

      if (!cfg) { showHint(el, ''); return true; } // champ non concerné

      if (!el.value) {
        el.classList.remove('is-out-of-bounds');
        el.setCustomValidity('');
        showHint(el, '');
        return true;
      }

      if (!isValidHms(el.value)) {
        el.classList.remove('is-out-of-bounds');
        showHint(el, '');
        return true;
      }

      const secs = hmsToSeconds(el.value);
      const ok = secs >= cfg.min && secs <= cfg.max;

      if (!ok) {
        const msg = `Temps attendu entre ${human(cfg.min)} et ${human(cfg.max)}.`;
        el.classList.add('is-out-of-bounds');
        el.setCustomValidity(msg);
        showHint(el, msg);
      } else {
        el.classList.remove('is-out-of-bounds');
        el.setCustomValidity('');
        showHint(el, '');
      }
      return ok;
    }

    // --- Listeners
    fields.forEach((el) => {
      el.addEventListener('input', (e) => {
        const formatted = formatDigitsToHms(e.target.value);
        e.target.value = formatted;
        e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
        showHint(e.target, '');
      });

      el.addEventListener('blur', (e) => {
        setTimeout(() => {
          const norm = normalizeOnBlur(e.target);
          if (!norm) { e.target.setCustomValidity(''); showHint(e.target, ''); return; }

          if (!isValidHms(e.target.value)) {
            const msg = 'Format attendu : h:mm:ss (minutes/secondes entre 00 et 59).';
            e.target.setCustomValidity(msg);
            showHint(e.target, msg);
            if (e.target.reportValidity) e.target.reportValidity();
            return;
          } else {
            e.target.setCustomValidity('');
            showHint(e.target, '');
          }

          const ok = checkBounds(e.target);
          if (!ok && e.target.reportValidity) e.target.reportValidity();
        }, 0);
      });

      el.addEventListener('invalid', (e) => {
        if (!e.target.value) return;
        if (!isValidHms(e.target.value)) {
          const msg = 'Format attendu : h:mm:ss (ex. 1:42:20).';
          e.target.setCustomValidity(msg);
          showHint(e.target, msg);
        }
      });
    });

    // Submit : re-normalise & re-vérifie
    const form = document.getElementById('form-inscription');
    if (form) {
      form.addEventListener('submit', (e) => {
        let ok = true;
        fields.forEach((el) => {
          const norm = normalizeOnBlur(el);
          if (norm && isValidHms(el.value)) {
            ok = checkBounds(el) && ok;
          } else if (!isValidHms(el.value) && el.value) {
            ok = false;
          }
        });
        if (!ok) {
          e.preventDefault();
          fields.forEach(el => el.reportValidity && el.reportValidity());
          alert('Un ou plusieurs chronos sont hors des bornes autorisées.');
        }
      });
    }
  });
})();





// === Envoi du formulaire d'inscription via API Resend ===
//(function wireInscriptionForm(){
  //const form = document.getElementById('form-inscription');
  //if (!form) return;

  //const btn = form.querySelector('button[type="submit"]');

  //form.addEventListener('submit', async (e) => {
   // e.preventDefault();

    // Honeypot anti-spam
  //  if (form.querySelector('input[name="_honey"]')?.value) return;

   // const data = Object.fromEntries(new FormData(form).entries());
   // try {
     // btn.disabled = true; btn.textContent = 'Envoi…';
    //  const r = await fetch('/api/send-inscription', {
     //   method: 'POST',
    //    headers: { 'Content-Type': 'application/json' },
     //   body: JSON.stringify(data)
    //  });
    //  if (!r.ok) throw new Error(await r.text());
    //  form.reset();
    //  alert('Merci ! Ton inscription a bien été envoyée. Nous t'écrirons d'ici 48h pour te confirmer la disponibilité de ce séminaire ainsi que les modalités de règlement.A très bientôt, Marc.');
   // } catch (err) {
   //   console.error(err);
    //  alert("Oups, l'envoi a échoué. Réessayez plus tard ou écrivez à runningconnaissances@gmail.com");
   // } finally {
   //   btn.disabled = false; btn.textContent = 'Envoyer mon inscription';
   // }
  //});
//})();


// ----- Masque h:mm:ss (compact) -----
(function(){
  const f = (raw)=>{const d=(raw||'').replace(/\D/g,'').slice(0,6),L=d.length;
    if(!L) return ''; if(L<=2) return d; if(L<=4) return d.slice(0,L-2)+':'+d.slice(L-2);
    return d.slice(0,L-4)+':'+d.slice(L-4,L-2)+':'+d.slice(L-2);
  };
  document.querySelectorAll('input.time-mask').forEach(el=>{
    el.addEventListener('input',e=>{ e.target.value=f(e.target.value); });
    el.addEventListener('blur',e=>{
      const v=e.target.value, d=v.replace(/\D/g,''); if(!v) return;
      let norm=f(d); const parts=norm.split(':');
      if(parts.length===2) norm+=':00';
      if(parts.length===1) norm=d+':00:00';
      e.target.value=norm;
    });
  });
})();

// ----- Outils temps -----
const parseHMS = (s)=>{
  if(!s) return null;
  const m = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(s.trim());
  if(!m) return null;
  const h=+m[1], mn=+m[2], sc=+m[3];
  return h*3600 + mn*60 + sc;
};

// ----- Calcul niveau selon tes seuils -----
const levelFrom10k = (sec)=>{
  if(sec==null) return null;
  if(sec < 40*60) return 6;
  if(sec < 45*60) return 5;
  if(sec < 50*60) return 4;
  if(sec < 55*60) return 3;
  if(sec < 60*60) return 2;
  return 1;
};
const levelFrom21k = (sec)=>{
  if(sec==null) return null;
  if(sec < (1*3600 + 26*60)) return 6;
  if(sec < (1*3600 + 38*60)) return 5;
  if(sec < (1*3600 + 49*60)) return 4;
  if(sec < (2*3600 + 0*60)) return 3;
  if(sec < (2*3600 + 10*60)) return 2;
  return 1;
};
const levelFrom42k = (sec)=>{
  if(sec==null) return null;
  if(sec < (3*3600 + 1*60)) return 6;
  if(sec < (3*3600 + 26*60)) return 5;
  if(sec < (3*3600 + 58*60)) return 4;
  if(sec < (4*3600 + 22*60)) return 3;
  if(sec < (4*3600 + 44*60)) return 2;
  return 1;
};
const levelFromITRA = (itra)=>{
  if(itra==null || isNaN(itra)) return null;
  if(itra > 575) return 6;
  if(itra >= 525) return 5;
  if(itra >= 450) return 4;
  if(itra >= 375) return 3;
  if(itra >= 300) return 2;
  return 1;
};

// Politique : on est prudent → on propose le niveau le plus "sage"
const proposeLevel = (vals)=>{
  const {t10k, t21k, t42k, itra} = vals;
  const levels = [levelFrom10k(t10k), levelFrom21k(t21k), levelFrom42k(t42k), levelFromITRA(itra)]
    .filter(v=>v!=null);
  if(!levels.length) return null;
  // conservateur : on prend le plus petit des niveaux suggérés
  return Math.min(...levels);
};

// === CALCULATEUR — Bornes + normalisation (t10k / t21k / t42k / itra) ===
(function calcBoundsInit(){
  const READY = (fn) => {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once:true });
  };

  READY(() => {
    const el10 = document.getElementById('t10k');
    const el21 = document.getElementById('t21k');
    const el42 = document.getElementById('t42k');
    const elIT = document.getElementById('itra');
    const form = document.getElementById('level-form');

    if (!el10 && !el21 && !el42 && !elIT) return;

    const isHms = (v) => /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.test(v);
    const hmsToSec = (v) => {
      const m = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(v);
      if (!m) return NaN;
      return (+m[1])*3600 + (+m[2])*60 + (+m[3]);
    };
    const human = (sec) => {
      const h = Math.floor(sec/3600);
      const m = Math.floor((sec%3600)/60);
      const s = sec%60;
      return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };
    const fmtDigitsToHms = (raw) => {
      const d = (raw || '').replace(/\D/g,'').slice(0,6); // hhmmss
      const L = d.length;
      if (L===0) return '';
      if (L<=2)  return d;
      if (L<=4)  return d.slice(0,L-2)+':'+d.slice(L-2);
      return d.slice(0,L-4)+':'+d.slice(L-4,L-2)+':'+d.slice(L-2);
    };

    // Bornes en secondes
    const BOUNDS = {
      '10k': { min: 26*60,           max: 80*60 },             // 00:26:00 → 01:20:00
      '21k': { min: 60*60,           max: 2*60*60 + 35*60 },   // 01:00:00 → 02:35:00
      '42k': { min: 2*60*60,         max: 5*60*60 + 30*60 }    // 02:00:00 → 05:30:00
    };

    // Petit helper pour messages sous les champs (en plus des bulles natives)
    const ensureHint = (el) => {
      let hint = el.nextElementSibling;
      if (!hint || !hint.classList || !hint.classList.contains('time-hint')) {
        hint = document.createElement('div');
        hint.className = 'time-hint';
        hint.style.cssText = 'font-size:.9em;color:#b00000;margin-top:4px;display:none;';
        el.insertAdjacentElement('afterend', hint);
      }
      return hint;
    };
    const showHint = (el, msg) => {
      const h = ensureHint(el);
      h.textContent = msg || '';
      h.style.display = msg ? 'block' : 'none';
    };

    // Normalisation post-masque
    function normalize(el, kind) {
      const raw = el.value || '';
      const digits = raw.replace(/\D/g,'');
      if (!raw) return '';

      let norm = fmtDigitsToHms(digits);
      const parts = norm.split(':');

      if (kind==='10k') {
        // "mm:ss" -> "0:mm:ss" ; "mm" -> "0:mm:00"
        if (parts.length===2) norm = `0:${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`;
        else if (parts.length===1 && digits.length<=2) norm = `0:${digits.padStart(2,'0')}:00`;
      } else {
        // "h:mm" -> "h:mm:00" ; "h" -> "h:00:00"
        if (parts.length===2) norm = norm + ':00';
        else if (parts.length===1 && digits.length<=2) norm = `${digits}:00:00`;
      }
      el.value = norm;
      return norm;
    }

    function validateTime(el, kind) {
      if (!el) return true;
      if (!el.value) { el.setCustomValidity(''); showHint(el,''); return true; }

      if (!isHms(el.value)) {
        const msg = 'Format attendu : h:mm:ss (minutes/secondes entre 00 et 59).';
        el.setCustomValidity(msg); showHint(el,msg); return false;
      }

      const secs = hmsToSec(el.value);
      const b = BOUNDS[kind];
      if (!b) { el.setCustomValidity(''); showHint(el,''); return true; }

      const ok = secs>=b.min && secs<=b.max;
      if (!ok) {
        const msg = `Temps attendu entre ${human(b.min)} et ${human(b.max)}.`;
        el.setCustomValidity(msg); showHint(el,msg); return false;
      }
      el.setCustomValidity(''); showHint(el,''); return true;
    }

    // Brancher blur (après ton masque existant)
    const hook = (el, kind) => {
      if (!el) return;
      el.addEventListener('blur', (e) => {
        setTimeout(() => { // laisse le masque .time-mask finir
          normalize(e.target, kind);
          validateTime(e.target, kind);
          e.target.reportValidity && e.target.reportValidity();
        }, 0);
      });
      // nettoyage visuel pendant la saisie
      el.addEventListener('input', (e) => showHint(e.target, ''));
    };

    hook(el10,'10k');
    hook(el21,'21k');
    hook(el42,'42k');

    // ITRA : 0 → 1000 (entier)
    if (elIT) {
      const validateItra = () => {
        const v = String(elIT.value||'').trim();
        if (!v) { elIT.setCustomValidity(''); return true; }
        const n = Number(v);
        const ok = Number.isFinite(n) && n>=0 && n<=1000 && Number.isInteger(n);
        elIT.setCustomValidity(ok ? '' : 'ITRA attendu entre 0 et 1000 (entier).');
        return ok;
      };
      elIT.addEventListener('keypress', (e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); });
      elIT.addEventListener('blur', () => { validateItra(); elIT.reportValidity && elIT.reportValidity(); });
    }

    // Bloque la soumission du calcul si hors bornes
    if (form) {
      form.addEventListener('submit', (e) => {
        // normalise si on clique direct
        if (el10) normalize(el10,'10k');
        if (el21) normalize(el21,'21k');
        if (el42) normalize(el42,'42k');

        let ok = true;
        if (el10) ok = validateTime(el10,'10k') && ok;
        if (el21) ok = validateTime(el21,'21k') && ok;
        if (el42) ok = validateTime(el42,'42k') && ok;
        if (elIT) ok = (elIT.checkValidity ? elIT.checkValidity() : true) && ok;

        if (!ok) {
          e.preventDefault();
          el10?.reportValidity?.(); el21?.reportValidity?.(); el42?.reportValidity?.(); elIT?.reportValidity?.();
          alert('Corrige les valeurs hors bornes avant de proposer un niveau.');
        }
      });
    }
  });
})();


// ----- Handler formulaire -----
(function(){
  const form = document.getElementById('level-form');
  if(!form) return;
  const out = document.getElementById('level-result');

  form.addEventListener('submit',(e)=>{
    e.preventDefault();
    const t10k = parseHMS(document.getElementById('t10k').value);
    const t21k = parseHMS(document.getElementById('t21k').value);
    const t42k = parseHMS(document.getElementById('t42k').value);
    const itra = document.getElementById('itra').value ? parseInt(document.getElementById('itra').value,10) : null;

    const lvl = proposeLevel({t10k,t21k,t42k,itra});
    if(!lvl){
      out.textContent = "Renseigne au moins un champ";
      out.className='pill';
      return;
    }
    out.textContent = `Niveau proposé : ${lvl}`;
    out.className = `pill lvl-${lvl}`;

    // ----- Sauvegarde des perfs + niveau -----
    const perfPayload = {
      t10kRaw: document.getElementById('t10k').value || "",
      t21kRaw: document.getElementById('t21k').value || "",
      t42kRaw: document.getElementById('t42k').value || "",
      itraRaw: document.getElementById('itra').value || "",
      level: lvl,
      ts: Date.now()
    };
    try { localStorage.setItem('perfData', JSON.stringify(perfPayload)); } catch(e){}

    // ----- Filtre auto le planning (garde seulement le niveau proposé) -----
    document.querySelectorAll('.sessions .session-card').forEach(card=>{
      const ok = parseInt(card.dataset.level,10) === lvl;
      card.style.display = ok ? '' : 'none';
    });
  }); // <-- ferme addEventListener
})(); // <-- ferme l’IIFE


// ----- Filtres par checkbox -----
(function(){
  const filters = document.querySelectorAll('.filters input[name="lvl"]');
  const apply = ()=>{
    const active = new Set([...filters].filter(f=>f.checked).map(f=>f.value));
    document.querySelectorAll('.sessions .session-card').forEach(card=>{
      card.style.display = active.has(card.dataset.level) ? '' : 'none';
    });
  };
  filters.forEach(f=>f.addEventListener('change', apply));
  apply();
})();


// ====== Données de séminaires (exemples) ======
// start/end au format "YYYY-MM-DD". level 1..6
const SEMINAIRES = [
  { title:"Route", 
      level:4, 
      start:"2026-03-26", 
      end:"2026-03-28", 
      lieu:"Etiolles", 
      desc:"TEST", 
      link:"inscription.html" },
      
  
  { title:"Route", 
      level:2, 
      start:"2026-04-22", 
      end:"2026-04-24", 
      lieu:"Etiolles", 
      desc:"TEST.", 
      link:"inscription.html" },

  { title:"Route", 
      level:6, 
      start:"2026-04-11", 
      end:"2026-04-13", 
      lieu:"Maison", 
      desc:"TEST", 
      link:"inscription.html" },

  { title:"Trail", 
      level:4, 
      start:"2026-04-05", 
      end:"2026-04-07", 
      lieu:"Maison", 
      desc:"TEST.", 
      link:"inscription.html" },

      { title:"Pologne", 
      level:4, 
      start:"2026-05-05", 
      end:"2026-05-07", 
      lieu:"Maison", 
      desc:"TEST.", 
      link:"inscription.html" },
];

try {
  localStorage.setItem('seminaires', JSON.stringify(SEMINAIRES));
  localStorage.setItem('seminaires_ts', Date.now().toString()); // (optionnel) pour vérifier la fraîcheur
} catch (e) {}

(function initCalendrier(){
  const calWrap = document.getElementById('calWrap');
  const title = document.getElementById('calTitle');
  const btnPrev = document.getElementById('calPrev');
  const btnNext = document.getElementById('calNext');
  if(!calWrap || !title) return;

  // Base = mois courant (Europe/Paris)
  const now = new Date();
  let base = new Date(now.getFullYear(), now.getMonth(), 1); // premier du mois

  const moisFr = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const dowFr = ["Lu","Ma","Me","Je","Ve","Sa","Di"]; // on affiche lundi→dimanche

  const fmtDate = (d)=>d.toISOString().slice(0,10); // YYYY-MM-DD

  function addDays(date, n){
    const d = new Date(date); d.setDate(d.getDate()+n); return d;
  }
  function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }

  // Map des événements par date (dépliage des spans multi-jours)
  function buildEventMap(){
    const map = new Map();
    SEMINAIRES.forEach(ev=>{
      const start = new Date(ev.start + "T00:00:00");
      const end = new Date(ev.end + "T00:00:00");
      for(let d = new Date(start); d <= end; d = addDays(d,1)){
        const key = fmtDate(d);
        if(!map.has(key)) map.set(key, []);
        map.get(key).push(ev);
      }
    });
    return map;
  }

  function renderTwoMonths(){
    const m1 = new Date(base);
    const m2 = new Date(base.getFullYear(), base.getMonth()+1, 1);
    calWrap.innerHTML = "";
    title.textContent = `${moisFr[m1.getMonth()]} ${m1.getFullYear()}  —  ${moisFr[m2.getMonth()]} ${m2.getFullYear()}`;
    const evMap = buildEventMap();
    calWrap.appendChild(renderMonth(m1, evMap));
    calWrap.appendChild(renderMonth(m2, evMap));
  }

  function renderMonth(firstOfMonth, evMap){
    const y = firstOfMonth.getFullYear();
    const m = firstOfMonth.getMonth();
    const total = daysInMonth(y,m);

    // Calculer décalage pour commencer sur LUNDI
    const jsDow = new Date(y,m,1).getDay(); // 0=dim,1=lun...
    const offset = (jsDow + 6) % 7; // 0 si lundi, 6 si dimanche

    // conteneur
    const cal = document.createElement('div');
    cal.className = 'calendar';

    // entête mois
    const head = document.createElement('div');
    head.className = 'month-head';
    head.textContent = `${moisFr[m]} ${y}`;
    cal.appendChild(head);

    // grille
    const grid = document.createElement('div');
    grid.className = 'grid';

    // DOW
    dowFr.forEach(d=>{
      const el = document.createElement('div');
      el.className = 'dow'; el.textContent = d; grid.appendChild(el);
    });

    // cases vides avant le 1er
    for(let i=0;i<offset;i++){
      const empty = document.createElement('div');
      empty.className = 'cell'; grid.appendChild(empty);
    }

    // jours
    for(let day=1; day<=total; day++){
      const cell = document.createElement('div'); cell.className='cell';
      const dateEl = document.createElement('span'); dateEl.className='date'; dateEl.textContent = day;
      cell.appendChild(dateEl);

      const dStr = fmtDate(new Date(y,m,day));
      const events = evMap.get(dStr) || [];
      // on affiche max 2 pastilles, puis "+n" si plus
      events.slice(0,2).forEach(ev=>{
        const tag = document.createElement('button');
        tag.type = 'button';
        tag.className = `event lvl-${ev.level}`;
        tag.innerHTML = `<small>N${ev.level}</small> ${ev.title}`;
        tag.setAttribute('aria-label', `${ev.title}, niveau ${ev.level}`);
        // Tooltip
        const tip = document.createElement('div');
        tip.className = 'tooltip';
      // Génération du lien avec paramètres dans l’URL
        const qs = new URLSearchParams({
          title: ev.title,
          level: String(ev.level),
          start: ev.start,
           end: ev.end
        }).toString();

        tip.innerHTML = `
          <div class="t-title">${ev.title} <span class="chip lvl-${ev.level}" style="font-size:.75rem">N${ev.level}</span></div>
          <div class="t-meta">${formatRange(ev.start, ev.end)} · ${ev.lieu || ''}</div>
          <div class="t-desc">${ev.desc || ''}</div>
           ${ev.link ? `<div style="margin-top:6px"><a href="${ev.link}?${qs}">S’inscrire à ce séminaire</a></div>` : '' }
`;

        cell.appendChild(tag);
        cell.appendChild(tip);

        // hover + click (mobile)
        tag.addEventListener('mouseenter', ()=>cell.classList.add('show'));
        tag.addEventListener('mouseleave', ()=>cell.classList.remove('show'));
        tag.addEventListener('click', (e)=>{
          // toggle mobile
          const open = cell.classList.contains('show');
          document.querySelectorAll('.calendar .cell.show').forEach(c=>c.classList.remove('show'));
          if(!open) cell.classList.add('show');
          e.stopPropagation();
        });
      });

      if(events.length > 2){
        const more = document.createElement('div');
        more.style.marginTop = '6px';
        more.style.fontSize = '.8rem';
        more.style.color = '#475569';
        more.textContent = `+${events.length-2} autres`;
        cell.appendChild(more);
      }

      grid.appendChild(cell);
    }

    // fermer tooltips au clic hors
    document.addEventListener('click', ()=> {
      document.querySelectorAll('.calendar .cell.show').forEach(c=>c.classList.remove('show'));
    });

    cal.appendChild(grid);
    return cal;
  }

  function formatRange(a,b){
    const da = new Date(a+"T00:00:00"), db = new Date(b+"T00:00:00");
    const sameMonth = da.getMonth()===db.getMonth() && da.getFullYear()===db.getFullYear();
    const opt = { day:'2-digit', month:'short' };
    const optY = { day:'2-digit', month:'short', year:'numeric' };
    return sameMonth
      ? `${da.toLocaleDateString('fr-FR', opt)}–${db.toLocaleDateString('fr-FR', optY)}`
      : `${da.toLocaleDateString('fr-FR', optY)} → ${db.toLocaleDateString('fr-FR', optY)}`;
  }

  // Nav : on se déplace de 2 mois à la fois
  btnPrev?.addEventListener('click', ()=>{ base = new Date(base.getFullYear(), base.getMonth()-2, 1); renderTwoMonths(); });
  btnNext?.addEventListener('click', ()=>{ base = new Date(base.getFullYear(), base.getMonth()+2, 1); renderTwoMonths(); });

  renderTwoMonths();
})();



// ===== Autosave inscription (brouillon) =====
(function () {
  const DRAFT_KEY = 'inscriptionDraft';

  // Champs à mémoriser (si certains n'existent pas sur une page, ils seront ignorés)
  const SELECTORS = [
  '#nom', '#email', '#tel', '#naissance',
  '#rue', '#ville', '#cp',
  '#course-prepa',
  '#ref_10k', '#ref_21k', '#ref_42k', '#ref_itra',
  '#choice1', '#choice2', '#choice3',
  '#level',
  '#Conférence', '#blessures', '#douleurs',
  '#groupe', '#course-emblematique',
  '#fait-drole', '#anecdote', '#remarques'
];


  // safe get/set: utilise utils.safeJSON si présent, sinon fallback localStorage
  const safe = (function () {
    const u = (window.utils && window.utils.safeJSON) || null;
    return u ? {
      get: (k, f=null) => u.get(k, f),
      set: (k, v) => u.set(k, v),
      del: (k) => u.del(k)
    } : {
      get: (k, f=null) => {
        try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }
        catch { return f; }
      },
      set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
      del: (k) => { try { localStorage.removeItem(k); } catch {} }
    };
  })();

  // Applique le brouillon si présent
  function loadDraft() {
    const draft = safe.get(DRAFT_KEY, {});
    SELECTORS.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const val = draft[sel];
      if (val == null) return;

      // Pour les <select>, on pose la value si l'option existe
      if (el.tagName === 'SELECT') {
        const hasOption = Array.from(el.options).some(o => o.value === String(val));
        if (hasOption) el.value = String(val);
      } else {
        el.value = String(val);
      }
    });
  }

  // Écoute les changements et enregistre au fil de l’eau
  function hookDraft() {
    SELECTORS.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const evt = (el.tagName === 'SELECT') ? 'change' : 'input';
      el.addEventListener(evt, () => {
        const current = safe.get(DRAFT_KEY, {});
        current[sel] = el.value;
        safe.set(DRAFT_KEY, current);
      });
    });
  }

  // Purge du brouillon à la soumission (sans toucher à ton reste de logique)
  function hookSubmitCleanup() {
    const form = document.querySelector('#form-inscription');
    if (!form) return;
    form.addEventListener('submit', () => {
      safe.del(DRAFT_KEY);
    });
  }

  // L’ordre d’hydratation peut varier selon ta page -> on tente plusieurs moments
  document.addEventListener('DOMContentLoaded', () => {
    loadDraft();      // 1er passage
    hookDraft();
    hookSubmitCleanup();
    // Re-essai après le remplissage asynchrone des <select> (si besoin)
    setTimeout(loadDraft, 100);  // léger délai
    window.addEventListener('load', loadDraft); // re-applique quand tout est prêt
  });
})();








document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#site-nav");

  if (!navToggle || !nav) return;

  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
});
