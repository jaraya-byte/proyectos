# Metro de Proyectos — COFERSA

Aplicación web para el seguimiento de proyectos por pilar estratégico, con la metáfora de un mapa de metro. Pensada para uso del equipo y de la organización: **inicio de sesión con Google Workspace restringido a los dominios corporativos**, **roles** (Administrador / Carga de datos / Visualizador) y un **único tablero compartido** respaldado por una base de datos.

Stack: **Next.js 14 (App Router) · NextAuth (Google) · Prisma + PostgreSQL · Tailwind CSS**. Diseñado para desplegarse en **Vercel** con el código en **GitHub**.

---

## 1. Requisitos

- Node.js 18.18+ (o 20+)
- Una base de datos PostgreSQL (recomendado: **Vercel Postgres / Neon**)
- Un proyecto en **Google Cloud Console** para el inicio de sesión

---

## 2. Instalación local

```bash
npm install
cp .env.example .env        # y completa los valores (ver más abajo)
npm run db:push             # crea las tablas en la base de datos
npm run db:seed             # carga datos de ejemplo (opcional)
npm run dev                 # http://localhost:3000
```

---

## 3. Variables de entorno

Edita `.env` (local) o configúralas en Vercel (Project → Settings → Environment Variables):

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Cadena de conexión Postgres (la entrega Vercel/Neon). |
| `NEXTAUTH_SECRET` | Secreto de sesión. Genera con `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | `http://localhost:3000` en local; tu dominio en producción. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciales OAuth de Google. |
| `ALLOWED_DOMAINS` | Dominios que pueden entrar, separados por coma. |
| `ADMIN_EMAILS` | Correos con rol Administrador, separados por coma. |
| `EDITOR_EMAILS` | Correos con rol Carga de datos, separados por coma. |

Valor sugerido para los dominios del grupo:

```
ALLOWED_DOMAINS="mayoreo.biz,febeca.com,mundipartes.com,cofersa.cr,sillaca.biz,beval.biz"
```

---

## 4. Configurar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → **APIs y servicios → Credenciales**.
2. **Crear credenciales → ID de cliente de OAuth → Aplicación web**.
3. En **URIs de redireccionamiento autorizados** agrega:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Producción: `https://proyectos.cofersa.cr/api/auth/callback/google`
4. En **Orígenes de JavaScript autorizados**: `http://localhost:3000` y `https://proyectos.cofersa.cr`.
5. Copia el **Client ID** y **Client Secret** a las variables de entorno.

> El acceso ya queda limitado a los dominios de `ALLOWED_DOMAINS` mediante el callback de inicio de sesión, así que aunque alguien tenga una cuenta de Google personal no podrá entrar.

---

## 5. Roles

Los roles se asignan por correo, sin necesidad de una pantalla de administración en esta versión:

- **Administrador** (`ADMIN_EMAILS`): crea, edita y elimina proyectos; ajusta duración y avance.
- **Carga de datos** (`EDITOR_EMAILS`): actualiza el avance de etapas y el responsable técnico.
- **Visualizador** (todos los demás de los dominios permitidos): solo lectura.

Para hacer a alguien administrador, añade su correo a `ADMIN_EMAILS` y vuelve a desplegar (o actualiza la variable en Vercel y haz redeploy). El rol se refresca al volver a iniciar sesión.

---

## 6. Despliegue en Vercel

1. Sube el repositorio a **GitHub**.
2. En **Vercel → Add New → Project**, importa el repo. Framework: **Next.js** (se detecta solo).
3. En **Storage**, crea una base **Postgres** (Neon); Vercel inyecta `DATABASE_URL` automáticamente.
4. Agrega el resto de variables de entorno de la sección 3 (incluye `NEXTAUTH_URL` con tu dominio final).
5. **Deploy.** Durante el build, el proyecto crea las tablas (`prisma db push`) y carga los datos de ejemplo automáticamente, así que **no necesitas ejecutar nada en una terminal**. La semilla solo se aplica si la base está vacía, por lo que es seguro en cada redeploy.

---

## 7. Dominio propio

En **Vercel → Project → Settings → Domains**, agrega el subdominio, por ejemplo `proyectos.cofersa.cr`, y crea en tu DNS el registro **CNAME** que Vercel indique. Cuando el dominio esté activo, actualiza `NEXTAUTH_URL` y las URIs de redireccionamiento en Google con ese dominio.

Puedes apuntar subdominios desde cualquiera de los dominios del grupo (p. ej. `proyectos.febeca.com`); el inicio de sesión seguirá aceptando correos de todos los dominios de `ALLOWED_DOMAINS`, sin importar por cuál URL entren.

---

## 8. Estructura

```
src/
  app/
    api/auth/[...nextauth]/route.js   Inicio de sesión (NextAuth + Google)
    api/projects/route.js             Listar / crear proyectos
    api/projects/[id]/route.js        Actualizar / eliminar proyecto
    login/page.jsx                    Pantalla de acceso
    page.jsx                          Página principal (valida sesión)
    layout.jsx, globals.css
  components/MetroDeProyectos.jsx     Interfaz del tablero
  lib/auth.js                         Reglas de dominios y roles
  lib/prisma.js                       Cliente de base de datos
prisma/
  schema.prisma                       Modelo Project
  seed.mjs                            Datos de ejemplo
```

---

## 9. Notas

- Los datos son **compartidos**: todo el grupo ve y edita el mismo tablero (la autorización por rol se valida en el servidor, no solo en la interfaz).
- El "mes actual" está fijado en **Junio** (`TODAY_MONTH = 2` en `MetroDeProyectos.jsx`) y la duración por defecto de proyectos nuevos es **2 meses** (`DEFAULT_PLAN`). Ajústalos según tu calendario.
- Para empezar de cero, vacía la tabla `Project` (`npm run db:studio`) y vuelve a ejecutar la semilla.
