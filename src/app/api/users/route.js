import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, AUTH_DISABLED } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!AUTH_DISABLED) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("No autorizado", { status: 401 });
    }
    if (session.user.role !== "admin") {
      return new NextResponse("Acceso denegado: se requieren permisos de administrador", { status: 403 });
    }
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        roles: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return new NextResponse("Error interno del servidor", { status: 500 });
  }
}
