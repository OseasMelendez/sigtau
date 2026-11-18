import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Clock, FileText } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { notificaciones, solicitudes, tutorias } from '../../services';
import { useCarga } from '../../lib/hooks';
import { fechaConDia, hoyISO, horaActual, sumarDias } from '../../lib/fechas';
import { Alerta, Badge, Cargando, Tarjeta, Vacio } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import type { Tutoria } from '../../types';

/** 8.2.2 Vista de inicio del estudiante (Figma 1:5) */
export function InicioEstudiantePage() {
  const { usuario } = useAuth();
  const { datos, cargando, error } = useCarga(
    () => Promise.all([solicitudes.mias(), tutorias.mias(), notificaciones.mias()]),
    [],
  );

  if (cargando) return <Cargando />;
  if (error || !datos) return <Alerta>{error}</Alerta>;
  const [sols, tuts, notis] = datos;

  const hoy = hoyISO();
  const hora = horaActual();
  const proximas = tuts
    .filter((t) => t.estado === 'Programada' && (t.franja.fecha > hoy || (t.franja.fecha === hoy && t.franja.hora_fin > hora)))
    .sort((a, b) => (a.franja.fecha + a.franja.hora_inicio).localeCompare(b.franja.fecha + b.franja.hora_inicio));

  const textoProxima = (t?: Tutoria) => {
    if (!t) return 'Sin sesiones';
    if (t.franja.fecha === hoy) return 'Hoy';
    if (t.franja.fecha === sumarDias(hoy, 1)) return 'Mañana';
    return new Date(`${t.franja.fecha}T00:00:00Z`).toLocaleDateString('es-SV', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Bienvenido/a, {usuario?.nombre_completo}</h1>
      <p className="mt-1.5 mb-7 text-texto-suave">Aquí tienes un resumen de tu actividad académica.</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Estadistica icono={<FileText size={16} />} etiqueta="Solicitudes" valor={sols.length} a="/estudiante/solicitudes" />
        <Estadistica icono={<CalendarDays size={16} />} etiqueta="Próxima Sesión" valor={textoProxima(proximas[0])} pequeno />
        <Estadistica icono={<Bell size={16} />} etiqueta="Notificaciones" valor={notis.filter((n) => !n.leida).length} />
      </div>

      {proximas.length === 0 ? (
        <Vacio texto="No tienes tutorías programadas.">
          <Link to="/estudiante/nueva-solicitud" className="font-semibold text-primario hover:underline">Solicitar una tutoría</Link>
        </Vacio>
      ) : (
        <div className="flex flex-col gap-5">
          {proximas.slice(0, 2).map((t, i) => (
            <Tarjeta key={t.id_tutoria} className="flex flex-wrap items-center gap-6 !p-6">
              <div className="min-w-60 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-medium">{i === 0 ? 'Próxima Sesión' : 'Siguiente Sesión'}</h2>
                  <Badge estado={t.estado} />
                </div>
                <p className="mt-1 text-xl font-bold text-primario-oscuro">{t.asignatura.nombre}</p>
                <div className="mt-5 flex items-center gap-3">
                  <Iniciales nombre={t.tutor.nombre_completo} className="size-10 text-sm" />
                  <div>
                    <p className="text-sm font-medium">{t.tutor.nombre_completo}</p>
                    <p className="text-xs text-texto-suave">Tutor asignado</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 border-borde sm:border-l sm:pl-6">
                <p className="flex items-center gap-2 text-sm"><CalendarDays size={18} className="text-primario" /> {fechaConDia(t.franja.fecha)}</p>
                <p className="flex items-center gap-2 text-sm"><Clock size={18} className="text-primario" /> {t.franja.hora_inicio} – {t.franja.hora_fin}</p>
                <Link to={`/estudiante/tutorias/${t.id_tutoria}`}
                  className="mt-2 rounded-full bg-primario-oscuro px-5 py-2 text-sm font-medium text-white hover:bg-primario">
                  Ver Detalles
                </Link>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  );
}

function Estadistica({ icono, etiqueta, valor, a, pequeno }: { icono: React.ReactNode; etiqueta: string; valor: string | number; a?: string; pequeno?: boolean }) {
  const contenido = (
    <Tarjeta className="h-full transition-shadow hover:shadow-md">
      <p className="flex items-center gap-2 text-sm text-texto-suave">{icono} {etiqueta}</p>
      <p className={`mt-2 font-bold ${pequeno ? 'text-xl' : 'text-4xl'}`}>{valor}</p>
    </Tarjeta>
  );
  return a ? <Link to={a}>{contenido}</Link> : contenido;
}
