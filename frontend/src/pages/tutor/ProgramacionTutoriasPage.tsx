import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Lock } from 'lucide-react';
import { horarios, solicitudes, tutorias } from '../../services';
import { mensajeError } from '../../lib/hooks';
import { hoyISO, lunesDe, sumarDias } from '../../lib/fechas';
import { Alerta, Tarjeta } from '../../components/ui';
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
      <Link to="/tutor" className="mb-2 inline-flex items-center gap-2 text-sm text-texto-suave hover:text-primario">
        <ArrowLeft size={18} /> Solicitudes Pendientes / Programar Tutoría
      </Link>
      <p className="mb-5 text-texto-suave">Administra tu disponibilidad y confirma las solicitudes de tutoría.</p>

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-peligro/40 bg-peligro-suave/60 px-4 py-3 text-sm text-peligro">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Aviso importante</p>
          <p>No se pueden eliminar franjas con tutorías programadas. Debes reprogramar o cancelar la tutoría primero.</p>
        </div>
      </div>
      {error && <div className="mb-4"><Alerta>{error}</Alerta></div>}

      <Tarjeta>
        <SemanaFranjas
          lunes={lunes} onCambiarSemana={setLunes} franjas={franjas}
          deshabilitar={(f) => !solicitudDe(f) && !tutoriaDe(f)}
          onElegir={(f) => {
            const s = solicitudDe(f);
            if (s) return setAprobar(s);
            const t = tutoriaDe(f);
            if (t) navigate(`/tutor/tutorias/${t.id_tutoria}`);
          }}
          estilo={(f) => {
            if (solicitudDe(f)) return 'border-2 border-primario bg-white text-primario-oscuro hover:!bg-primario-suave';
            if (tutoriaDe(f)) return 'bg-primario-oscuro text-white';
            if (f.estado === 'Disponible') return 'border-l-4 border-primario bg-primario-suave text-primario-oscuro';
            return undefined;
          }}
          renderAcciones={(f) => {
            const s = solicitudDe(f);
            const t = tutoriaDe(f);
            if (s) return (
              <span className="mt-1 block text-left font-normal">
                <span className="block truncate font-semibold">{s.estudiante.nombre_completo}</span>
                <span className="block truncate">{s.asignatura.nombre}</span>
                <span className="mt-1 inline-block rounded-full bg-primario px-2 py-0.5 text-[10px] text-white">Por confirmar</span>
              </span>
            );
            if (t) return (
              <span className="mt-1 flex items-center gap-1 text-left font-normal">
                <Lock size={10} className="shrink-0" /> <span className="truncate">{t.estudiante.nombre_completo}</span>
              </span>
            );
            return f.estado === 'Disponible' ? <span className="mt-0.5 block font-normal">Disponible</span> : null;
          }}
        />
        <div className="mt-3 flex gap-4 text-xs text-texto-suave">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-primario bg-white" /> Por confirmar (clic para aprobar)</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primario-oscuro" /> Tutoría programada</span>
        </div>
      </Tarjeta>

      <ModalAprobar solicitud={aprobar} onCerrar={() => setAprobar(null)} onListo={() => { setAprobar(null); cargar(); }} />
    </div>
  );
}
