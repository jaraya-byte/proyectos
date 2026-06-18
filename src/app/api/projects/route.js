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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("No autorizado", { status: 401 });
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(projects);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin")
    return new NextResponse("Solo los administradores pueden crear proyectos", { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (name.length < 2) return new NextResponse("El nombre es obligatorio", { status: 400 });
  if (!PILLARS.includes(b.pillar)) return new NextResponse("Pilar inválido", { status: 400 });

  const created = await prisma.project.create({
    data: {
      pillar: b.pillar,
      name,
      month: clampInt(b.month, 1, 8, 1),
      plan: clampInt(b.plan, 1, 6, 2),
      done: 0,
      responsable: String(b.responsable || "Sin asignar"),
      tecnico: String(b.tecnico || ""),
    },
  });
  return NextResponse.json(created, { status: 201 });
}
