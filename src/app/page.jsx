import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, AUTH_DISABLED } from "@/lib/auth";
import MetroDeProyectos from "@/components/MetroDeProyectos";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Acceso abierto temporal (sin Google): entra todo el mundo como Administrador.
  if (AUTH_DISABLED) {
    return <MetroDeProyectos role="admin" user={{ name: "Invitado", email: "" }} />;
  }

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <MetroDeProyectos
      role={session.user.role || "visualizador"}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    />
  );
}
