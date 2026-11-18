import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, ChevronDown } from 'lucide-react';
import { catalogos, solicitudes, tutores } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { textoFranja } from '../../lib/fechas';
import { Alerta, Boton, Campo, Cargando, Encabezado, Tarjeta, Vacio, claseInput } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import type { Franja, TutorResumen } from '../../types';

const MAX = 500;
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const BORRADOR = 'sigtau:borrador-dificultad';

/**
 * 8.2.3 Nueva solicitud (Figma 1:179). RF-03
 * Flujo: asignatura -> tutor -> "Ver disponibilidad" (DetalleTutorPage) -> elige franja
 * -> vuelve aquí con ?asignatura=&tutor=&horario= -> escribe la dificultad -> envía.
 */
export function NuevaSolicitudPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const avisar = useToast();
  const idAsignatura = Number(params.get('asignatura')) || 0;
  const idTutor = Number(params.get('tutor')) || 0;
  const idHorario = Number(params.get('horario')) || 0;

  const asigs = useCarga(() => catalogos.asignaturas(), []);
  const [lista, setLista] = useState<TutorResumen[] | null>(null);
  const [franja, setFranja] = useState<Franja | null>(null);
  const [dificultad, setDificultad] = useState(() => sessionStorage.getItem(BORRADOR) ?? '');
  const [errores, setErrores] = useState<{ asignatura?: string; franja?: string; dificultad?: string }>({});
  const [errorApi, setErrorApi] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { sessionStorage.setItem(BORRADOR, dificultad); }, [dificultad]);

  // Tutores que imparten la asignatura elegida
  useEffect(() => {
    setLista(null);
    if (!idAsignatura) return;
    tutores.porAsignatura(idAsignatura).then(setLista).catch((e) => setErrorApi(mensajeError(e)));
  }, [idAsignatura]);

  // Datos de la franja elegida en la pantalla de disponibilidad
  useEffect(() => {
    setFranja(null);
    if (!idTutor || !idHorario) return;
    tutores.franjas(idTutor, '2000-01-01', '2100-12-31')
      .then((fs) => setFranja(fs.find((f) => f.id_horario === idHorario && f.estado === 'Disponible') ?? null))
      .catch(() => setFranja(null));
  }, [idTutor, idHorario]);

  const tutorElegido = lista?.find((t) => t.id_usuario === idTutor);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErrorApi('');
    const err: typeof errores = {};
    if (!idAsignatura) err.asignatura = 'Selecciona una asignatura';
    if (!franja) err.franja = 'Selecciona un tutor y una franja disponible';
    if (!dificultad.trim()) err.dificultad = 'La dificultad es obligatoria';
    else if (dificultad.length > MAX) err.dificultad = `La dificultad no puede superar ${MAX} caracteres`;
    setErrores(err);
    if (Object.keys(err).length) return;

    setEnviando(true);
    try {
      await solicitudes.crear({ id_asignatura: idAsignatura, id_horario: franja!.id_horario, descripcion_dificultad: dificultad.trim() });
      sessionStorage.removeItem(BORRADOR);
      avisar('Solicitud enviada. El tutor la revisará pronto.');
      navigate('/estudiante/solicitudes');
    } catch (e) {
      setErrorApi(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <Encabezado titulo="Nueva Solicitud" subtitulo="Completa los detalles para programar tu sesión de tutoría académica." />

      <form onSubmit={enviar} noValidate>
        <Tarjeta className="flex flex-col gap-7 !p-7">
          <Campo etiqueta="Asignatura" htmlFor="asignatura" error={errores.asignatura}>
            <div className="relative w-full max-w-xs">
              <select id="asignatura" className={`${claseInput} appearance-none pr-9`} value={idAsignatura || ''}
                aria-invalid={!!errores.asignatura}
                onChange={(e) => setParams(e.target.value ? { asignatura: e.target.value } : {})}>
                <option value="">Selecciona una asignatura</option>
                {asigs.datos?.map((a) => <option key={a.id_asignatura} value={a.id_asignatura}>{a.nombre}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave" />
            </div>
          </Campo>

          {idAsignatura > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold">Seleccionar Tutor Disponible</p>
              {lista === null ? <Cargando texto="Buscando tutores…" /> : lista.length === 0 ? (
                <Vacio texto="No hay tutores disponibles para esta asignatura." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {lista.map((t) => (
                    <TarjetaTutor key={t.id_usuario} tutor={t} seleccionado={t.id_usuario === idTutor}
                      enlace={`/estudiante/nueva-solicitud/tutor/${t.id_usuario}?asignatura=${idAsignatura}`} />
                  ))}
                </div>
              )}
              {franja && tutorElegido ? (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-primario/30 bg-primario-suave/40 px-4 py-3 text-sm">
                  <CalendarCheck size={20} className="text-primario" />
                  <span><b>{tutorElegido.nombre_completo}</b> · <span className="text-primario-oscuro">{textoFranja(franja)}</span></span>
                  <Link className="ml-auto font-semibold text-primario hover:underline"
                    to={`/estudiante/nueva-solicitud/tutor/${idTutor}?asignatura=${idAsignatura}`}>Cambiar</Link>
                </div>
              ) : errores.franja && <p className="mt-2 text-xs text-peligro">{errores.franja}</p>}
            </div>
          )}

          <Campo etiqueta="Describe tu dificultad académica" htmlFor="dificultad" error={errores.dificultad}
            derecha={`${dificultad.length}/${MAX} caract.`}>
            <textarea id="dificultad" rows={4} maxLength={MAX} className={`${claseInput} resize-none bg-fondo`}
              aria-invalid={!!errores.dificultad} value={dificultad}
              placeholder="Ej: Tengo problemas para entender los conceptos de derivadas parciales en el capítulo 4…"
              onChange={(e) => setDificultad(e.target.value)} />
          </Campo>

          {errorApi && <Alerta>{errorApi}</Alerta>}

          <div className="flex justify-end gap-3 border-t border-borde pt-5">
            <Boton type="button" variante="secundario" onClick={() => { sessionStorage.removeItem(BORRADOR); navigate('/estudiante'); }}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={enviando}>Enviar solicitud</Boton>
          </div>
        </Tarjeta>
      </form>
    </div>
  );
}

function TarjetaTutor({ tutor, seleccionado, enlace }: { tutor: TutorResumen; seleccionado: boolean; enlace: string }) {
  return (
    <div className={`flex flex-col items-center rounded-xl border bg-white p-4 text-center ${seleccionado ? 'border-primario ring-2 ring-primario/30' : 'border-borde'}`}>
      <Iniciales nombre={tutor.nombre_completo} className="size-14 text-lg" />
      <p className="mt-3 font-semibold">{tutor.nombre_completo}</p>
      <span className="mt-1 rounded-full bg-primario-suave px-2 py-0.5 text-xs text-primario-oscuro">{tutor.especialidad}</span>
      <div className="mt-4 flex gap-1">
        {DIAS.map((d, i) => (
          <span key={d} className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${
            tutor.dias_disponibles.includes(i + 1) ? 'bg-primario text-white' : 'bg-fondo text-slate-400'}`}>{d}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-texto-suave">
        {tutor.franjas_disponibles} {tutor.franjas_disponibles === 1 ? 'cupo disponible' : 'cupos disponibles'}
      </p>
      <Link to={enlace} className="mt-3 w-full rounded-lg border border-borde py-1.5 text-sm font-semibold text-primario-oscuro hover:bg-fondo">
        Ver disponibilidad
      </Link>
    </div>
  );
}
