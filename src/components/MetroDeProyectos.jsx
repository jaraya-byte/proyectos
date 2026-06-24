"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { signOut } from "next-auth/react";
import {
  TrendingUp, Zap, Cog, Users, Shield, Upload, Eye, Plus, X, Check,
  Search, Trash2, AlertTriangle, Train, ChevronRight, ChevronsRight,
  Circle, Clock, UserCog, Archive, LogOut, Loader2, ClipboardList, LayoutGrid,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 *  METRO DE PROYECTOS — Centro de Control de Sistemas (COFERSA)
 *  Versión web · datos compartidos vía API · rol por sesión.
 *  Línea de tiempo: cada proyecto es una BARRA de inicio→fin, apilada
 *  en carriles para no traslaparse. Ventana visible de 6 meses.
 *  Las fechas de inicio/fin solo las ajusta el Administrador.
 * ------------------------------------------------------------------ */

const C = {
  page: "#FFFFFF", panel: "#F6F8FB", border: "#E2E7EF", borderStrong: "#D3DAE6",
  ink: "#1A1F2B", muted: "#5A6577", faint: "#8C95A6", track: "#E2E7EF",
  risk: "#DC2626", riskBg: "#FEF2F2", done: "#059669",
};

const PILLARS = {
  ingresos:   { label: "Ingresos",   line: "Línea Verde",   color: "#059669", soft: "#ECFDF5", Icon: TrendingUp },
  eficiencia: { label: "Eficiencia", line: "Línea Ámbar",   color: "#D97706", soft: "#FFFBEB", Icon: Zap },
  procesos:   { label: "Procesos",   line: "Línea Azul",    color: "#2563EB", soft: "#EFF4FF", Icon: Cog },
  talento:    { label: "Talento",    line: "Línea Violeta", color: "#7C3AED", soft: "#F5F1FE", Icon: Users },
};
const PILLAR_ORDER = ["ingresos", "eficiencia", "procesos", "talento"];

const SCALE = ["Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre"];
const MONTH_NAMES = [...SCALE, "Noviembre", "Diciembre"];
const COLS = SCALE.length;
const TODAY_MONTH = 2;
const clampMonth = (m) => Math.max(1, Math.min(m, COLS));
const isBeyond = (m) => m > COLS;
const monthName = (m) => MONTH_NAMES[m - 1] || `Mes ${m}`;

const STAGES = ["Levantamiento", "Diseño", "Desarrollo", "Pruebas", "Despliegue", "Cierre"];
const TOTAL_STAGES = STAGES.length;

const DEFAULT_PLAN = 2;
const MAX_PLAN = 6;

/* ----------------------------- helpers ----------------------------- */
const pct = (done) => Math.round((done / TOTAL_STAGES) * 100);
const isComplete = (p) => p.done >= TOTAL_STAGES;
const statusOf = (done) => (done >= TOTAL_STAGES ? "Completado" : done === 0 ? "Por iniciar" : "En curso");

const planOf = (p) => p.plan ?? DEFAULT_PLAN;
const plannedEnd = (p) => p.month + planOf(p) - 1;
const monthsLate = (p) => (isComplete(p) ? 0 : Math.max(0, TODAY_MONTH - plannedEnd(p)));
const isLate = (p) => monthsLate(p) > 0;
const extraTimePct = (p) => { const pl = planOf(p); return pl > 0 ? Math.round((monthsLate(p) / pl) * 100) : 0; };

const startVis = (p) => clampMonth(p.month);
const endRaw = (p) => (isComplete(p) ? plannedEnd(p) : isLate(p) ? Math.max(plannedEnd(p), TODAY_MONTH) : plannedEnd(p));
const endVis = (p) => clampMonth(endRaw(p));

function packLanes(items) {
  const sorted = [...items].sort(
    (a, b) => startVis(a) - startVis(b) || endVis(a) - endVis(b) || a.name.localeCompare(b.name)
  );
  const lanes = [];
  for (const p of sorted) {
    const s = startVis(p), e = endVis(p);
    const lane = lanes.find((L) => L.lastEnd < s);
    if (lane) { lane.items.push(p); lane.lastEnd = e; }
    else lanes.push({ items: [p], lastEnd: e });
  }
  return lanes;
}

const MESES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function weekStartLabel(ts = Date.now()) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getDate()} ${MESES_ABBR[d.getMonth()]}`;
}
function fmtDate(ts) {
  const d = new Date(ts);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const normalize = (p) => {
  const o = { plan: DEFAULT_PLAN, tecnico: "", responsable: "Sin asignar", updates: [], ...p };
  if (!Array.isArray(o.updates)) o.updates = [];
  return o;
};

const ROLES = {
  admin:        { label: "Administrador", Icon: Shield, desc: "Crea, edita fechas y elimina" },
  carga:        { label: "Carga de datos", Icon: Upload, desc: "Actualiza avance y responsables" },
  visualizador: { label: "Visualizador",   Icon: Eye,    desc: "Solo lectura" },
};

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.text()) || `Error ${r.status}`);
  return r.status === 204 ? null : r.json();
}

/* --------------------------- mini ring ----------------------------- */
function Ring({ value, color, size = 34, stroke = 4, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset .5s ease" }} />
      </svg>
      <span className="absolute font-bold tracking-tight" style={{ color, fontSize: 10 }}>{label ?? `${value}`}</span>
    </div>
  );
}

/* ============================ APP ================================== */
export default function MetroDeProyectos({ role = "visualizador", user = {} }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [pillarFilter, setPillarFilter] = useState("todos");
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState("timeline");

  const canEditStages = role === "admin" || role === "carga";
  const canManage = role === "admin";
  const roleMeta = ROLES[role] || ROLES.visualizador;

  const reload = useCallback(async () => {
    try {
      const data = await api("/api/projects");
      setProjects(data.map(normalize));
      setError(null);
    } catch (e) {
      setError("No se pudieron cargar los proyectos.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const setDone = useCallback(async (id, doneRaw) => {
    const done = Math.max(0, Math.min(TOTAL_STAGES, doneRaw));
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, done } : p)));
    try { await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ done }) }); } catch { reload(); }
  }, [reload]);

  const updateProject = useCallback(async (id, patch) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    try { await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); } catch { reload(); }
  }, [reload]);

  const addProject = useCallback(async (data) => {
    try {
      const created = await api("/api/projects", { method: "POST", body: JSON.stringify(data) });
      setProjects((ps) => [...ps, normalize(created)]);
    } catch { reload(); }
  }, [reload]);

  const removeProject = useCallback(async (id) => {
    setProjects((ps) => ps.filter((p) => p.id !== id));
    setSelected(null);
    try { await api(`/api/projects/${id}`, { method: "DELETE" }); } catch { reload(); }
  }, [reload]);

  const addUpdate = useCallback(async (id, text) => {
    try {
      const updated = await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ addUpdate: { text } }) });
      setProjects((ps) => ps.map((p) => (p.id === id ? normalize(updated) : p)));
    } catch { reload(); }
  }, [reload]);

  const removeUpdate = useCallback(async (id, updateId) => {
    try {
      const updated = await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ removeUpdate: updateId }) });
      setProjects((ps) => ps.map((p) => (p.id === id ? normalize(updated) : p)));
    } catch { reload(); }
  }, [reload]);

  const filtered = useMemo(() => projects.filter((p) => {
    if (pillarFilter !== "todos" && p.pillar !== pillarFilter) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [projects, query, pillarFilter]);

  const historico = useMemo(
    () => filtered.filter(isComplete).sort((a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar) || a.name.localeCompare(b.name)),
    [filtered]
  );

  const kpi = useMemo(() => {
    const active = projects.filter((p) => !isComplete(p));
    const late = active.filter(isLate);
    const extraAvg = late.length ? Math.round(late.reduce((a, p) => a + extraTimePct(p), 0) / late.length) : 0;
    const n = projects.length || 1;
    return {
      activos: active.length,
      avance: Math.round(projects.reduce((a, p) => a + pct(p.done), 0) / n),
      completados: projects.filter(isComplete).length,
      enCurso: active.filter((p) => p.done > 0).length,
      atrasados: late.length,
      extraAvg,
    };
  }, [projects]);

  const selProject = projects.find((p) => p.id === selected) || null;
  const todayLeft = ((TODAY_MONTH - 1) / COLS) * 100;

  return (
    <div className="min-h-screen w-full" style={{ background: C.page, color: C.ink, colorScheme: "light", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <style>{`
        input, select, textarea, button, option { color: inherit; }
        select option { background:#FFFFFF; color:${C.ink}; }
        @keyframes mp-pulse { 0%{box-shadow:0 0 0 0 var(--c)} 70%{box-shadow:0 0 0 9px transparent} 100%{box-shadow:0 0 0 0 transparent} }
        .mp-pulse { animation: mp-pulse 1.9s cubic-bezier(.4,0,.6,1) infinite; }
        @keyframes mp-spin { to { transform: rotate(360deg) } }
        .mp-spin { animation: mp-spin 1s linear infinite; }
        @media (prefers-reduced-motion: reduce){ .mp-pulse{ animation:none } }
        .mp-scroll::-webkit-scrollbar{height:8px;width:8px}
        .mp-scroll::-webkit-scrollbar-thumb{background:#cdd5e1;border-radius:8px}
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b" style={{ borderColor: C.border, background: "rgba(255,255,255,.88)", backdropFilter: "blur(8px)" }}>
        <div className="mx-auto px-5 py-3 flex items-center gap-4 flex-wrap" style={{ maxWidth: 1240 }}>
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-xl" style={{ background: "linear-gradient(135deg,#059669,#2563EB)" }}>
              <Train size={20} className="text-white" />
            </div>
            <div>
              <div className="uppercase leading-none" style={{ color: C.faint, fontSize: 11, letterSpacing: ".22em" }}>Centro de Control · COFERSA</div>
              <div className="text-lg font-bold tracking-tight leading-tight" style={{ color: C.ink }}>Metro de Proyectos</div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl" style={{ background: "#EEF1F6" }}>
              <span className="grid place-items-center w-6 h-6 rounded-full" style={{ background: "#FFFFFF", color: C.ink }}>
                <roleMeta.Icon size={13} />
              </span>
              <div className="leading-tight pr-1">
                <div className="text-xs font-semibold" style={{ color: C.ink }}>{user.name || user.email || "Usuario"}</div>
                <div className="uppercase" style={{ color: C.faint, fontSize: 10, letterSpacing: ".12em" }}>{roleMeta.label}</div>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })} title="Cerrar sesión"
              className="grid place-items-center w-9 h-9 rounded-xl" style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, color: C.muted }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-5 py-6" style={{ maxWidth: 1240 }}>
        {loading ? (
          <div className="grid place-items-center py-24" style={{ color: C.faint }}>
            <Loader2 size={28} className="mp-spin" />
            <div className="text-sm mt-3">Cargando proyectos…</div>
          </div>
        ) : error ? (
          <div className="rounded-2xl px-5 py-8 text-center" style={{ background: C.riskBg, border: "1px solid #FCA5A5", color: C.risk }}>
            <AlertTriangle size={22} className="mx-auto mb-2" />
            <div className="text-sm font-semibold">{error}</div>
            <button onClick={reload} className="mt-3 px-3.5 py-2 rounded-lg text-xs font-bold text-white" style={{ background: C.ink }}>Reintentar</button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <Kpi label="Avance global" value={`${kpi.avance}%`} accent="#2563EB" big />
              <Kpi label="Activos" value={kpi.activos} />
              <Kpi label="En curso" value={kpi.enCurso} accent="#D97706" />
              <Kpi label="Atrasados" value={kpi.atrasados} accent={C.risk} warn={kpi.atrasados > 0}
                sub={kpi.atrasados > 0 ? `+${kpi.extraAvg}% tiempo prom.` : "En programa"} />
              <Kpi label="Culminados" value={kpi.completados} accent={C.done} />
            </section>

            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-xl p-1 mb-5" style={{ background: "#EEF1F6", width: "fit-content" }}>
              <button onClick={() => setView("timeline")} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={view === "timeline" ? { background: "#FFFFFF", color: C.ink, boxShadow: "0 1px 2px rgba(16,24,40,.1)" } : { color: C.muted }}>Línea de tiempo</button>
              {canManage && (
                <button onClick={() => setView("matrix")} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                  style={view === "matrix" ? { background: "#FFFFFF", color: C.ink, boxShadow: "0 1px 2px rgba(16,24,40,.1)" } : { color: C.muted }}><LayoutGrid size={13} /> Matriz de responsables</button>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, minWidth: 200 }}>
                <Search size={15} style={{ color: C.faint }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar proyecto…"
                  className="bg-transparent outline-none text-sm w-full" style={{ color: C.ink }} />
              </div>
              <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "#EEF1F6" }}>
                <FilterChip active={pillarFilter === "todos"} onClick={() => setPillarFilter("todos")} color={C.faint}>Todas</FilterChip>
                {PILLAR_ORDER.map((k) => (
                  <FilterChip key={k} active={pillarFilter === k} onClick={() => setPillarFilter(k)} color={PILLARS[k].color}>{PILLARS[k].label}</FilterChip>
                ))}
              </div>
              {canManage && (
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: C.ink }}>
                  <Plus size={16} /> Nuevo proyecto
                </button>
              )}
            </div>

            {view === "matrix" && canManage ? (
              <ResponsablesMatrix projects={filtered.filter((p) => !isComplete(p))} onSelect={setSelected} />
            ) : (
              <>
            {/* Timeline */}
            <section className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(16,24,40,.04)" }}>
              <div className="flex border-b" style={{ borderColor: C.border, background: C.panel }}>
                <div className="shrink-0 px-4 py-3 uppercase" style={{ width: 200, color: C.faint, fontSize: 10, letterSpacing: ".18em" }}>Línea / Pilar</div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                  {SCALE.map((m, i) => (
                    <div key={m} className="px-2 py-3 text-center uppercase"
                      style={{ borderLeft: `1px dashed ${C.border}`, color: i + 1 === TODAY_MONTH ? C.ink : C.muted, fontWeight: i + 1 === TODAY_MONTH ? 700 : 500, fontSize: 11, letterSpacing: ".12em" }}>
                      {m}{i + 1 === TODAY_MONTH && <span className="ml-1 inline-block rounded-full align-middle" style={{ width: 6, height: 6, background: C.risk }} />}
                    </div>
                  ))}
                </div>
              </div>

              {PILLAR_ORDER.map((pk) => {
                const meta = PILLARS[pk];
                const active = filtered.filter((p) => p.pillar === pk && !isComplete(p));
                const lanes = packLanes(active);
                const allInLine = projects.filter((p) => p.pillar === pk);
                const lineAvance = allInLine.length ? Math.round(allInLine.reduce((a, p) => a + pct(p.done), 0) / allInLine.length) : 0;
                return (
                  <div key={pk} className="flex items-stretch border-b last:border-b-0" style={{ borderColor: C.border }}>
                    <div className="shrink-0 px-4 py-4 flex items-center gap-3" style={{ width: 200, background: C.panel }}>
                      <span className="grid place-items-center w-9 h-9 rounded-lg shrink-0" style={{ background: meta.soft, color: meta.color }}>
                        <meta.Icon size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate" style={{ color: C.ink }}>{meta.label}</div>
                        <div className="uppercase truncate" style={{ color: C.faint, fontSize: 10, letterSpacing: ".12em" }}>{meta.line}</div>
                      </div>
                      <div className="ml-auto"><Ring value={lineAvance} color={meta.color} label={`${lineAvance}%`} size={38} /></div>
                    </div>

                    <div className="flex-1 relative" style={{ minHeight: 78 }}>
                      <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                        {SCALE.map((_, i) => (<div key={i} style={{ borderLeft: i ? `1px dashed ${C.border}` : "none" }} />))}
                      </div>
                      <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${todayLeft}%`, borderLeft: `2px dashed ${C.risk}`, opacity: .35 }} />

                      {lanes.length === 0 ? (
                        <div className="relative px-2 py-5" style={{ color: C.faint, fontSize: 11 }}>Sin proyectos activos en la ventana.</div>
                      ) : (
                        <div className="relative flex flex-col gap-1.5 py-3">
                          {lanes.map((lane, li) => (
                            <div key={li} className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                              {lane.items.map((p) => {
                                const s = startVis(p), e = endVis(p);
                                return (
                                  <GanttBar key={p.id} project={p} meta={meta}
                                    gridColumn={`${s} / span ${e - s + 1}`} onClick={() => setSelected(p.id)} />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            <p className="mt-4 leading-relaxed" style={{ color: C.muted, fontSize: 11 }}>
              Cada barra es un proyecto y se extiende desde su <strong>mes de inicio</strong> hasta su <strong>mes de fin</strong>; las barras se apilan en carriles para no traslaparse.
              La línea roja punteada marca el mes actual. Si un proyecto pasa su fin sin culminar, su barra se vuelve <span style={{ color: C.risk }}>roja</span> y se estira hasta hoy, sumando su <strong>% de tiempo extra</strong>.
              Al llegar a la etapa de Cierre, el proyecto sale del lienzo y pasa al <strong>histórico</strong>.
            </p>

            {/* Histórico */}
            <section className="mt-7 rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(16,24,40,.04)" }}>
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b" style={{ borderColor: C.border, background: C.panel }}>
                <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: "#FFFFFF", color: C.done, border: `1px solid ${C.done}33` }}>
                  <Archive size={16} />
                </span>
                <div>
                  <div className="text-sm font-bold tracking-tight" style={{ color: C.ink }}>Histórico de proyectos culminados</div>
                  <div className="uppercase" style={{ color: C.faint, fontSize: 10, letterSpacing: ".14em" }}>Consulta permanente · solo lectura</div>
                </div>
                <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: C.done + "14", color: C.done }}>
                  {historico.length} {historico.length === 1 ? "proyecto" : "proyectos"}
                </span>
              </div>
              {historico.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm" style={{ color: C.faint }}>
                  Aún no hay proyectos culminados. Cuando uno llegue a la etapa <strong style={{ color: C.muted }}>Cierre</strong>, aparecerá aquí.
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: C.border }}>
                  {historico.map((p) => {
                    const meta = PILLARS[p.pillar];
                    return (
                      <li key={p.id}>
                        <button onClick={() => setSelected(p.id)} className="w-full flex items-center gap-3 px-5 py-3 text-left transition"
                          style={{ background: "transparent" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = meta.soft)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                          <span className="grid place-items-center w-7 h-7 rounded-full shrink-0" style={{ background: C.done }}>
                            <Check size={13} className="text-white" strokeWidth={3.5} />
                          </span>
                          <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: meta.color }} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{p.name}</div>
                            <div className="truncate" style={{ color: C.muted, fontSize: 11 }}>
                              {meta.label} · {p.responsable}{p.tecnico ? <> · <UserCog size={10} className="inline" style={{ marginTop: -2 }} /> {p.tecnico}</> : null}
                            </div>
                          </div>
                          <div className="hidden sm:block text-right shrink-0">
                            <div className="uppercase" style={{ color: C.faint, fontSize: 10, letterSpacing: ".12em" }}>Periodo</div>
                            <div className="text-xs font-semibold" style={{ color: C.muted }}>{monthName(p.month)}–{monthName(plannedEnd(p))}</div>
                          </div>
                          <span className="font-bold px-2 py-1 rounded-md shrink-0" style={{ background: C.done + "14", color: C.done, fontSize: 11 }}>Culminado</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
              </>
            )}
          </>
        )}
      </main>

      {selProject && (
        <ProjectDetail project={selProject} meta={PILLARS[selProject.pillar]} canEdit={canEditStages} canManage={canManage}
          onClose={() => setSelected(null)} onSetDone={(d) => setDone(selProject.id, d)}
          onUpdate={(patch) => updateProject(selProject.id, patch)} onDelete={() => removeProject(selProject.id)}
          onAddUpdate={(text) => addUpdate(selProject.id, text)} onRemoveUpdate={(uid) => removeUpdate(selProject.id, uid)} />
      )}
      {showAdd && canManage && (
        <AddProject onClose={() => setShowAdd(false)} onAdd={(d) => { addProject(d); setShowAdd(false); }} />
      )}
    </div>
  );
}

/* --------------------------- components ---------------------------- */
function ResponsablesMatrix({ projects, onSelect }) {
  const map = new Map();
  for (const p of projects) {
    const key = (p.tecnico || "").trim() || "Sin asignar";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  const rows = [...map.entries()].map(([person, list]) => {
    const total = list.length;
    const atrasados = list.filter(isLate).length;
    const avance = Math.round(list.reduce((a, p) => a + pct(p.done), 0) / (total || 1));
    const byPillar = {};
    for (const pk of PILLAR_ORDER) byPillar[pk] = list.filter((p) => p.pillar === pk);
    return { person, total, atrasados, avance, byPillar };
  }).sort((a, b) => b.total - a.total || a.person.localeCompare(b.person));

  const chip = (p) => {
    const late = isLate(p);
    return (
      <button key={p.id} onClick={() => onSelect(p.id)} title={`${p.name} · ${pct(p.done)}%`}
        className="w-full flex items-center gap-1 rounded-md px-1.5 py-1 text-left"
        style={{ background: late ? C.riskBg : "#FFFFFF", border: `1px solid ${late ? "#FCA5A5" : C.border}`, borderLeft: `3px solid ${late ? C.risk : PILLARS[p.pillar].color}` }}>
        <span className="font-semibold truncate" style={{ color: C.ink, fontSize: 11 }}>{p.name}</span>
        {late && <Clock size={10} className="shrink-0" style={{ color: C.risk }} />}
        <span className="ml-auto tabular-nums shrink-0" style={{ color: late ? C.risk : C.faint, fontSize: 9 }}>{late ? `+${extraTimePct(p)}%` : `${pct(p.done)}%`}</span>
      </button>
    );
  };

  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(16,24,40,.04)" }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b" style={{ borderColor: C.border, background: C.panel }}>
        <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: "#FFFFFF", color: C.ink, border: `1px solid ${C.border}` }}><LayoutGrid size={16} /></span>
        <div>
          <div className="text-sm font-bold tracking-tight" style={{ color: C.ink }}>Matriz de responsables</div>
          <div className="uppercase" style={{ color: C.faint, fontSize: 10, letterSpacing: ".14em" }}>Proyectos activos por responsable técnico y pilar</div>
        </div>
        <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#EEF1F6", color: C.muted }}>{rows.length} {rows.length === 1 ? "persona" : "personas"}</span>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm" style={{ color: C.faint }}>No hay proyectos activos para mostrar.</div>
      ) : (
        <div className="overflow-x-auto mp-scroll">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th className="text-left uppercase px-4 py-2.5" style={{ color: C.faint, fontSize: 10, letterSpacing: ".12em", background: C.panel, borderBottom: `1px solid ${C.border}` }}>Responsable</th>
                {PILLAR_ORDER.map((pk) => (
                  <th key={pk} className="text-left uppercase px-3 py-2.5" style={{ color: PILLARS[pk].color, fontSize: 10, letterSpacing: ".1em", background: C.panel, borderBottom: `1px solid ${C.border}`, minWidth: 150 }}>
                    <span className="inline-flex items-center gap-1.5"><span className="rounded-full" style={{ width: 7, height: 7, background: PILLARS[pk].color }} />{PILLARS[pk].label}</span>
                  </th>
                ))}
                <th className="text-center uppercase px-3 py-2.5" style={{ color: C.faint, fontSize: 10, letterSpacing: ".1em", background: C.panel, borderBottom: `1px solid ${C.border}` }}>Carga</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.person}>
                  <td className="px-4 py-3 align-top" style={{ borderBottom: `1px solid ${C.border}`, background: "#FFFFFF", minWidth: 170 }}>
                    <div className="text-sm font-semibold" style={{ color: r.person === "Sin asignar" ? C.faint : C.ink }}>{r.person}</div>
                    <div className="mt-0.5" style={{ color: C.faint, fontSize: 10 }}>Avance {r.avance}%{r.atrasados > 0 && <span style={{ color: C.risk }}> · {r.atrasados} atrasado{r.atrasados > 1 ? "s" : ""}</span>}</div>
                  </td>
                  {PILLAR_ORDER.map((pk) => (
                    <td key={pk} className="px-3 py-3 align-top" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px dashed ${C.border}` }}>
                      <div className="flex flex-col gap-1.5">
                        {r.byPillar[pk].length === 0 ? <span style={{ color: C.faint, fontSize: 11 }}>—</span> : r.byPillar[pk].map(chip)}
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center align-top" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px dashed ${C.border}` }}>
                    <div className="text-lg font-bold" style={{ color: C.ink }}>{r.total}</div>
                    {r.atrasados > 0 && <div className="font-semibold" style={{ color: C.risk, fontSize: 10 }}>{r.atrasados} atras.</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, accent = C.muted, big, warn, sub }) {
  return (
    <div className="rounded-2xl px-4 py-3.5" style={{ background: warn ? C.riskBg : "#FFFFFF", border: `1px solid ${warn ? accent + "55" : C.border}` }}>
      <div className="uppercase mb-1.5 flex items-center gap-1" style={{ color: C.faint, fontSize: 10, letterSpacing: ".16em" }}>
        {warn && <AlertTriangle size={11} style={{ color: accent }} />}{label}
      </div>
      <div className="font-bold tracking-tight" style={{ color: accent === C.muted ? C.ink : accent, fontSize: big ? 30 : 24 }}>{value}</div>
      {sub && <div className="mt-0.5 font-semibold" style={{ color: warn ? accent : C.faint, fontSize: 10 }}>{sub}</div>}
    </div>
  );
}

function FilterChip({ active, onClick, color, children }) {
  return (
    <button onClick={onClick} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
      style={active ? { background: "#FFFFFF", color: C.ink, boxShadow: "0 1px 2px rgba(16,24,40,.1)" } : { color: C.muted }}>
      <span className="rounded-full" style={{ width: 8, height: 8, background: color }} />{children}
    </button>
  );
}

function GanttBar({ project, meta, gridColumn, onClick }) {
  const p = pct(project.done);
  const late = isLate(project);
  const extra = extraTimePct(project);
  const lateM = monthsLate(project);
  const beyond = isBeyond(project.month) || endRaw(project) > COLS;
  const pulse = project.done > 0 && !isComplete(project);
  return (
    <button onClick={onClick}
      title={`${project.name} · ${monthName(project.month)}–${monthName(plannedEnd(project))} · ${project.responsable}${project.tecnico ? ` · Téc: ${project.tecnico}` : ""}${late ? ` · Atrasado ${lateM} mes(es), +${extra}% tiempo` : ""}`}
      className={`relative overflow-hidden text-left transition${pulse ? " mp-pulse" : ""}`}
      style={{
        gridColumn, height: 34, marginRight: 3, borderRadius: 8,
        background: late ? C.riskBg : "#FFFFFF",
        border: `1px solid ${late ? "#FCA5A5" : C.border}`,
        borderLeft: `3px solid ${late ? C.risk : meta.color}`,
        "--c": meta.color + "55",
      }}>
      <div className="absolute inset-y-0 left-0" style={{ width: `${p}%`, background: late ? C.risk : meta.color, opacity: .14 }} />
      <div className="relative h-full flex items-center gap-1 px-2">
        {isComplete(project) && <Check size={11} style={{ color: meta.color }} strokeWidth={3} />}
        <span className="font-semibold truncate" style={{ color: C.ink, fontSize: 11 }}>{project.name}</span>
        {late && <Clock size={11} className="shrink-0" style={{ color: C.risk }} />}
        {beyond && <ChevronsRight size={12} className="shrink-0" style={{ color: meta.color }} />}
        <span className="ml-auto font-semibold tabular-nums shrink-0" style={{ color: late ? C.risk : C.muted, fontSize: 9 }}>
          {late ? `+${extra}%` : `${p}%`}
        </span>
      </div>
    </button>
  );
}

function ProjectDetail({ project, meta, canEdit, canManage, onClose, onSetDone, onUpdate, onDelete, onAddUpdate, onRemoveUpdate }) {
  const [draft, setDraft] = useState("");
  const updates = [...(project.updates || [])].sort((a, b) => b.ts - a.ts);
  const done = project.done;
  const p = pct(done);
  const complete = isComplete(project);
  const late = isLate(project);
  const extra = extraTimePct(project);
  const lateM = monthsLate(project);
  const end = plannedEnd(project);
  const beyond = isBeyond(project.month) || end > COLS;

  const setStart = (ns) => onUpdate({ month: ns, plan: Math.max(1, Math.min(MAX_PLAN, end - ns + 1)) });
  const setEnd = (ne) => onUpdate({ plan: Math.max(1, Math.min(MAX_PLAN, ne - project.month + 1)) });
  const selStyle = { background: "#FFFFFF", border: `1px solid ${C.borderStrong}`, color: C.ink, colorScheme: "light", borderRadius: 6, padding: "2px 6px", fontSize: 12 };

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center p-0 md:p-6" style={{ background: "rgba(17,22,30,.45)" }} onClick={onClose}>
      <div className="w-full rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col" style={{ maxWidth: 768, maxHeight: "92vh", background: "#FFFFFF", border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(16,24,40,.25)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 flex items-start gap-4" style={{ background: `linear-gradient(180deg, ${meta.soft}, transparent)` }}>
          <span className="grid place-items-center w-11 h-11 rounded-xl shrink-0" style={{ background: "#FFFFFF", color: meta.color, border: `1px solid ${meta.color}33` }}>
            <meta.Icon size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 uppercase" style={{ color: meta.color, fontSize: 10, letterSpacing: ".16em" }}>
              {meta.line}<ChevronRight size={11} />{monthName(project.month)}–{monthName(end)}
              {beyond && <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded" style={{ background: meta.soft, color: meta.color }}><ChevronsRight size={10} /> extremo</span>}
            </div>
            <h2 className="text-xl font-bold tracking-tight leading-tight mt-0.5" style={{ color: C.ink }}>{project.name}</h2>
            <div className="text-xs mt-1" style={{ color: C.muted }}>
              Equipo: <span style={{ color: C.ink }}>{project.responsable}</span> · <span style={{ color: complete ? C.done : late ? C.risk : "#D97706" }}>{late ? "Atrasado" : statusOf(done)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Ring value={p} color={late ? C.risk : meta.color} label={`${p}%`} size={46} stroke={5} />
            <button onClick={onClose} className="grid place-items-center w-9 h-9 rounded-lg" style={{ background: C.panel, color: C.muted }}><X size={17} /></button>
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto mp-scroll">
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl p-3.5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="uppercase mb-1.5 flex items-center gap-1.5" style={{ color: C.faint, fontSize: 10, letterSpacing: ".16em" }}>
                <UserCog size={12} /> Responsable técnico
              </div>
              {canEdit ? (
                <input value={project.tecnico || ""} onChange={(e) => onUpdate({ tecnico: e.target.value })} placeholder="Asignar persona…"
                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none" style={{ background: "#FFFFFF", border: `1px solid ${C.borderStrong}`, color: C.ink }} />
              ) : (
                <div className="text-sm font-semibold" style={{ color: project.tecnico ? C.ink : C.faint }}>{project.tecnico || "Sin asignar"}</div>
              )}
            </div>

            <div className="rounded-xl p-3.5" style={{ background: late ? C.riskBg : C.panel, border: `1px solid ${late ? "#FCA5A5" : C.border}` }}>
              <div className="uppercase mb-2 flex items-center gap-1.5" style={{ color: C.faint, fontSize: 10, letterSpacing: ".16em" }}>
                <Clock size={12} /> Fechas {canManage ? "" : "(solo admin edita)"}
              </div>
              {canManage ? (
                <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: C.muted }}>
                  <span>Inicio</span>
                  <select value={project.month} onChange={(e) => setStart(+e.target.value)} style={selStyle}>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <span>Fin</span>
                  <select value={end} onChange={(e) => setEnd(+e.target.value)} style={selStyle}>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1} disabled={i + 1 < project.month}>{m}</option>)}
                  </select>
                </div>
              ) : (
                <div className="text-xs" style={{ color: C.muted }}>
                  Inicio <span style={{ color: C.ink, fontWeight: 600 }}>{monthName(project.month)}</span> · Fin <span style={{ color: C.ink, fontWeight: 600 }}>{monthName(end)}</span>
                </div>
              )}
              {late ? (
                <div className="mt-2 inline-flex items-center gap-1.5 font-bold px-2 py-1 rounded-md" style={{ background: "#FFFFFF", color: C.risk, border: "1px solid #FCA5A5", fontSize: 11 }}>
                  <AlertTriangle size={11} /> Atrasado {lateM} {lateM === 1 ? "mes" : "meses"} · +{extra}% de tiempo extra
                </div>
              ) : complete ? (
                <div className="mt-2 inline-flex items-center gap-1.5 font-bold px-2 py-1 rounded-md" style={{ background: "#FFFFFF", color: C.done, border: `1px solid ${C.done}55`, fontSize: 11 }}>
                  <Check size={11} strokeWidth={3} /> Culminado en plazo
                </div>
              ) : (
                <div className="mt-2 inline-flex items-center gap-1.5 font-semibold px-2 py-1 rounded-md" style={{ background: "#FFFFFF", color: C.done, border: `1px solid ${C.border}`, fontSize: 11 }}>
                  <Check size={11} strokeWidth={3} /> En programa
                </div>
              )}
            </div>
          </div>

          <div className="uppercase mb-5" style={{ color: C.faint, fontSize: 10, letterSpacing: ".18em" }}>Recorrido de etapas</div>
          <div className="overflow-x-auto mp-scroll pb-2">
            <div className="flex items-start" style={{ minWidth: 620 }}>
              {STAGES.map((s, i) => {
                const stDone = i < done;
                const isCurrent = i === done && done < TOTAL_STAGES;
                const reached = i <= done;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center relative">
                    {i < STAGES.length - 1 && (<div className="absolute" style={{ top: 14, left: "50%", width: "100%", height: 3, background: i < done ? meta.color : C.track }} />)}
                    <button disabled={!canEdit} onClick={() => onSetDone(i + 1)}
                      className={`relative grid place-items-center rounded-full z-10 transition${isCurrent ? " mp-pulse" : ""}`}
                      style={{ width: 30, height: 30, background: stDone ? meta.color : "#FFFFFF", border: `3px solid ${reached || isCurrent ? meta.color : C.borderStrong}`, cursor: canEdit ? "pointer" : "default", "--c": meta.color + "55" }}
                      title={canEdit ? `Marcar avance hasta: ${s}` : s}>
                      {stDone ? <Check size={14} className="text-white" strokeWidth={3.5} />
                        : isCurrent ? <span className="rounded-full" style={{ width: 8, height: 8, background: meta.color }} />
                        : <Circle size={9} style={{ color: C.borderStrong }} />}
                    </button>
                    <div className="mt-3 text-center px-1">
                      <div className="font-semibold leading-tight" style={{ color: reached || isCurrent ? C.ink : C.faint, fontSize: 11 }}>{s}</div>
                      <div className="uppercase mt-0.5 font-semibold" style={{ color: isCurrent ? meta.color : stDone ? C.done : C.faint, fontSize: 9 }}>
                        {stDone ? "Completa" : isCurrent ? "En curso" : "Pendiente"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Avance semanal */}
          <div className="mt-6 pt-5 border-t" style={{ borderColor: C.border }}>
            <div className="uppercase mb-3 flex items-center gap-1.5" style={{ color: C.faint, fontSize: 10, letterSpacing: ".18em" }}>
              <ClipboardList size={12} /> Avance semanal
            </div>
            {updates.length === 0 ? (
              <div className="text-xs mb-3" style={{ color: C.faint }}>Aún no hay avances registrados.</div>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {updates.map((u) => (
                  <div key={u.id} className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: C.ink }}>Semana del {u.week}</span>
                      <span style={{ color: C.faint, fontSize: 10 }}>· {u.author}</span>
                      <span className="ml-auto" style={{ color: C.faint, fontSize: 10 }}>{fmtDate(u.ts)}</span>
                      {canManage && (
                        <button onClick={() => onRemoveUpdate(u.id)} title="Eliminar avance" style={{ color: C.faint }}><X size={13} /></button>
                      )}
                    </div>
                    <div className="text-sm mt-1" style={{ color: C.muted, whiteSpace: "pre-wrap" }}>{u.text}</div>
                  </div>
                ))}
              </div>
            )}
            {canEdit ? (
              <div className="rounded-lg p-3" style={{ border: `1px dashed ${C.borderStrong}` }}>
                <div className="uppercase mb-1.5" style={{ color: C.faint, fontSize: 10, letterSpacing: ".14em" }}>Nuevo avance · Semana del {weekStartLabel()}</div>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Describe el avance de esta semana…"
                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none" style={{ background: "#FFFFFF", border: `1px solid ${C.borderStrong}`, color: C.ink, resize: "none" }} />
                <div className="flex items-center justify-between mt-2 gap-2">
                  <span style={{ color: C.faint, fontSize: 10 }}>A nombre de: {project.tecnico || "responsable técnico"}</span>
                  <button disabled={!draft.trim()} onClick={() => { onAddUpdate(draft.trim()); setDraft(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-30" style={{ background: meta.color }}>Agregar avance</button>
                </div>
              </div>
            ) : (
              <div className="text-xs" style={{ color: C.faint }}>Solo el responsable asignado o el equipo de carga puede registrar avances.</div>
            )}
          </div>

          <div className="flex items-center justify-between mt-6 pt-5 border-t flex-wrap gap-3" style={{ borderColor: C.border }}>
            {canEdit ? (
              <div className="flex items-center gap-2">
                <button onClick={() => onSetDone(done - 1)} disabled={done <= 0} className="px-3.5 py-2 rounded-lg text-xs font-semibold disabled:opacity-30" style={{ background: "#FFFFFF", border: `1px solid ${C.borderStrong}`, color: C.ink }}>← Retroceder</button>
                <button onClick={() => onSetDone(done + 1)} disabled={done >= TOTAL_STAGES} className="px-3.5 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-30" style={{ background: meta.color }}>Avanzar etapa →</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5" style={{ color: C.muted, fontSize: 11 }}><Eye size={13} /> Modo solo lectura</div>
            )}
            {canManage && (
              <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ color: C.risk, background: C.riskBg, border: "1px solid #FCA5A5" }}>
                <Trash2 size={14} /> Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddProject({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [pillar, setPillar] = useState("ingresos");
  const [start, setStart] = useState(TODAY_MONTH);
  const [end, setEnd] = useState(TODAY_MONTH + 1);
  const [responsable, setResponsable] = useState("");
  const [tecnico, setTecnico] = useState("");
  const ok = name.trim().length > 1;
  const plan = Math.max(1, Math.min(MAX_PLAN, end - start + 1));
  const selStyle = { background: "#FFFFFF", border: `1px solid ${C.borderStrong}`, color: C.ink, colorScheme: "light" };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4" style={{ background: "rgba(17,22,30,.45)" }} onClick={onClose}>
      <div className="w-full overflow-hidden flex flex-col rounded-2xl" style={{ maxWidth: 448, maxHeight: "92vh", background: "#FFFFFF", border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(16,24,40,.25)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: C.border }}>
          <h3 className="font-bold tracking-tight" style={{ color: C.ink }}>Nuevo proyecto</h3>
          <button onClick={onClose} style={{ color: C.muted }}><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto mp-scroll">
          <Field label="Nombre del proyecto">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Portal Clientes V2"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: "#FFFFFF", border: `1px solid ${C.borderStrong}`, color: C.ink }} />
          </Field>
          <Field label="Pilar / línea">
            <div className="grid grid-cols-2 gap-2">
              {PILLAR_ORDER.map((k) => (
                <button key={k} onClick={() => setPillar(k)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition"
                  style={pillar === k ? { background: PILLARS[k].soft, border: `1px solid ${PILLARS[k].color}`, color: C.ink } : { background: "#FFFFFF", border: `1px solid ${C.border}`, color: C.muted }}>
                  <span className="rounded-full" style={{ width: 10, height: 10, background: PILLARS[k].color }} />{PILLARS[k].label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mes de inicio">
              <select value={start} onChange={(e) => { const v = +e.target.value; setStart(v); if (end < v) setEnd(v); }}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={selStyle}>
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}{i + 1 > COLS ? "  (→ extremo)" : ""}</option>)}
              </select>
            </Field>
            <Field label="Mes de fin">
              <select value={end} onChange={(e) => setEnd(+e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={selStyle}>
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1} disabled={i + 1 < start}>{m}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Equipo responsable">
              <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Equipo…"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: "#FFFFFF", border: `1px solid ${C.borderStrong}`, color: C.ink }} />
            </Field>
            <Field label="Responsable técnico">
              <input value={tecnico} onChange={(e) => setTecnico(e.target.value)} placeholder="Persona…"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: "#FFFFFF", border: `1px solid ${C.borderStrong}`, color: C.ink }} />
            </Field>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: C.panel, color: C.muted, fontSize: 11 }}>
            <Clock size={13} /> Se extenderá por <strong style={{ color: C.ink }}>&nbsp;{plan} mes{plan > 1 ? "es" : ""}</strong>&nbsp;({monthName(start)}–{monthName(end)}).
            {end < TODAY_MONTH && <span style={{ color: C.risk }}>&nbsp;Quedaría atrasado de inicio.</span>}
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end gap-2 border-t" style={{ borderColor: C.border }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.panel, color: C.muted }}>Cancelar</button>
          <button disabled={!ok} onClick={() => onAdd({ name: name.trim(), pillar, month: start, plan, responsable, tecnico })}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-30" style={{ background: C.ink }}>Crear barra</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="uppercase mb-1.5 block" style={{ color: C.faint, fontSize: 10, letterSpacing: ".14em" }}>{label}</span>
      {children}
    </label>
  );
}
