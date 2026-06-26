import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

// ───────────────────────────────────────────────────────────────
// INTERRUPTOR DE ACCESO
// Mientras no estén listas las credenciales de Google, la app queda
// ABIERTA (todos entran como Administrador, sin iniciar sesión).
// Cuando tengas el GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET, cambia
// esta línea a  false  y vuelve a desplegar para exigir login.
const list = (v) =>
  (v || "")
    .split(",")
    .map((s) => s.replace(/['"]+/g, "").trim().toLowerCase())
    .filter(Boolean);

export const AUTH_DISABLED =
  process.env.AUTH_DISABLED === "true" ||
  !process.env.GOOGLE_CLIENT_ID ||
  !process.env.GOOGLE_CLIENT_SECRET;

const ALLOWED_DOMAINS = list(process.env.ALLOWED_DOMAINS);
const ADMIN_EMAILS = list(process.env.ADMIN_EMAILS);
const EDITOR_EMAILS = list(process.env.EDITOR_EMAILS);

const domainOf = (email) => (email || "").split("@")[1]?.toLowerCase() || "";

export function roleFor(email) {
  const e = (email || "").toLowerCase();
  if (ADMIN_EMAILS.includes(e)) return "admin";
  if (EDITOR_EMAILS.includes(e)) return "carga";
  return "carga"; // Por defecto, otorgar permisos de escritura/carga para registro de avances
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
    async jwt({ token, user }) {
      if (token.email) {
        try {
          // 1. Buscar el usuario en la base de datos
          let dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            include: { roles: true }
          });

          // 2. Si no existe, registrarlo usando los valores iniciales de email arrays
          if (!dbUser) {
            const initialRole = roleFor(token.email); // admin, carga, o visualizador
            dbUser = await prisma.user.create({
              data: {
                email: token.email,
                name: token.name || user?.name,
                image: token.picture || user?.image,
                roles: {
                  create: { role: initialRole }
                }
              },
              include: { roles: true }
            });
          }

          // 3. Extraer los roles
          const roles = dbUser.roles.map(r => r.role);
          token.roles = roles;
          token.role = roles[0] || "visualizador"; // Rol principal para mantener compatibilidad

          // 4. Buscar permisos de módulo en DB asociados a sus roles
          const permissions = await prisma.modulePermission.findMany({
            where: { role: { in: roles } }
          });

          token.permissions = permissions.map(p => ({
            modulo: p.modulo,
            permissionType: p.permissionType
          }));
        } catch (error) {
          console.error("Error al recuperar roles/permisos de DB:", error);
          // Fallback en caso de error de conexión o base de datos no migrada aún
          token.roles = [roleFor(token.email)];
          token.role = token.roles[0];
          token.permissions = [];
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role || "visualizador";
        session.user.roles = token.roles || ["visualizador"];
        session.user.permissions = token.permissions || [];
      }
      return session;
    },
  },
};
