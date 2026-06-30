const SUPABASE_URL = sb_publishable_0BxO282ZNBxUD1bf-UTaUg_jRqKAswX;
const SUPABASE_ANON_KEY = sb_secret_pNfa3VmnRTj_xJ4Pw89mfg_foSrpc2g;

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentCompany = null;
let currentPlan = null;

async function requireAuth() {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  currentUser = session.user;
  currentCompany = session.user.user_metadata?.company_name || "Ditt företag";
  currentPlan = session.user.user_metadata?.plan || "pro";
  renderUserBadge();
  return session.user;
}

function renderUserBadge() {
  const badge = document.createElement('div');
  badge.id = 'ob-user-badge';
  badge.style.cssText = `
    position: fixed; top: 12px; right: 24px; z-index: 200;
    display: flex; align-items: center; gap: 10px;
    background: #1B181C; border: 1px solid #2E2A2F; border-radius: 100px;
    padding: 6px 8px 6px 16px; font-family: Inter, sans-serif; font-size: 0.78rem;
    color: #9A8F88; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  `;
  badge.innerHTML = `
    <span>${currentCompany}</span>
    <span style="font-family:'JetBrains Mono',monospace; font-size:0.65rem; color:#FFB088; background:rgba(255,139,94,0.12); padding:2px 8px; border-radius:100px; text-transform:uppercase;">${currentPlan}</span>
    <button id="ob-logout-btn" style="background:#221F23; border:1px solid #2E2A2F; color:#F4EFE9; border-radius:100px; padding:5px 12px; font-size:0.75rem; cursor:pointer; font-family:Inter,sans-serif;">Logga ut</button>
  `;
  document.body.appendChild(badge);
  document.getElementById('ob-logout-btn').addEventListener('click', handleLogout);
}

async function handleLogout() {
  await _sb.auth.signOut();
  window.location.href = "login.html";
}

// Run immediately on every page that includes this script
requireAuth();
