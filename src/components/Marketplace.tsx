// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';

/* =====================================================================
   ABDULSALAMI MARKETPLACE
   Persistent (Supabase) + cached (localStorage) + rate-limited.
   ===================================================================== */

const CACHE_KEY = 'abdulsalami_marketplace_cache_v1';

// Change this. Only people who know it can create an admin account.
// Better still: turn OFF public signups in Supabase and skip this path.
const ADMIN_INVITE_CODE = 'ABDULSALAMI-2025';

const LIMITS = { name: 120, category: 80, room: 120, contact: 200 };
const SEARCH_LIMIT_PER_MIN = 40;

/* ------------------------------ Cache -------------------------------- */

function readCache() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeCache(list) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/* ---------------------------- Synonyms ------------------------------- */

const SYNONYMS = {
  'food & cooking': ['food', 'cook', 'cooking', 'kitchen', 'meal', 'restaurant', 'eat', 'catering', 'chef'],
  'hair & barbing': ['hair', 'barber', 'barbing', 'salon', 'hairdresser', 'braid', 'braiding', 'weave', 'cut'],
  'phone & gadget repair': ['phone', 'gadget', 'repair', 'fix', 'screen', 'laptop', 'charger'],
  laundry: ['laundry', 'wash', 'washing', 'iron', 'ironing', 'dry cleaning'],
  tailoring: ['tailor', 'tailoring', 'sew', 'sewing', 'clothes', 'alteration'],
  'printing & documentation': ['print', 'printing', 'photocopy', 'document', 'scan', 'binding'],
  transport: ['transport', 'ride', 'bike', 'okada', 'cab', 'taxi', 'drop'],
  'phone credit & data': ['recharge', 'airtime', 'data', 'credit', 'top-up', 'topup'],
};

/* ----------------------------- Helpers ------------------------------- */

const normalize = (value) => (value || '').toString().toLowerCase().trim();

function expandQuery(query) {
  const q = normalize(query).slice(0, 60);
  const terms = new Set([q]);
  for (const [category, words] of Object.entries(SYNONYMS)) {
    if (q.includes(category) || words.some((w) => q.includes(w))) {
      terms.add(category);
      words.forEach((w) => terms.add(w));
    }
  }
  return Array.from(terms).filter((t) => t.length > 1);
}

function scoreBusiness(business, terms) {
  const name = normalize(business.name);
  const category = normalize(business.category);
  let score = 0;
  for (const term of terms) {
    if (name.includes(term)) score += 3;
    if (category.includes(term)) score += 2;
  }
  return score;
}

function searchBusinesses(businesses, query) {
  const terms = expandQuery(query);
  if (terms.length === 0) return [];
  return businesses
    .map((b) => ({ business: b, score: scoreBusiness(b, terms) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.business.name.localeCompare(b.business.name))
    .map((row) => row.business);
}

function toWhatsAppLink(business) {
  const contact = (business.contact || '').trim();
  if (/^https?:\/\//i.test(contact)) return contact;
  const digits = contact.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '#';
}

/** Validate business payload. Returns error string or null. */
function validateBusiness(payload) {
  const name = (payload.name || '').trim();
  const category = (payload.category || '').trim();
  const room = (payload.room || '').trim();
  const contact = (payload.contact || '').trim();
  if (name.length < 2) return 'Business name is too short.';
  if (name.length > LIMITS.name) return `Business name must be under ${LIMITS.name} characters.`;
  if (category.length < 2) return 'Category is too short.';
  if (category.length > LIMITS.category) return `Category must be under ${LIMITS.category} characters.`;
  if (room.length > LIMITS.room) return `Room must be under ${LIMITS.room} characters.`;
  if (contact.length < 3) return 'Contact looks too short.';
  if (contact.length > LIMITS.contact) return `Contact must be under ${LIMITS.contact} characters.`;
  return null;
}

/* ------------------------------ Icons -------------------------------- */

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2 22l5.36-1.4a9.84 9.84 0 004.68 1.19h.01c5.43 0 9.84-4.4 9.84-9.84 0-2.63-1.02-5.1-2.88-6.96A9.77 9.77 0 0012.04 2zm0 1.8c2.15 0 4.17.84 5.69 2.36a8 8 0 012.36 5.69c0 4.45-3.61 8.06-8.06 8.06a8.1 8.1 0 01-4.12-1.13l-.3-.17-3.05.8.81-2.98-.19-.31a8.03 8.03 0 01-1.23-4.28c0-4.45 3.62-8.05 8.09-8.05zm-2.6 3.9c-.19 0-.5.07-.76.36-.26.28-1 .97-1 2.37s1.02 2.75 1.16 2.94c.14.19 2 3.19 4.94 4.34 2.44.96 2.94.77 3.47.72.53-.05 1.71-.7 1.95-1.37.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.33-.29-.14-1.71-.84-1.97-.94-.26-.1-.46-.14-.65.14-.19.29-.74.94-.9 1.13-.17.19-.34.21-.63.07-.29-.14-1.21-.45-2.31-1.42-.85-.76-1.42-1.7-1.59-1.99-.17-.29-.02-.44.12-.58.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.65-1.57-.89-2.15-.23-.56-.47-.49-.65-.5h-.55z" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ------------------------------ Styles ------------------------------- */

const CSS = `
  * { box-sizing: border-box; }
  html, body, #root { min-height: 100%; }
  body { margin: 0; }

  :root {
    --cream:      #FBF4E8;
    --cream-card: #FFFDF8;
    --orange:     #C4763F;
    --orange-mid: #D89B6A;
    --orange-ink: #8E4F22;
    --ink:        #3B2E25;
    --muted:      #8B7A6B;
    --line:       rgba(196, 118, 63, 0.18);
  }

  .am-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 20px 72px;
    color: var(--ink);
    background:
      radial-gradient(900px 480px at 50% -12%, #FDF0DE 0%, rgba(253, 240, 222, 0) 72%),
      var(--cream);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .am-shell { width: 100%; max-width: 620px; margin: 0 auto; }

  .am-head { padding: 76px 0 40px; text-align: center; }
  .am-mark {
    width: 46px; height: 46px; margin: 0 auto 22px; border-radius: 14px;
    display: grid; place-items: center; background: var(--orange); color: var(--cream);
    font-size: 19px; font-weight: 700; letter-spacing: 0.04em;
    box-shadow: 0 14px 28px -14px rgba(142, 79, 34, 0.75);
  }
  .am-title { margin: 0; font-size: clamp(1.55rem, 5.4vw, 2.15rem); font-weight: 650; letter-spacing: -0.028em; line-height: 1.15; }
  .am-title span { color: var(--orange); }
  .am-sub { margin: 12px auto 0; max-width: 380px; font-size: 0.94rem; line-height: 1.55; color: var(--muted); }
  .am-about { margin: 26px 0 0; padding: 18px 0 0; border-top: 1px solid var(--line); font-size: .88rem; line-height: 1.7; color: var(--muted); }
  .am-auth-actions { display: flex; justify-content: flex-end; margin-top: 16px; }
  .am-auth-actions button { font: inherit; font-size: .82rem; color: var(--orange-ink); background: none; border: 0; cursor: pointer; text-decoration: underline; }
  .am-auth-divider { text-align: center; color: var(--muted); font-size: .82rem; margin: 4px 0; }

  .am-status {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: .74rem; color: var(--muted);
    background: rgba(196, 118, 63, 0.08);
    padding: 6px 12px; border-radius: 999px;
    margin-top: 18px;
  }
  .am-dot { width: 7px; height: 7px; border-radius: 50%; background: #5C8A43; }
  .am-dot.off { background: #B2543C; }

  .am-search {
    display: flex; align-items: center; gap: 12px; padding: 16px 22px;
    border-radius: 999px; background: var(--cream-card);
    border: 1.5px solid var(--line); color: var(--orange);
    box-shadow: 0 12px 34px -22px rgba(90, 60, 35, 0.6);
    transition: border-color .18s ease, box-shadow .18s ease;
  }
  .am-search:focus-within { border-color: var(--orange); box-shadow: 0 20px 44px -22px rgba(196, 118, 63, 0.8); }
  .am-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 1.03rem; color: var(--ink); }
  .am-search input::placeholder { color: #B6A697; }
  .am-clear { border: 0; background: rgba(196, 118, 63, 0.1); color: var(--orange-ink); width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; font-size: 15px; line-height: 1; transition: background .15s ease; }
  .am-clear:hover { background: rgba(196, 118, 63, 0.2); }

  .am-body { margin-top: 30px; }
  .am-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.13em; text-transform: uppercase; color: var(--muted); margin: 0 0 14px 4px; }
  .am-chips { display: flex; flex-wrap: wrap; gap: 9px; }
  .am-chip { border: 1px solid var(--line); background: var(--cream-card); color: var(--orange-ink); font: inherit; font-size: 0.85rem; padding: 9px 16px; border-radius: 999px; cursor: pointer; transition: background .15s ease, border-color .15s ease, transform .15s ease; }
  .am-chip:hover { background: rgba(196, 118, 63, 0.09); border-color: rgba(196, 118, 63, 0.42); transform: translateY(-1px); }

  .am-count { font-size: 0.82rem; color: var(--muted); margin: 0 0 14px 4px; }
  .am-list { display: flex; flex-direction: column; gap: 12px; }

  .am-card { display: block; text-decoration: none; color: inherit; background: var(--cream-card); border: 1px solid var(--line); border-radius: 18px; padding: 18px 20px 16px; transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
  .am-card:hover { transform: translateY(-2px); border-color: rgba(196, 118, 63, 0.5); box-shadow: 0 20px 38px -26px rgba(90, 60, 35, 0.75); }
  .am-card:active { transform: translateY(0); }
  .am-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .am-card-name { margin: 0; font-size: 1.02rem; font-weight: 650; letter-spacing: -0.012em; line-height: 1.3; }
  .am-tag { flex: none; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--orange-ink); background: rgba(196, 118, 63, 0.12); padding: 5px 10px; border-radius: 999px; white-space: nowrap; }
  .am-room { margin-top: 8px; font-size: 0.85rem; color: var(--muted); }
  .am-cta { margin-top: 15px; padding-top: 14px; border-top: 1px dashed rgba(196, 118, 63, 0.24); display: flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 600; color: var(--orange); }
  .am-card:hover .am-cta { color: var(--orange-ink); }

  .am-empty { text-align: center; padding: 44px 16px; color: var(--muted); font-size: 0.94rem; line-height: 1.6; }
  .am-empty strong { color: var(--ink); font-weight: 600; }

  .am-foot { margin-top: 52px; display: flex; justify-content: center; }
  .am-admin-btn { border: 0; background: transparent; font: inherit; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: #B09C8A; cursor: pointer; padding: 8px 14px; border-radius: 999px; transition: color .15s ease, background .15s ease; }
  .am-admin-btn:hover { color: var(--orange-ink); background: rgba(196, 118, 63, 0.08); }

  .am-overlay { position: fixed; inset: 0; background: rgba(59, 46, 37, 0.4); backdrop-filter: blur(3px); display: flex; justify-content: center; align-items: flex-start; padding: 40px 18px; overflow-y: auto; z-index: 50; animation: am-fade .16s ease; }
  @keyframes am-fade { from { opacity: 0 } to { opacity: 1 } }
  .am-panel { width: 100%; max-width: 560px; background: var(--cream-card); border-radius: 22px; padding: 26px 26px 30px; box-shadow: 0 40px 80px -40px rgba(59, 46, 37, 0.7); animation: am-rise .2s ease; }
  @keyframes am-rise { from { transform: translateY(10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

  .am-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 6px; }
  .am-panel-head h2 { margin: 0; font-size: 1.1rem; font-weight: 650; letter-spacing: -0.015em; }
  .am-icon-btn { border: 0; background: rgba(196, 118, 63, 0.1); color: var(--orange-ink); width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; transition: background .15s ease; }
  .am-icon-btn:hover { background: rgba(196, 118, 63, 0.22); }

  .am-panel-note { margin: 0 0 22px; font-size: 0.84rem; color: var(--muted); line-height: 1.5; }
  .am-form { display: flex; flex-direction: column; gap: 14px; }
  .am-row { display: flex; gap: 12px; }
  .am-row > * { flex: 1; min-width: 0; }
  .am-field { display: flex; flex-direction: column; gap: 6px; }
  .am-field label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .am-field input,
  .am-field select { font: inherit; font-size: 0.94rem; color: var(--ink); background: var(--cream); border: 1px solid var(--line); border-radius: 12px; padding: 11px 14px; outline: 0; transition: border-color .15s ease, box-shadow .15s ease; width: 100%; }
  .am-field input:focus,
  .am-field select:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(196, 118, 63, 0.14); }

  .am-submit { margin-top: 6px; border: 0; border-radius: 999px; padding: 13px 20px; font: inherit; font-size: 0.94rem; font-weight: 650; color: var(--cream); background: var(--orange); cursor: pointer; transition: background .15s ease, transform .15s ease; box-shadow: 0 14px 26px -16px rgba(142, 79, 34, 0.9); }
  .am-submit:hover { background: var(--orange-ink); transform: translateY(-1px); }
  .am-submit:active { transform: translateY(0); }
  .am-submit:disabled { opacity: .7; cursor: not-allowed; }

  .am-error { font-size: 0.84rem; color: #A8402C; background: rgba(168, 64, 44, 0.08); border-radius: 10px; padding: 10px 13px; }
  .am-ok { font-size: 0.84rem; color: #4B6B3A; background: rgba(75, 107, 58, 0.1); border-radius: 10px; padding: 10px 13px; }
  .am-divider { height: 1px; background: var(--line); margin: 28px 0 20px; }

  .am-admin-list { display: flex; flex-direction: column; gap: 8px; }
  .am-admin-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; border-radius: 12px; background: var(--cream); border: 1px solid transparent; }
  .am-admin-item strong { display: block; font-size: 0.9rem; font-weight: 600; }
  .am-admin-item small { display: block; font-size: 0.76rem; color: var(--muted); margin-top: 2px; }
  .am-del { border: 0; background: transparent; color: #B2543C; font: inherit; font-size: 0.76rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; padding: 6px 8px; border-radius: 8px; transition: background .15s ease; flex: none; }
  .am-del:hover { background: rgba(178, 84, 60, 0.1); }

  @media (max-width: 480px) {
    .am-head { padding: 52px 0 32px; }
    .am-row { flex-direction: column; gap: 14px; }
    .am-panel { padding: 22px 18px 24px; border-radius: 18px; }
    .am-card-top { flex-direction: column; gap: 8px; }
  }
`;

/* --------------------------- Admin console --------------------------- */

function AdminConsole({ businesses, onAdd, onDelete, onUpdate, onClose, onSignOut }) {
  const emptyForm = { name: '', category: '', room: '', contactType: 'phone', contact: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const knownCategories = useMemo(
    () => Array.from(new Set(businesses.map((b) => b.category))).sort(),
    [businesses]
  );

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const startEdit = (b) => {
    setEditingId(b.id);
    setForm({
      name: b.name || '',
      category: b.category || '',
      room: b.room || '',
      contactType: b.contactType || b.contact_type || 'phone',
      contact: b.contact || '',
    });
    setError('');
    setNotice('');
    document.querySelector('.am-overlay')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); setError(''); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice('');
    const validationError = validateBusiness(form);
    if (validationError) { setError(validationError); return; }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      room: form.room.trim(),
      contactType: form.contactType,
      contact: form.contact.trim(),
    };
    setBusy(true);
    try {
      if (editingId) {
        await onUpdate(editingId, payload);
        setNotice(`"${payload.name}" was updated.`);
        setEditingId(null);
      } else {
        await onAdd(payload);
        setNotice(`"${payload.name}" was saved to the cloud.`);
      }
      setError('');
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this business.');
    } finally { setBusy(false); }
  };

  return (
    <div className="am-overlay">
      <div className="am-panel" role="dialog" aria-modal="true" aria-label="Admin console">
        <div className="am-panel-head">
          <h2>Admin console</h2>
          <Button className="am-icon-btn" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </Button>
        </div>
        <div className="am-auth-actions"><Button variant="link" onClick={onSignOut}>Sign out</Button></div>
        <p className="am-panel-note">
          {editingId ? 'Editing a listing — change the details and save.' : 'Every listing is stored in the cloud. Contacts are turned into WhatsApp links automatically.'}
        </p>

        <form className="am-form" onSubmit={handleSubmit}>
          <div className="am-field">
            <label htmlFor="am-name">Business name</label>
            <input id="am-name" value={form.name} onChange={update('name')}
              placeholder="e.g. Ada's Laundry Point" maxLength={LIMITS.name} autoComplete="off" />
          </div>

          <div className="am-row">
            <div className="am-field">
              <label htmlFor="am-category">Category / service</label>
              <input id="am-category" list="am-category-options" value={form.category}
                onChange={update('category')} placeholder="e.g. Laundry"
                maxLength={LIMITS.category} autoComplete="off" />
              <datalist id="am-category-options">
                {knownCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="am-field">
              <label htmlFor="am-room">Room / location</label>
              <input id="am-room" value={form.room} onChange={update('room')}
                placeholder="e.g. Block B, Room 7" maxLength={LIMITS.room} autoComplete="off" />
            </div>
          </div>

          <div className="am-row">
            <div className="am-field">
              <label htmlFor="am-type">Contact type</label>
              <select id="am-type" value={form.contactType} onChange={update('contactType')}>
                <option value="phone">Phone number</option>
                <option value="whatsapp">WhatsApp link</option>
              </select>
            </div>
            <div className="am-field">
              <label htmlFor="am-contact">Contact</label>
              <input id="am-contact" value={form.contact} onChange={update('contact')}
                placeholder="+234 801 234 5678" maxLength={LIMITS.contact} autoComplete="off" />
            </div>
          </div>

          {error && <div className="am-error">{error}</div>}
          {notice && !error && <div className="am-ok">{notice}</div>}

          <Button className="am-submit" type="submit" disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add business'}
          </Button>
          {editingId && (
            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={busy}>Cancel edit</Button>
          )}
        </form>

        <div className="am-divider" />
        <p className="am-label" style={{ marginLeft: 0 }}>
          Listed businesses ({businesses.length})
        </p>
        <div className="am-admin-list">
          {businesses.length === 0 && <div className="am-empty" style={{ padding: '20px 0' }}>Nothing listed yet.</div>}
          {businesses.map((b) => (
            <div className="am-admin-item" key={b.id}>
              <div>
                <strong>{b.name}</strong>
                <small>{b.category}{b.room ? ` · ${b.room}` : ''} · {b.contact}</small>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button className="am-del" variant="ghost" onClick={() => startEdit(b)}>Edit</Button>
                <Button className="am-del" variant="ghost" onClick={() => onDelete(b.id)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Admin login ---------------------------- */

function AdminLogin({ onClose, onSignedIn, denied }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [mode, setMode] = useState('signIn');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      if (mode === 'register') {
        // First line of defense — server-side signup should also be disabled.
        if (invite.trim() !== ADMIN_INVITE_CODE) {
          throw new Error('Invalid invite code. Ask the marketplace owner for the current code.');
        }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/#admin` },
        });
        if (error) throw error;
        setMessage('Check your email to confirm your account. The owner must then approve your admin role before you can manage listings.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await onSignedIn();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not sign in. Please try again.');
    } finally { setBusy(false); }
  }

  async function googleSignIn() {
    setMessage(''); setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: `${window.location.origin}/#admin` });
      if (result.error) throw result.error;
      if (!result.redirected) await onSignedIn();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Google sign-in did not work.');
    } finally { setBusy(false); }
  }

  return (
    <div className="am-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="am-panel" role="dialog" aria-modal="true" aria-label="Admin login">
        <div className="am-panel-head">
          <h2>Admin login</h2>
          <Button className="am-icon-btn" variant="ghost" size="icon" onClick={onClose} aria-label="Close"><CloseIcon /></Button>
        </div>
        <p className="am-panel-note">Sign in with an approved admin account to manage businesses.</p>
        {denied && <p className="am-error">This account does not have admin access. Ask the owner to approve it.</p>}
        <form className="am-form" onSubmit={submit}>
          <div className="am-field">
            <label htmlFor="am-email">Email</label>
            <input id="am-email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="am-field">
            <label htmlFor="am-password">Password</label>
            <input id="am-password" type="password" minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {mode === 'register' && (
            <div className="am-field">
              <label htmlFor="am-invite">Invite code</label>
              <input id="am-invite" type="password" required value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="Ask the owner for this code" />
            </div>
          )}
          {message && <p className="am-panel-note" role="status">{message}</p>}
          <Button className="am-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : (mode === 'register' ? 'Create account' : 'Sign in')}
          </Button>
          <p className="am-auth-divider">or</p>
          <Button type="button" variant="outline" onClick={googleSignIn} disabled={busy}>Continue with Google</Button>
        </form>
        <div className="am-auth-actions">
          <Button variant="link" onClick={() => { setMode(mode === 'register' ? 'signIn' : 'register'); setMessage(''); }}>
            {mode === 'register' ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ App ---------------------------------- */

export default function App() {
  const [businesses, setBusinesses] = useState(() => readCache());
  const [query, setQuery] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminStatus, setAdminStatus] = useState('loading');
  const [dataError, setDataError] = useState('');
  const [syncedAt, setSyncedAt] = useState(null);

  // Per-browser search rate limiter
  const searchHits = useRef([]);
  const [rateLimited, setRateLimited] = useState(false);

  const refreshBusinesses = async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select('id,name,category,room,contact_type,contact')
      .order('created_at');
    if (error) {
      setDataError('Could not reach the cloud. Showing your last cached copy.');
      // Fall back to cached list so the user still sees data
      setBusinesses((prev) => (prev.length ? prev : readCache()));
    } else {
      const list = data || [];
      setBusinesses(list);
      writeCache(list);        // <-- the safety net
      setDataError('');
      setSyncedAt(new Date());
    }
  };

  const checkAdmin = async () => {
    setAdminStatus('loading');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAdminStatus('signedOut'); return; }
    const { data, error } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    setAdminStatus(!error && data?.role === 'admin' ? 'admin' : 'denied');
  };

  useEffect(() => {
    const check = () => setAdminOpen(window.location.hash === '#admin');
    check();
    refreshBusinesses();
    checkAdmin();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => { void checkAdmin(); }, 0);
      }
    });
    window.addEventListener('hashchange', check);
    return () => { window.removeEventListener('hashchange', check); subscription.unsubscribe(); };
  }, []);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;

  // Enforce the rate limit only when actually searching
  useEffect(() => {
    if (!isSearching) return;
    const now = Date.now();
    searchHits.current = searchHits.current.filter((t) => now - t < 60_000);
    if (searchHits.current.length >= SEARCH_LIMIT_PER_MIN) {
      setRateLimited(true);
    } else {
      searchHits.current.push(now);
      setRateLimited(false);
    }
  }, [trimmedQuery, isSearching]);

  const results = useMemo(
    () => (isSearching && !rateLimited ? searchBusinesses(businesses, trimmedQuery) : []),
    [businesses, trimmedQuery, isSearching, rateLimited]
  );

  const suggestions = useMemo(() => {
    const fromData = Array.from(new Set(businesses.map((b) => b.category)));
    const fromSynonyms = Object.keys(SYNONYMS).map((key) =>
      key.replace(/\b\w/g, (c) => c.toUpperCase())
    );
    const all = Array.from(new Set([...fromData, ...fromSynonyms]));
    // Shuffle (Fisher–Yates) so a fresh page load shows a new trio of suggestions
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, 3);
  }, [businesses]);

  const handleAdd = async (payload) => {
    const validationError = validateBusiness(payload);
    if (validationError) throw new Error(validationError);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { await checkAdmin(); throw new Error('Please sign in again.'); }

    const { error } = await supabase.from('businesses').insert({
      name: payload.name,
      category: payload.category,
      room: payload.room,
      contact_type: payload.contactType,
      contact: payload.contact,
      added_by: user.id,
    });
    if (error) throw new Error('Could not save this business. Check your admin access and try again.');
    await refreshBusinesses();
  };

  const handleUpdate = async (id, payload) => {
    const validationError = validateBusiness(payload);
    if (validationError) throw new Error(validationError);
    const { error } = await supabase.from('businesses').update({
      name: payload.name,
      category: payload.category,
      room: payload.room,
      contact_type: payload.contactType,
      contact: payload.contact,
    }).eq('id', id);
    if (error) throw new Error('Could not update this business. Check your admin access and try again.');
    await refreshBusinesses();
  };

  const handleDelete = async (id) => {
    const target = businesses.find((b) => b.id === id);
    if (!target) return;
    if (!window.confirm(`Remove "${target.name}" from the marketplace?`)) return;
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) { window.alert('Could not remove this business. Check your admin access and try again.'); return; }
    await refreshBusinesses();
  };

  const closeAdmin = () => {
    setAdminOpen(false);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    setAdminStatus('signedOut');
    closeAdmin();
  };

  return (
    <div className="am-root">
      <style>{CSS}</style>

      <div className="am-shell">
        <header className="am-head">
          <div className="am-mark">AM</div>
          <h1 className="am-title">
            Abdulsalami <span>Marketplace</span>
          </h1>
          <p className="am-sub">
            Search a service or a business name — then tap to chat with them on WhatsApp.
          </p>
          {syncedAt && (
            <div className="am-status">
              <span className={`am-dot ${dataError ? 'off' : ''}`} />
              {dataError ? 'Showing cached listings' : `Cloud-synced · ${syncedAt.toLocaleTimeString()}`}
            </div>
          )}
        </header>

        <div className="am-search">
          <SearchIcon />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 60))}
            placeholder="Try “barber”, “laundry”, “phone repair”…"
            aria-label="Search businesses and services"
            autoComplete="off"
            spellCheck="false"
            autoFocus
          />
          {query && (
            <button className="am-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
          )}
        </div>

        <main className="am-body">
          {dataError && <p className="am-error" role="alert">{dataError}</p>}

          {rateLimited && isSearching && (
            <div className="am-empty">
              You’re searching very quickly. Please wait a moment and try again.
            </div>
          )}

          {!isSearching && (
            <>
              <p className="am-label">Suggested searches</p>
              <div className="am-chips">
                {suggestions.map((s) => (
                  <button key={s} className="am-chip" onClick={() => setQuery(s)}>{s}</button>
                ))}
              </div>
            </>
          )}

          {isSearching && !rateLimited && results.length > 0 && (
            <>
              <p className="am-count">
                {results.length} {results.length === 1 ? 'business' : 'businesses'} found
              </p>
              <div className="am-list">
                {results.map((b) => (
                  <a key={b.id} className="am-card" href={toWhatsAppLink(b)}
                     target="_blank" rel="noopener noreferrer">
                    <div className="am-card-top">
                      <h3 className="am-card-name">{b.name}</h3>
                      <span className="am-tag">{b.category}</span>
                    </div>
                    {b.room && <div className="am-room">📍 {b.room}</div>}
                    <div className="am-cta">
                      <WhatsAppIcon />
                      Chat on WhatsApp
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          {isSearching && !rateLimited && results.length === 0 && (
            <div className="am-empty">
              No business matches <strong>“{trimmedQuery}”</strong> yet.
              <br />
              Try another word.
            </div>
          )}
        </main>

        <p className="am-about">
          The Abdulsalami Marketplace is an outfit aimed to make consumers meet goods and service
          providers and likewise help businesses thrive by making them readily accessible to members
          of the hall. Please note that all transactions should be finalized only after due diligence
          has been done. Have fun shopping.
        </p>
      </div>

      {adminOpen && adminStatus === 'admin' && (
        <AdminConsole
          businesses={businesses}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onClose={closeAdmin}
          onSignOut={signOut}
        />
      )}

      {adminOpen && (adminStatus === 'signedOut' || adminStatus === 'denied') && (
        <AdminLogin
          denied={adminStatus === 'denied'}
          onClose={closeAdmin}
          onSignedIn={checkAdmin}
        />
      )}
    </div>
  );
}