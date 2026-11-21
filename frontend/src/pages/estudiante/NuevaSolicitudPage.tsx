import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, ChevronDown, FileText, UploadCloud, X } from 'lucide-react';
import { catalogos, solicitudes, tutores } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { nombreTutor } from '../../lib/nombres';
import { textoFranja } from '../../lib/fechas';
import { Alerta, Boton, Campo, Cargando, Encabezado, Tarjeta, Vacio, claseInput } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import type { Franja, TutorResumen } from '../../types';

const MAX = 500;
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const BORRADOR = 'sigtau:borrador-dificultad';

/** Documento de apoyo (opcional). Se guarda fuera del componente para no perderlo al ir a "Ver disponibilidad" y volver. */
let archivoGuardado: File | null = null;
const EXT_DOC = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
const MAX_DOC = 5 * 1024 * 1024;
const validarDoc = (a: File) => {
  const ext = a.name.slice(a.name.lastIndexOf('.')).toLowerCase();
  if (!EXT_DOC.includes(ext)) return 'Solo se permiten archivos PDF, Word o imágenes (PNG, JPG)';
  if (a.size > MAX_DOC) return 'El documento no puede superar 5 MB';
  return '';
};

/** Campo relleno lila sin borde, como el select y el textarea del Figma. */
// "!" porque claseInput ya trae bg-white y border-borde, y Tailwind los generaría después
const claseRelleno = `${claseInput} border-transparent! bg-campo!`;

/** Colores de la etiqueta de especialidad (en el Figma cada una tiene su color). */
const COLORES_ESPECIALIDAD = [
  'bg-primario-suave text-primario-oscuro',
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
];
const colorEspecialidad = (e: string) =>
  COLORES_ESPECIALIDAD[[...e].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORES_ESPECIALIDAD.length];

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
  const [archivo, setArchivoEstado] = useState<File | null>(archivoGuardado);
  const [errorDoc, setErrorDoc] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const setArchivo = (a: File | null) => { archivoGuardado = a; setArchivoEstado(a); };
  const elegirArchivo = (a?: File | null) => {
    if (!a) return;
    const err = validarDoc(a);
    setErrorDoc(err);
    if (!err) setArchivo(a);
  };

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
      const nueva = await solicitudes.crear({ id_asignatura: idAsignatura, id_horario: franja!.id_horario, descripcion_dificultad: dificultad.trim() });
      sessionStorage.removeItem(BORRADOR);
      // El documento se sube después de crear la solicitud; si falla, la solicitud igual queda enviada
      if (archivo) {
        try {
          await solicitudes.subirDocumento(nueva.id_solicitud, archivo);
        } catch (e) {
          avisar(`La solicitud se envió, pero no se pudo adjuntar el documento: ${mensajeError(e)}`, 'error');
        }
        setArchivo(null);
      }
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
        <Tarjeta className="flex flex-col gap-7 border-transparent !p-7 shadow-md shadow-primario/5">
          <Campo etiqueta="Asignatura" htmlFor="asignatura" error={errores.asignatura}>
            <div className="relative w-full max-w-xs">
              <select id="asignatura" className={`${claseRelleno} cursor-pointer appearance-none pr-9`} value={idAsignatura || ''}
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
                  <span><b>{nombreTutor(tutorElegido)}</b> · <span className="text-primario-oscuro">{textoFranja(franja)}</span></span>
                  <Link className="ml-auto font-semibold text-primario hover:underline"
                    to={`/estudiante/nueva-solicitud/tutor/${idTutor}?asignatura=${idAsignatura}`}>Cambiar</Link>
                </div>
              ) : errores.franja && <p className="mt-2 text-xs text-peligro">{errores.franja}</p>}
            </div>
          )}

          <Campo etiqueta="Describe tu dificultad académica" htmlFor="dificultad" error={errores.dificultad}
            derecha={dificultad.length ? `${dificultad.length}/${MAX} caract.` : `Máx. ${MAX} caract.`}>
            <textarea id="dificultad" rows={4} maxLength={MAX} className={`${claseRelleno} resize-none`}
              aria-invalid={!!errores.dificultad} value={dificultad}
              placeholder="Ej: Tengo problemas para entender los conceptos de derivadas parciales en el capítulo 4…"
              onChange={(e) => setDificultad(e.target.value)} />
          </Campo>

          {/* Documento de apoyo (Figma 1:179) */}
          <Campo etiqueta="Documento de apoyo" opcional htmlFor="documento" error={errorDoc} ayuda="PDF, Word o imagen (PNG, JPG), máx. 5 MB">
            {archivo ? (
              <div className="flex items-center gap-3 rounded-lg border border-borde bg-fondo-tutor px-4 py-3 text-sm">
                <FileText size={18} className="shrink-0 text-primario" />
                <span className="min-w-0 flex-1 truncate">{archivo.name}</span>
                <span className="text-xs text-texto-suave">{(archivo.size / 1024 / 1024).toFixed(2)} MB</span>
                <button type="button" onClick={() => setArchivo(null)} className="rounded p-1 text-texto-suave hover:bg-campo hover:text-peligro" aria-label="Quitar documento"><X size={16} /></button>
              </div>
            ) : (
              <label htmlFor="documento"
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegirArchivo(e.dataTransfer.files[0]); }}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${arrastrando ? 'border-primario bg-primario-suave/40' : 'border-borde bg-fondo-tutor/60 hover:border-primario/50'}`}>
                <span className="flex size-9 items-center justify-center rounded-full bg-campo text-texto-suave"><UploadCloud size={18} /></span>
                <span><span className="font-medium text-primario">Haz clic para subir</span> o arrastra y suelta tu archivo aquí.</span>
              </label>
            )}
            <input id="documento" type="file" className="sr-only" accept={EXT_DOC.join(',')}
              onChange={(e) => { elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
          </Campo>

          {errorApi && <Alerta>{errorApi}</Alerta>}

          <div className="flex justify-end gap-3 border-t border-borde pt-5">
            <Boton type="button" variante="secundario" onClick={() => { sessionStorage.removeItem(BORRADOR); setArchivo(null); navigate('/estudiante'); }}>
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
    <div className={`flex flex-col items-center rounded-xl border bg-white px-3 pt-4 pb-3 text-center ${seleccionado ? 'border-primario ring-2 ring-primario/30' : 'border-borde'}`}>
      <Iniciales id={tutor.id_usuario} nombre={tutor.nombre_completo} className="size-12 text-base" />
      <p className="mt-3 font-semibold">{nombreTutor(tutor)}</p>
      <span className={`mt-1 rounded-full px-2 py-0.5 text-[11px] ${colorEspecialidad(tutor.especialidad)}`}>{tutor.especialidad}</span>
      <div className="mt-5 flex gap-1">
        {DIAS.map((d, i) => {
          const disponible = tutor.dias_disponibles.includes(i + 1);
          // El Figma muestra de lunes a sábado; el domingo solo aparece si el tutor tiene franjas ese día
          if (d === 'D' && !disponible) return null;
          return (
            <span key={d} className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${
              disponible ? 'bg-primario-oscuro text-white' : 'bg-campo/70 text-slate-400'}`}>{d}</span>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-texto-suave">
        {tutor.franjas_disponibles} {tutor.franjas_disponibles === 1 ? 'cupo disponible' : 'cupos disponibles'}
      </p>
      <Link to={enlace} className="mt-2 w-full rounded-md border border-borde py-1.5 text-xs font-semibold text-primario hover:bg-fondo">
        Ver disponibilidad
      </Link>
    </div>
  );
}
