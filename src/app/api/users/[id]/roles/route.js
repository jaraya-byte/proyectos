import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, AUTH_DISABLED } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req, { params }) {
  const userId = params.id;

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
    const body = await req.json().catch(() => ({}));
    const rolesInput = body.roles;

    if (!Array.isArray(rolesInput)) {
      return new NextResponse("Los roles deben ser un arreglo", { status: 400 });
    }

    const validRoles = ["admin", "carga", "visualizador"];
    for (const r of rolesInput) {
      if (!validRoles.includes(r)) {
        return new NextResponse(`Rol inválido: ${r}`, { status: 400 });
      }
    }

    // Comprobar si el usuario existe
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser) {
      return new NextResponse("Usuario no encontrado", { status: 404 });
    }

    // Actualizar roles en una transacción
    await prisma.$transaction(async (tx) => {
      // Eliminar roles existentes
      await tx.userRole.deleteMany({
        where: { userId },
      });

      // Crear nuevos roles
      if (rolesInput.length > 0) {
        await tx.userRole.createMany({
          data: rolesInput.map((role) => ({
            userId,
            role,
          })),
        });
      }
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error al actualizar roles de usuario:", error);
    return new NextResponse("Error interno del servidor", { status: 500 });
  }
}
