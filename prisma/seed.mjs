import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// pillar, name, month, responsable, done, plan, tecnico
const SEED = [
  ["ingresos", "Masificación Portales CDR", 1, "Equipo Portales", 5, 3, "Carlos Méndez"],
  ["ingresos", "Portal Beval", 2, "Equipo Portales", 4, 3, "Ana Rivas"],
  ["ingresos", "AFV · Cobranza Inteligente", 2, "Equipo AFV", 3, 2, "Luis Tovar"],
  ["ingresos", "Portal Mundi", 3, "Equipo Portales", 2, 3, "Ana Rivas"],
  ["eficiencia", "DM Anomalías", 1, "Equipo Datos", 5, 1, "Pedro Salas"],
  ["eficiencia", "Servicio Clientes", 1, "Equipo Servicio", 4, 1, "María León"],
  ["eficiencia", "Integración Beval / Sillaca", 2, "Equipo Integraciones", 3, 3, "Jorge Pino"],
  ["eficiencia", "Integraciones Next / eFlow", 2, "Equipo Integraciones", 3, 3, "Jorge Pino"],
  ["eficiencia", "Gestor de Portales", 3, "Equipo Portales", 2, 2, "Carlos Méndez"],
  ["eficiencia", "Integración Mundi", 4, "Equipo Integraciones", 1, 2, "Jorge Pino"],
  ["eficiencia", "Arquitectura H2H Kyriba", 5, "Arquitectura", 0, 2, "Sofía Cano"],
  ["procesos", "Homologación SENIAT", 1, "Equipo Fiscal", 6, 2, "Ricardo Páez"],
  ["procesos", "Sincronizador AFV", 2, "Equipo AFV", 4, 2, "Luis Tovar"],
  ["procesos", "DM Fletes", 2, "Equipo Datos", 3, 2, "Pedro Salas"],
  ["procesos", "Update Softland VE", 2, "Equipo ERP", 3, 2, "Diana Ortiz"],
  ["procesos", "DM Promociones", 3, "Equipo Datos", 2, 2, "Pedro Salas"],
  ["procesos", "Softland OLO VE", 3, "Equipo ERP", 2, 2, "Diana Ortiz"],
  ["procesos", "Orquestador AFV", 4, "Equipo AFV", 1, 2, "Luis Tovar"],
  ["talento", "Portal Interno", 1, "Equipo Talento", 5, 2, "Gabriela Ruiz"],
  ["talento", "Contenido Certificación Sistemas", 2, "Equipo Talento", 3, 2, "Gabriela Ruiz"],
  ["talento", "IA Pro · licencias", 2, "Equipo Talento", 4, 1, "Gabriela Ruiz"],
];

async function main() {
  // 1. Sembrar proyectos
  const count = await prisma.project.count();
  if (count === 0) {
    for (const [pillar, name, month, responsable, done, plan, tecnico] of SEED) {
      await prisma.project.create({ data: { pillar, name, month, responsable, done, plan, tecnico } });
    }
    console.log(`Semilla cargada: ${SEED.length} proyectos.`);
  } else {
    console.log(`La base ya tiene ${count} proyectos. Semilla de proyectos omitida.`);
  }

  // 2. Sembrar permisos por defecto
  const permissionsCount = await prisma.modulePermission.count();
  if (permissionsCount === 0) {
    const defaultPermissions = [
      // admin
      { role: "admin", modulo: "projects", permissionType: "read" },
      { role: "admin", modulo: "projects", permissionType: "write" },
      { role: "admin", modulo: "projects", permissionType: "delete" },
      // carga
      { role: "carga", modulo: "projects", permissionType: "read" },
      { role: "carga", modulo: "projects", permissionType: "write" },
      // visualizador
      { role: "visualizador", modulo: "projects", permissionType: "read" },
      { role: "visualizador", modulo: "projects", permissionType: "write" },
    ];
    for (const p of defaultPermissions) {
      await prisma.modulePermission.create({ data: p });
    }
    console.log("Permisos de módulo sembrados con éxito.");
  } else {
    console.log(`La base ya tiene ${permissionsCount} permisos de módulo. Semilla de permisos omitida.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
