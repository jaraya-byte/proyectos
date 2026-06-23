import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, AUTH_DISABLED } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PILLARS = ["ingresos", "eficiencia", "procesos", "talento"];
const clampInt = (v, min, max, def) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
};

const MESES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function weekStartLabel(ts = Date.now()) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getDate()} ${MESES_ABBR[d.getMonth()]}`;
}

export async function PATCH(req, { params }) {
  let role = "admin";
  if (!AUTH_DISABLED) {
    const session = await getServerSession(authOptions);
    role = session?.user?.role;
    if (role !== "admin" && role !== "carga")
      return new NextResponse("Sin permiso para editar", { status: 403 });
  }

  const b = await req.json().catch(() => ({}));

  // Avance semanal: agregar o eliminar entradas
  if (b.addUpdate || b.removeUpdate) {
    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) return new NextResponse("Proyecto no encontrado", { status: 404 });
    let updates = Array.isArray(existing.updates) ? existing.updates : [];
    if (b.addUpdate) {
      const text = String(b.addUpdate.text || "").trim();
      if (!text) return new NextResponse("El avance no puede estar vacío", { status: 400 });
      updates = [...updates, { id: `u${Date.now()}`, ts: Date.now(), week: weekStartLabel(), author: existing.tecnico || "—", text }];
    }
    if (b.removeUpdate) {
      if (role !== "admin") return new NextResponse("Solo administradores eliminan avances", { status: 403 });
      updates = updates.filter((u) => u.id !== b.removeUpdate);
    }
    const updated = await prisma.project.update({ where: { id: params.id }, data: { updates } });
    return NextResponse.json(updated);
  }

  const data = {};

  if (b.done !== undefined) data.done = clampInt(b.done, 0, 6, 0);
  if (b.tecnico !== undefined) data.tecnico = String(b.tecnico);

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
  if (!AUTH_DISABLED) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "admin")
      return new NextResponse("Solo los administradores pueden eliminar", { status: 403 });
  }
  try {
    await prisma.project.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse("Proyecto no encontrado", { status: 404 });
  }
}
