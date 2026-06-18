import GoogleProvider from "next-auth/providers/google";

// ───────────────────────────────────────────────────────────────
// INTERRUPTOR DE ACCESO
// Mientras no estén listas las credenciales de Google, la app queda
// ABIERTA (todos entran como Administrador, sin iniciar sesión).
// Cuando tengas el GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET, cambia
// esta línea a  false  y vuelve a desplegar para exigir login.
export const AUTH_DISABLED = true;
// ───────────────────────────────────────────────────────────────

const list = (v) =>
  (v || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const ALLOWED_DOMAINS = list(process.env.ALLOWED_DOMAINS);
const ADMIN_EMAILS = list(process.env.ADMIN_EMAILS);
const EDITOR_EMAILS = list(process.env.EDITOR_EMAILS);

const domainOf = (email) => (email || "").split("@")[1]?.toLowerCase() || "";

export function roleFor(email) {
  const e = (email || "").toLowerCase();
  if (ADMIN_EMAILS.includes(e)) return "admin";
  if (EDITOR_EMAILS.includes(e)) return "carga";
  return "visualizador";
}

export function isAllowed(email) {
  if (!email) return false;
  if (ALLOWED_DOMAINS.length === 0) return true;
  return ALLOWED_DOMAINS.includes(domainOf(email));
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ profile, user }) {
      const email = profile?.email || user?.email;
      if (profile && profile.email_verified === false) return false;
      return isAllowed(email);
    },
    async jwt({ token }) {
      token.role = roleFor(token.email);
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.role = token.role || "visualizador";
      return session;
    },
  },
};
