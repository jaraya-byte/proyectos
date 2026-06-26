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
    const permissions = await prisma.modulePermission.findMany();
    return NextResponse.json(permissions);
  } catch (error) {
    console.error("Error al obtener permisos de módulo:", error);
    return new NextResponse("Error interno del servidor", { status: 500 });
  }
}

export async function PUT(req) {
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
    const { role, modulo, permissions } = body;

    const validRoles = ["admin", "carga", "visualizador"];
    const validPermissions = ["read", "write", "delete"];

    if (!validRoles.includes(role)) {
      return new NextResponse(`Rol inválido: ${role}`, { status: 400 });
    }

    if (!modulo || typeof modulo !== "string") {
      return new NextResponse("Módulo inválido", { status: 400 });
    }

    if (!Array.isArray(permissions)) {
      return new NextResponse("Los permisos deben ser un arreglo", { status: 400 });
    }

    for (const p of permissions) {
      if (!validPermissions.includes(p)) {
        return new NextResponse(`Tipo de permiso inválido: ${p}`, { status: 400 });
      }
    }

    // Actualizar permisos del rol para el módulo en una transacción
    await prisma.$transaction(async (tx) => {
      // Eliminar permisos existentes de este rol y módulo
      await tx.modulePermission.deleteMany({
        where: {
          role,
          modulo,
        },
      });

      // Crear nuevos permisos
      if (permissions.length > 0) {
        await tx.modulePermission.createMany({
          data: permissions.map((p) => ({
            role,
            modulo,
            permissionType: p,
          })),
        });
      }
    });

    const updatedPermissions = await prisma.modulePermission.findMany();
    return NextResponse.json(updatedPermissions);
  } catch (error) {
    console.error("Error al guardar permisos de módulo:", error);
    return new NextResponse("Error interno del servidor", { status: 500 });
  }
}
