"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users, Shield, Upload, Eye, Check, Loader2, AlertTriangle, Save, RefreshCw, Info
} from "lucide-react";

const C = {
  page: "#FFFFFF", panel: "#F6F8FB", border: "#E2E7EF", borderStrong: "#D3DAE6",
  ink: "#1A1F2B", muted: "#5A6577", faint: "#8C95A6", track: "#E2E7EF",
  risk: "#DC2626", riskBg: "#FEF2F2", done: "#059669",
};

const ROLES_META = {
  admin: { label: "Administrador", Icon: Shield, color: "#DC2626", bg: "#FEF2F2" },
  carga: { label: "Carga de Datos", Icon: Upload, color: "#D97706", bg: "#FFFBEB" },
  visualizador: { label: "Visualizador", Icon: Eye, color: "#2563EB", bg: "#EFF4FF" }
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Estados locales para la edición
  const [userRolesDraft, setUserRolesDraft] = useState({}); // userId -> Array of Role strings
  const [savingUser, setSavingUser] = useState({}); // userId -> boolean
  const [permissionsDraft, setPermissionsDraft] = useState({}); // role -> { read: bool, write: bool, delete: bool }
  const [savingPermissions, setSavingPermissions] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Obtener usuarios
      const usersRes = await fetch("/api/users");
      if (!usersRes.ok) throw new Error(await usersRes.text() || "Error al obtener usuarios");
      const usersData = await usersRes.json();
      setUsers(usersData);

      // Inicializar borrador de roles
      const initialRolesDraft = {};
      usersData.forEach(u => {
        initialRolesDraft[u.id] = u.roles.map(r => r.role);
      });
      setUserRolesDraft(initialRolesDraft);

      // 2. Obtener permisos de módulo
      const permRes = await fetch("/api/permissions");
      if (!permRes.ok) throw new Error(await permRes.text() || "Error al obtener permisos");
      const permData = await permRes.json();
      setPermissions(permData);

      // Inicializar borrador de matriz de permisos
      const initialPermsDraft = {
        admin: { read: false, write: false, delete: false },
        carga: { read: false, write: false, delete: false },
        visualizador: { read: false, write: false, delete: false }
      };

      permData.forEach(p => {
        if (p.modulo === "projects" && initialPermsDraft[p.role]) {
          initialPermsDraft[p.role][p.permissionType] = true;
        }
      });
      setPermissionsDraft(initialPermsDraft);

    } catch (e) {
      console.error(e);
      setError(e.message || "Error al comunicar con la base de datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manejar cambio de roles para un usuario
  const handleRoleToggle = (userId, role) => {
    setUserRolesDraft(prev => {
      const currentRoles = prev[userId] || [];
      const nextRoles = currentRoles.includes(role)
        ? currentRoles.filter(r => r !== role)
        : [...currentRoles, role];
      return { ...prev, [userId]: nextRoles };
    });
  };

  // Guardar roles de un usuario
  const saveUserRoles = async (userId) => {
    setSavingUser(prev => ({ ...prev, [userId]: true }));
    setError(null);
    setSuccessMsg(null);
    try {
      const roles = userRolesDraft[userId] || [];
      const res = await fetch(`/api/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles })
      });

      if (!res.ok) throw new Error(await res.text() || "Error al actualizar roles");
      const updatedUser = await res.json();

      // Actualizar usuario en el listado local
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      
      setSuccessMsg(`Roles actualizados con éxito para ${updatedUser.name || updatedUser.email}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      setError(e.message || "Error al guardar los roles del usuario.");
    } finally {
      setSavingUser(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Manejar cambio de la matriz de permisos
  const handlePermissionToggle = (role, permissionType) => {
    setPermissionsDraft(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permissionType]: !prev[role][permissionType]
      }
    }));
  };

  // Guardar todos los permisos de la matriz
  const saveAllPermissions = async () => {
    setSavingPermissions(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const roles = ["admin", "carga", "visualizador"];
      
      for (const role of roles) {
        const rolePerms = permissionsDraft[role] || {};
        const permissionsList = Object.keys(rolePerms).filter(k => rolePerms[k]);
        
        const res = await fetch("/api/permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            modulo: "projects",
            permissions: permissionsList
          })
        });
        
        if (!res.ok) throw new Error(await res.text() || "Error al guardar permisos");
      }
      
      setSuccessMsg("Matriz de permisos actualizada con éxito");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      setError(e.message || "Error al guardar los permisos de la matriz.");
    } finally {
      setSavingPermissions(false);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-24" style={{ color: C.faint }}>
        <Loader2 size={28} className="mp-spin" />
        <div className="text-sm mt-3 font-semibold">Cargando usuarios y permisos…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {error && (
        <div className="rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: C.riskBg, border: "1px solid #FCA5A5", color: C.risk }}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold">Error detectado</div>
            <div className="text-xs mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", color: C.done }}>
          <Check size={18} className="shrink-0 mt-0.5" />
          <div className="text-sm font-bold">{successMsg}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tabla de Usuarios */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden shadow-sm" style={{ background: "#FFFFFF", border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: C.border, background: C.panel }}>
            <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: "#FFFFFF", color: C.ink, border: `1px solid ${C.border}` }}>
              <Users size={16} />
            </span>
            <div>
              <div className="text-sm font-bold tracking-tight" style={{ color: C.ink }}>Usuarios Registrados</div>
              <div className="uppercase" style={{ color: C.faint, fontSize: 10, letterSpacing: ".12em" }}>Asignación de roles y perfiles corporativos</div>
            </div>
            <button onClick={fetchData} title="Refrescar datos" className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 transition" style={{ color: C.muted }}>
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="overflow-x-auto mp-scroll">
            <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b" style={{ borderColor: C.border }}>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted, background: C.panel }}>Usuario</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted, background: C.panel }}>Roles Asignados</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: C.muted, background: C.panel }}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: C.border }}>
                {users.map(u => {
                  const dbRoles = u.roles.map(r => r.role);
                  const currentDraft = userRolesDraft[u.id] || [];
                  // Comparar si hay cambios pendientes
                  const hasChanges = dbRoles.length !== currentDraft.length || 
                    dbRoles.some(r => !currentDraft.includes(r)) || 
                    currentDraft.some(r => !dbRoles.includes(r));
                  
                  return (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {u.image ? (
                            <img src={u.image} alt={u.name || ""} className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: C.border }} />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs uppercase" style={{ color: C.muted }}>
                              {u.name ? u.name.slice(0, 2) : u.email.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-semibold" style={{ color: C.ink }}>{u.name || "Sin Nombre"}</div>
                            <div className="text-xs" style={{ color: C.muted }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          {Object.keys(ROLES_META).map(rKey => {
                            const meta = ROLES_META[rKey];
                            const isChecked = currentDraft.includes(rKey);
                            return (
                              <label key={rKey} className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleRoleToggle(u.id, rKey)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ color: meta.color, background: isChecked ? meta.bg : "#F3F4F6", opacity: isChecked ? 1 : 0.55 }}>
                                  <meta.Icon size={10} />
                                  {meta.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          disabled={!hasChanges || savingUser[u.id]}
                          onClick={() => saveUserRoles(u.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition text-white disabled:opacity-30"
                          style={{ background: hasChanges ? C.done : C.faint }}
                        >
                          {savingUser[u.id] ? (
                            <Loader2 size={13} className="mp-spin" />
                          ) : (
                            <Save size={13} />
                          )}
                          <span>Guardar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Matriz de Permisos por Rol */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "#FFFFFF", border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: C.border, background: C.panel }}>
            <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: "#FFFFFF", color: C.ink, border: `1px solid ${C.border}` }}>
              <Shield size={16} />
            </span>
            <div>
              <div className="text-sm font-bold tracking-tight" style={{ color: C.ink }}>Permisos por Rol</div>
              <div className="uppercase" style={{ color: C.faint, fontSize: 10, letterSpacing: ".12em" }}>Matriz de acceso para el módulo de proyectos</div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{ background: C.panel, color: C.muted, border: `1px solid ${C.border}` }}>
              <Info size={14} className="shrink-0 mt-0.5" style={{ color: "#2563EB" }} />
              <div>
                Los permisos se asocian a cada rol. Los usuarios heredan los permisos de todos sus roles asignados.
              </div>
            </div>

            <div className="space-y-4">
              {Object.keys(ROLES_META).map(rKey => {
                const meta = ROLES_META[rKey];
                const draft = permissionsDraft[rKey] || { read: false, write: false, delete: false };

                return (
                  <div key={rKey} className="border rounded-xl p-3" style={{ borderColor: C.border }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="grid place-items-center w-6 h-6 rounded-full" style={{ color: meta.color, background: meta.bg }}>
                        <meta.Icon size={12} />
                      </span>
                      <span className="text-sm font-bold" style={{ color: C.ink }}>{meta.label}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/70 transition">
                        <input
                          type="checkbox"
                          checked={draft.read}
                          onChange={() => handlePermissionToggle(rKey, "read")}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium" style={{ color: C.ink }}>Lectura</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/70 transition">
                        <input
                          type="checkbox"
                          checked={draft.write}
                          onChange={() => handlePermissionToggle(rKey, "write")}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium" style={{ color: C.ink }}>Escritura</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/70 transition">
                        <input
                          type="checkbox"
                          checked={draft.delete}
                          onChange={() => handlePermissionToggle(rKey, "delete")}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium" style={{ color: C.ink }}>Eliminar</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              disabled={savingPermissions}
              onClick={saveAllPermissions}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: C.ink }}
            >
              {savingPermissions ? (
                <Loader2 size={16} className="mp-spin" />
              ) : (
                <Save size={16} />
              )}
              <span>Guardar Matriz de Permisos</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
