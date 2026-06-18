import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PILLARS = ["ingresos", "eficiencia", "procesos", "talento"];
const clampInt = (v, min, max, def) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
};

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "admin" && role !== "carga")
    return new NextResponse("Sin permiso para editar", { status: 403 });

  const b = await req.json().catch(() => ({}));
  const data = {};

  // Avance de etapas y responsable técnico: admin y carga
  if (b.done !== undefined) data.done = clampInt(b.done, 0, 6, 0);
  if (b.tecnico !== undefined) data.tecnico = String(b.tecnico);

  // Edición estructural: solo admin
  if (role === "admin") {
    if (b.plan !== undefined) data.plan = clampInt(b.plan, 1, 6, 2);
    if (b.month !== undefined) data.month = clampInt(b.month, 1, 8, 1);
    if (b.responsable !== undefined) data.responsable = String(b.responsable);
    if (b.name !== undefined) data.name = String(b.name).trim();
    if (b.pillar !== undefined && PILLARS.includes(b.pillar)) data.pillar = b.pillar;
  }

  if (Object.keys(data).length === 0)
    return new NextResponse("Nada que actualizar", { status: 400 });

  try {
    const updated = await prisma.project.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch {
    return new NextResponse("Proyecto no encontrado", { status: 404 });
  }
}

export async function DELETE(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin")
    return new NextResponse("Solo los administradores pueden eliminar", { status: 403 });
  try {
    await prisma.project.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse("Proyecto no encontrado", { status: 404 });
  }
}
