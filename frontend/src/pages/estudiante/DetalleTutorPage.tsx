import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Info, Phone, User, UserRound } from 'lucide-react';
import { tutores } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { nombreTutor } from '../../lib/nombres';
import { hoyISO, lunesDe, sumarDias, textoFranja } from '../../lib/fechas';
import { Alerta, Boton, Cargando, Tarjeta } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import { LeyendaFranjas, SemanaFranjas } from '../../components/SemanaFranjas';
import type { Franja } from '../../types';

/** Detalle del tutor y disponibilidad semanal (Figma 50:359). El estudiante elige una franja. */
export function DetalleTutorPage() {
  const { id } = useParams();
  const idTutor = Number(id);
  const [params] = useSearchParams();
  const asignatura = params.get('asignatura') ?? '';
  const navigate = useNavigate();

  const tutor = useCarga(() => tutores.detalle(idTutor), [idTutor]);
  const [lunes, setLunes] = useState(lunesDe(hoyISO()));
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [elegida, setElegida] = useState<Franja | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    tutores.franjas(idTutor, lunes, sumarDias(lunes, 6)).then(setFranjas).catch((e) => setError(mensajeError(e)));
  }, [idTutor, lunes]);

  // Al entrar, saltar a la primera semana que tenga franjas disponibles
  useEffect(() => {
    tutores.franjas(idTutor, hoyISO(), '2100-12-31').then((fs) => {
      const primera = fs.filter((f) => f.estado === 'Disponible').sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      if (primera) setLunes(lunesDe(primera.fecha));
    }).catch(() => undefined);
  }, [idTutor]);

  const volver = `/estudiante/nueva-solicitud?asignatura=${asignatura}`;

  if (tutor.cargando) return <Cargando />;
  if (tutor.error || !tutor.datos) return <Alerta>{tutor.error}</Alerta>;
  const t = tutor.datos;

  return (
    <div className="max-w-6xl pb-20">
      <Link to={volver} className="group mb-5 inline-flex items-center gap-3 text-xs text-texto-suave hover:text-primario">
        <ArrowLeft size={18} className="text-texto" /> <span>Nueva Solicitud / <span className="text-texto group-hover:text-primario">Detalle del Tutor</span></span>
      </Link>

      <div className="grid items-start gap-5 lg:grid-cols-[18rem_1fr]">
        <Tarjeta className="border-transparent text-center shadow-md shadow-primario/5">
          <Iniciales id={t.id_usuario} nombre={t.nombre_completo} className="size-24 text-3xl" />
          <h1 className="mt-4 text-xl font-semibold">{nombreTutor(t)}</h1>
          {t.departamento && <p className="text-xs text-texto-suave">{t.departamento}</p>}
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primario-suave px-2.5 py-0.5 text-[11px] text-primario-oscuro"><UserRound size={11} /> {t.especialidad}</span>
          <div className="mt-5 border-t border-borde pt-4 text-left text-xs leading-relaxed">
            <p className="mb-1 flex items-center gap-1.5 font-semibold"><User size={15} /> Biografía</p>
            <p className="text-texto-suave">{t.biografia || 'Sin biografía registrada.'}</p>
            {t.telefono_contacto && <p className="mt-3 flex items-center gap-1.5 text-texto-suave"><Phone size={14} /> {t.telefono_contacto}</p>}
            <p className="mt-3 text-xs text-texto-suave">Imparte: {t.asignaturas.map((a) => a.nombre).join(', ')}</p>
          </div>
        </Tarjeta>

        <Tarjeta className="border-transparent shadow-md shadow-primario/5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays size={20} className="text-primario" /> Disponibilidad Semanal</h2>
            <LeyendaFranjas />
          </div>
          {error && <div className="mb-3"><Alerta>{error}</Alerta></div>}
          <SemanaFranjas lunes={lunes} onCambiarSemana={setLunes} franjas={franjas}
            seleccionada={elegida?.id_horario} onElegir={setElegida} cuadricula leyenda={false} />
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-borde px-4 py-3 text-sm">
            <Info size={18} className="mt-0.5 text-primario" />
            <div>
              <p><b>Selección actual:</b> <span className="font-semibold text-primario">{elegida ? textoFranja(elegida) : 'ninguna'}</span></p>
              <p className="text-xs text-texto-suave">Asegúrate de confirmar la fecha y hora antes de enviar la solicitud.</p>
            </div>
          </div>
        </Tarjeta>
      </div>

      <div className="fixed right-0 bottom-0 left-0 flex justify-end gap-3 border-t border-borde bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:left-56 md:px-8 md:py-4">
        <Boton variante="secundario" className="rounded-full" onClick={() => navigate(volver)}>Cancelar</Boton>
        <Boton className="rounded-full" disabled={!elegida}
          onClick={() => navigate(`${volver}&tutor=${idTutor}&horario=${elegida!.id_horario}`)}>
          Solicitar a este tutor <ArrowRight size={16} />
        </Boton>
      </div>
    </div>
  );
}
