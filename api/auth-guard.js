// OnBrain — auth-guard.js
// Kollar att användaren är inloggad på alla appsidor.
// Dashboard och andra sidor hanterar sin egen navbar.

const SUPABASE_URL = "https://nbtvsojkkrfamvfnddoc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0BxO282ZNBxUD1bf-UTaUg_jRqKAswX";

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
  }
})();
