import { Link } from 'react-router-dom';
import { Bell, BookOpen, CalendarCheck, Clock, FileBarChart, UserCheck, Users } from 'lucide-react';
import { notificaciones, reportes } from '../../services';
import { useCarga } from '../../lib/hooks';
import { haceCuanto } from '../../lib/fechas';
import { Alerta, Cargando, Tarjeta } from '../../components/ui';

/** Tonos de las barras (en el Figma cada fila tiene un tono distinto) */
const TONOS_BARRA = ['bg-primario-oscuro', 'bg-sky-800', 'bg-primario', 'bg-indigo-400', 'bg-violet-300'];

/** Inicio / Métricas del coordinador (Figma 99:695). Datos reales de la BD. */
export function InicioCoordinadorPage() {
  const { datos, cargando, error } = useCarga(() => Promise.all([reportes.metricas(), notificaciones.mias()]), []);
  if (cargando) return <Cargando />;
  if (error || !datos) return <Alerta>{error}</Alerta>;
  const [m, notis] = datos;

  const totalTutorias = m.tutorias_por_estado.Programada + m.tutorias_por_estado.Realizada + m.tutorias_por_estado.Cancelada;
  const totalDemanda = Math.max(1, m.demanda_por_asignatura.reduce((s, d) => s + d.total, 0));
  const actividad = notis.slice(0, 4);

  return (
    <div className="max-w-5xl">
      <section className="relative mb-5 overflow-hidden rounded-2xl bg-primario px-7 py-6 text-white shadow-md">
        {/* Círculo decorativo (Figma 99:695) */}
        <div aria-hidden className="absolute -top-8 right-12 size-52 rounded-full bg-white/15" />
        <h1 className="relative text-2xl font-medium text-violet-200">Bienvenido, Coordinador</h1>
        <p className="relative mt-1.5 max-w-lg text-xs leading-relaxed text-violet-100/80">
          Resumen del estado actual de las tutorías y usuarios de SIGTAU.
        </p>
        <div className="relative mt-4 inline-block rounded-md border border-white/20 bg-white/10 px-3 py-1.5">
          <p className="text-[9px] tracking-wide text-violet-200 uppercase">Sesiones activas ahora</p>
          <p className="text-sm font-medium">{m.sesiones_activas}</p>
        </div>
      </section>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica icono={<Users size={15} />} etiqueta="Total Usuarios" valor={m.total_usuarios}
          detalle={`${m.usuarios_por_rol.Estudiante} estudiantes · ${m.usuarios_por_rol.Tutor} tutores`} />
        <Metrica icono={<BookOpen size={15} />} etiqueta="Sesiones de Tutoría" valor={totalTutorias}
          detalle={`${m.tutorias_por_estado.Programada} programadas`} />
        <Metrica icono={<Clock size={15} />} etiqueta="Solicitudes Pendientes" valor={m.solicitudes_pendientes} detalle="Esperando respuesta del tutor" />
        <Metrica icono={<UserCheck size={15} />} etiqueta="Tasa de Asistencia" valor={`${m.tasa_asistencia}%`} detalle="De tutorías con seguimiento" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          <Tarjeta className="border-transparent bg-fondo-tutor !p-5 shadow-none">
            <h2 className="mb-4 font-medium">Demanda por Asignatura</h2>
            {m.demanda_por_asignatura.length === 0 && <p className="text-sm text-texto-suave">Aún no hay solicitudes.</p>}
            <div className="flex flex-col gap-3.5">
              {m.demanda_por_asignatura.map((d, i) => {
                const pct = Math.round((d.total / totalDemanda) * 100);
                return (
                  <div key={d.asignatura}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{d.asignatura}</span>
                      <span className="text-texto-suave">{pct}% <span className="text-[10px]">({d.total})</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-campo">
                      <div className={`h-1.5 rounded-full ${TONOS_BARRA[i % TONOS_BARRA.length]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Tarjeta>

          <Tarjeta className="border-transparent bg-fondo-tutor !p-5 shadow-none">
            <h2 className="mb-3 font-medium">Tutorías por Estado</h2>
            {(['Programada', 'Realizada', 'Cancelada'] as const).map((e) => (
              <div key={e} className="flex items-center justify-between border-b border-borde py-2 text-xs last:border-0">
                <span className="flex items-center gap-2"><CalendarCheck size={14} className="text-primario" /> {e}s</span>
                <b className="text-sm">{m.tutorias_por_estado[e]}</b>
              </div>
            ))}
          </Tarjeta>
        </div>

        {/* "Registro de Actividad" del Figma: últimas notificaciones del coordinador */}
        <Tarjeta className="border-transparent bg-fondo-tutor !p-5 shadow-none">
          <h2 className="mb-3 font-medium">Registro de Actividad</h2>
          {actividad.length === 0 && <p className="py-4 text-xs text-texto-suave">Sin actividad reciente.</p>}
          <div className="flex flex-col gap-3">
            {actividad.map((n) => (
              <div key={n.id_notificacion} className="flex gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primario-suave text-primario"><Bell size={12} /></span>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{n.titulo}</p>
                  <p className="truncate text-[10px] text-texto-suave">{n.mensaje} • {haceCuanto(n.fecha_envio)}</p>
                </div>
              </div>
            ))}
          </div>
          <Link to="/coordinador/reportes"
            className="mt-4 flex items-center justify-center gap-2 rounded-md border border-borde bg-white py-1.5 text-xs font-medium text-primario hover:bg-fondo">
            <FileBarChart size={14} /> Generar reporte
          </Link>
        </Tarjeta>
      </div>
    </div>
  );
}

function Metrica({ icono, etiqueta, valor, detalle }: { icono: React.ReactNode; etiqueta: string; valor: string | number; detalle: string }) {
  return (
    <Tarjeta className="border-transparent bg-fondo-tutor !p-4 shadow-none">
      <span className="flex size-7 items-center justify-center rounded-md bg-primario-suave text-primario">{icono}</span>
      <p className="mt-3 text-[11px] text-texto-suave">{etiqueta}</p>
      <p className="text-2xl font-bold">{valor}</p>
      <p className="mt-0.5 text-[10px] text-texto-suave">{detalle}</p>
    </Tarjeta>
  );
}
