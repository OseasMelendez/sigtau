import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Clock, Lock } from 'lucide-react';
import { horarios, solicitudes, tutorias } from '../../services';
import { mensajeError } from '../../lib/hooks';
import { hoyISO, lunesDe, sumarDias } from '../../lib/fechas';
import { Alerta } from '../../components/ui';
import { SemanaFranjas } from '../../components/SemanaFranjas';
import { ModalAprobar } from './SolicitudesPendientesPage';
import type { Franja, SolicitudTutor, Tutoria } from '../../types';

/**
 * Programación de tutorías (Figma 276:248). Calendario semanal del tutor con:
 *  - solicitudes "Por confirmar" (clic -> modal Aprobar solicitud),
 *  - tutorías programadas (clic -> detalle),
 *  - franjas disponibles.
 */
export function ProgramacionTutoriasPage() {
  const navigate = useNavigate();
  const [lunes, setLunes] = useState(lunesDe(hoyISO()));
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [pendientes, setPendientes] = useState<SolicitudTutor[]>([]);
  const [tuts, setTuts] = useState<Tutoria[]>([]);
  const [error, setError] = useState('');
  const [aprobar, setAprobar] = useState<SolicitudTutor | null>(null);

  const cargar = useCallback(() => {
    Promise.all([horarios.mios(lunes, sumarDias(lunes, 6)), solicitudes.pendientes(), tutorias.mias()])
      .then(([f, p, t]) => { setFranjas(f); setPendientes(p); setTuts(t); })
      .catch((e) => setError(mensajeError(e)));
  }, [lunes]);
  useEffect(cargar, [cargar]);

  // Al entrar, ir a la semana de la primera solicitud pendiente
  useEffect(() => {
    solicitudes.pendientes().then((p) => {
      const primera = [...p].sort((a, b) => a.franja.fecha.localeCompare(b.franja.fecha))[0];
      if (primera) setLunes(lunesDe(primera.franja.fecha));
    }).catch(() => undefined);
  }, []);

  const solicitudDe = (f: Franja) => pendientes.find((s) => s.franja.id_horario === f.id_horario);
  const tutoriaDe = (f: Franja) => tuts.find((t) => t.franja.id_horario === f.id_horario && t.estado !== 'Cancelada');

  return (
    <div className="max-w-6xl">
      <Link to="/tutor" className="mb-3 inline-flex items-center gap-3 text-xs text-texto-suave hover:text-primario">
        <ArrowLeft size={16} className="text-texto" /> Solicitudes Pendientes / Programar Tutoría
      </Link>
      <p className="mb-4 text-sm text-texto-suave">Administra tu disponibilidad y confirma las solicitudes de tutoría.</p>

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-peligro/50 bg-peligro-suave/70 px-4 py-2.5 text-xs text-peligro">
        <AlertCircle size={16} className="mt-px shrink-0" />
        <div>
          <p className="text-sm font-medium">Aviso Importante</p>
          <p>No se pueden eliminar franjas con tutorías programadas. Debes reprogramar o cancelar la tutoría primero.</p>
        </div>
      </div>
      {error && <div className="mb-4"><Alerta>{error}</Alerta></div>}

      <div>
        <SemanaFranjas cuadricula aspecto="calendario" leyenda={false}
          lunes={lunes} onCambiarSemana={setLunes} franjas={franjas}
          deshabilitar={(f) => !solicitudDe(f) && !tutoriaDe(f)}
          onElegir={(f) => {
            const s = solicitudDe(f);
            if (s) return setAprobar(s);
            const t = tutoriaDe(f);
            if (t) navigate(`/tutor/tutorias/${t.id_tutoria}`);
          }}
          estilo={(f) => {
            // Figma 276:248
            if (solicitudDe(f)) return 'border-2 border-primario bg-campo text-texto hover:!bg-primario-suave';
            if (tutoriaDe(f)) return 'bg-primario-oscuro text-white';
            if (f.estado === 'Disponible') return 'border-l-4 border-primario bg-primario-suave text-primario-oscuro';
            return undefined;
          }}
          renderContenido={(f) => {
            const s = solicitudDe(f);
            const t = tutoriaDe(f);
            const hora = <span className="font-semibold">{f.hora_inicio} – {f.hora_fin}</span>;
            if (s) return (
              <span className="flex w-full flex-col leading-tight">
                <span className="flex items-start justify-between gap-1">{hora}<Lock size={11} className="shrink-0" /></span>
                <span className="mt-0.5 truncate font-semibold">{s.estudiante.nombre_completo}</span>
                <span className="truncate text-[9px] text-texto-suave">{s.asignatura.nombre}</span>
                <span className="mt-1 self-start rounded-full bg-primario px-1.5 py-px text-[9px] text-white">Por confirmar</span>
              </span>
            );
            if (t) return (
              <span className="flex w-full flex-col leading-tight">
                <span className="flex items-start justify-between gap-1">{hora}<Lock size={11} className="shrink-0" /></span>
                <span className="mt-0.5 truncate text-white/80">{t.estudiante.nombre_completo}</span>
              </span>
            );
            return (
              <span className="flex w-full flex-col leading-tight">
                <span className="flex items-center gap-1"><Clock size={10} className="shrink-0" />{hora}</span>
                <span className="mt-0.5 text-primario/70">{f.estado === 'Disponible' ? 'Disponible' : f.estado}</span>
              </span>
            );
          }}
        />
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-texto-suave">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-primario bg-campo" /> Por confirmar (clic para aprobar)</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primario-oscuro" /> Tutoría programada</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primario-suave ring-1 ring-primario" /> Disponible</span>
        </div>
      </div>

      <ModalAprobar solicitud={aprobar} onCerrar={() => setAprobar(null)} onListo={() => { setAprobar(null); cargar(); }} />
    </div>
  );
}
