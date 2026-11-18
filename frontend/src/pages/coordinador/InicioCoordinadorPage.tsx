import { Link } from 'react-router-dom';
import { BookOpen, CalendarCheck, Clock, FileBarChart, UserCheck, Users } from 'lucide-react';
import { reportes } from '../../services';
import { useCarga } from '../../lib/hooks';
import { Alerta, Cargando, Tarjeta } from '../../components/ui';

/** Inicio / Métricas del coordinador (Figma 99:695). Datos reales de la BD. */
export function InicioCoordinadorPage() {
  const { datos: m, cargando, error } = useCarga(() => reportes.metricas(), []);
  if (cargando) return <Cargando />;
  if (error || !m) return <Alerta>{error}</Alerta>;

  const totalTutorias = m.tutorias_por_estado.Programada + m.tutorias_por_estado.Realizada + m.tutorias_por_estado.Cancelada;
  const maxDemanda = Math.max(1, ...m.demanda_por_asignatura.map((d) => d.total));

  return (
    <div className="max-w-6xl">
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-primario px-8 py-8 text-white shadow-md">
        <div className="absolute -top-10 right-10 size-60 rounded-full bg-white/10" />
        <h1 className="text-3xl font-medium text-violet-200">Bienvenido, Coordinador</h1>
        <p className="mt-2 max-w-xl text-sm text-violet-100/90">
          Resumen del estado actual de las tutorías y usuarios de SIGTAU.
        </p>
        <div className="mt-5 inline-block rounded-lg border border-white/20 bg-white/10 px-4 py-2">
          <p className="text-[10px] tracking-wide text-violet-200 uppercase">Sesiones activas ahora</p>
          <p className="text-lg font-semibold">{m.sesiones_activas}</p>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica icono={<Users size={18} />} etiqueta="Total usuarios" valor={m.total_usuarios}
          detalle={`${m.usuarios_por_rol.Estudiante} estudiantes · ${m.usuarios_por_rol.Tutor} tutores`} />
        <Metrica icono={<BookOpen size={18} />} etiqueta="Tutorías registradas" valor={totalTutorias}
          detalle={`${m.tutorias_por_estado.Programada} programadas`} />
        <Metrica icono={<Clock size={18} />} etiqueta="Solicitudes pendientes" valor={m.solicitudes_pendientes} detalle="Esperando respuesta del tutor" />
        <Metrica icono={<UserCheck size={18} />} etiqueta="Tasa de asistencia" valor={`${m.tasa_asistencia}%`} detalle="De tutorías con seguimiento" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Tarjeta className="!p-6">
          <h2 className="mb-5 text-lg font-medium">Demanda por asignatura</h2>
          {m.demanda_por_asignatura.length === 0 && <p className="text-sm text-texto-suave">Aún no hay solicitudes.</p>}
          <div className="flex flex-col gap-4">
            {m.demanda_por_asignatura.map((d) => (
              <div key={d.asignatura}>
                <div className="mb-1.5 flex justify-between text-sm"><span>{d.asignatura}</span><span className="text-texto-suave">{d.total}</span></div>
                <div className="h-2 rounded-full bg-fondo">
                  <div className="h-2 rounded-full bg-primario" style={{ width: `${(d.total / maxDemanda) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta className="!p-6">
          <h2 className="mb-4 text-lg font-medium">Tutorías por estado</h2>
          {(['Programada', 'Realizada', 'Cancelada'] as const).map((e) => (
            <div key={e} className="flex items-center justify-between border-b border-borde py-2.5 text-sm last:border-0">
              <span className="flex items-center gap-2"><CalendarCheck size={15} className="text-primario" /> {e}s</span>
              <b>{m.tutorias_por_estado[e]}</b>
            </div>
          ))}
          <Link to="/coordinador/reportes" className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-borde py-2 text-sm font-semibold text-primario-oscuro hover:bg-fondo">
            <FileBarChart size={16} /> Generar reporte
          </Link>
        </Tarjeta>
      </div>
    </div>
  );
}

function Metrica({ icono, etiqueta, valor, detalle }: { icono: React.ReactNode; etiqueta: string; valor: string | number; detalle: string }) {
  return (
    <Tarjeta>
      <span className="flex size-9 items-center justify-center rounded-lg bg-primario-suave text-primario">{icono}</span>
      <p className="mt-3 text-sm text-texto-suave">{etiqueta}</p>
      <p className="text-3xl font-bold">{valor}</p>
      <p className="mt-1 text-xs text-texto-suave">{detalle}</p>
    </Tarjeta>
  );
}
