import { useEffect, useState } from 'react';
import { Camera, Eye, EyeOff, GraduationCap, KeyRound, Lock, Mail, RefreshCw, User, UserPlus } from 'lucide-react';
import { catalogos, usuarios, type DatosUsuario } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { Alerta, Boton, Campo, Modal, claseInput } from '../../components/ui';
import { Selector } from '../../components/Selector';
import { useToast } from '../../components/Toast';
import { EXT_FOTO, Iniciales, refrescarFotos, validarFoto } from '../../components/Layout';
import type { UsuarioAdmin } from '../../types';

type Rol = 'Estudiante' | 'Tutor';
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESPECIALIDADES = ['Matemática', 'Matemáticas Aplicadas', 'Física', 'Física y Matemática', 'Programación', 'Química', 'Estadística'];

/** Contraseña aleatoria de 10 caracteres con mayúscula, minúscula, número y símbolo. */
function generarContrasena() {
  const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%*'];
  const azar = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const base = grupos.map(azar).concat(Array.from({ length: 6 }, () => azar(grupos.join(''))));
  return base.sort(() => crypto.getRandomValues(new Uint8Array(1))[0] - 128).join('');
}

/**
 * Registrar nuevo usuario (Figma 102:1093 estudiante, 128:285 tutor) y editar (162:782, 162:586). RF-12
 * El backend cifra la contraseña con bcrypt y marca debe_cambiar_contrasena = true.
 */
export function ModalUsuario({ usuario: u, onCerrar, onListo }: { usuario: UsuarioAdmin | null; onCerrar: () => void; onListo: () => void }) {
  const cat = useCarga(() => catalogos.todos(), []);
  const avisar = useToast();
  const [rol, setRol] = useState<Rol>((u?.rol as Rol) ?? 'Estudiante');
  const carreraInicial = u?.estudiante?.id_carrera ?? 0;
  const [f, setF] = useState({
    nombre_completo: u?.nombre_completo ?? '',
    identificacion: u?.identificacion ?? '',
    correo: u?.correo ?? '',
    nombre_usuario: u?.nombre_usuario ?? '',
    contrasena: '',
    id_facultad: u?.tutor?.id_facultad ?? 0,
    id_carrera: carreraInicial,
    ciclo: u?.estudiante?.ciclo ? String(u.estudiante.ciclo) : '',
    titulo: u?.tutor?.titulo ?? '',
    departamento: u?.tutor?.departamento ?? '',
    especialidad: u?.tutor?.especialidad ?? '',
    telefono_contacto: u?.tutor?.telefono_contacto ?? '',
    biografia: u?.tutor?.biografia ?? '',
    asignaturas: u?.tutor?.asignaturas.map((a) => a.id_asignatura) ?? ([] as number[]),
  });
  const [usuarioEditado, setUsuarioEditado] = useState(!!u);
  const [verClave, setVerClave] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  // Foto de perfil (opcional): se sube después de guardar el usuario
  const [foto, setFoto] = useState<File | null>(null);
  const [vistaFoto, setVistaFoto] = useState<string | undefined>();
  const [errorFoto, setErrorFoto] = useState('');
  useEffect(() => {
    if (!foto) return setVistaFoto(undefined);
    const url = URL.createObjectURL(foto);
    setVistaFoto(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  // Facultad del estudiante: se deduce de su carrera al editar
  const facultadEstudiante = f.id_facultad || cat.datos?.carreras.find((c) => c.id_carrera === carreraInicial)?.id_facultad || 0;
  const idFacultad = rol === 'Estudiante' ? facultadEstudiante : f.id_facultad;
  const carreras = cat.datos?.carreras.filter((c) => !idFacultad || c.id_facultad === idFacultad) ?? [];

  const cambiarCorreo = (correo: string) => {
    set('correo', correo);
    // Sugerir el nombre de usuario a partir del correo mientras no lo hayan escrito a mano
    if (!usuarioEditado) set('nombre_usuario', correo.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30));
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!f.nombre_completo.trim()) e.nombre_completo = 'El nombre es obligatorio';
    if (!f.identificacion.trim()) e.identificacion = 'La identificación es obligatoria';
    if (!CORREO.test(f.correo)) e.correo = 'Ingresa un correo válido';
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(f.nombre_usuario)) e.nombre_usuario = 'De 3 a 30 caracteres: letras, números, punto o guion';
    if ((!u || f.contrasena) && f.contrasena.length < 8) e.contrasena = 'Mínimo 8 caracteres';
    if (!idFacultad) e.id_facultad = 'Selecciona la facultad';
    if (rol === 'Estudiante') {
      if (!f.id_carrera) e.id_carrera = 'Selecciona la carrera';
    } else {
      if (!/^[0-9]{4}-?[0-9]{4}$/.test(f.telefono_contacto)) e.telefono_contacto = 'Formato: 2440-1000';
      if (!f.especialidad.trim()) e.especialidad = 'La especialidad es obligatoria';
      if (f.asignaturas.length === 0) e.asignaturas = 'Selecciona al menos una asignatura';
    }
    return e;
  };

  const guardar = async () => {
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) return;
    const datos: DatosUsuario = {
      rol,
      nombre_completo: f.nombre_completo.trim(),
      nombre_usuario: f.nombre_usuario.trim().toLowerCase(),
      identificacion: f.identificacion.trim().toUpperCase(),
      correo: f.correo.trim().toLowerCase(),
      contrasena: f.contrasena || undefined,
      ...(rol === 'Estudiante'
        ? { estudiante: { id_carrera: Number(f.id_carrera), ciclo: f.ciclo ? Number(f.ciclo) : null } }
        : { tutor: {
            id_facultad: Number(f.id_facultad), especialidad: f.especialidad.trim(),
            titulo: f.titulo.trim() || null, departamento: f.departamento.trim() || null,
            telefono_contacto: f.telefono_contacto.trim() || null, biografia: f.biografia.trim() || null, asignaturas: f.asignaturas,
          } }),
    };
    setEnviando(true);
    setError('');
    try {
      const guardado = u ? await usuarios.editar(u.id_usuario, datos) : await usuarios.crear(datos);
      if (foto) {
        try {
          await usuarios.subirFoto(guardado.id_usuario, foto);
          refrescarFotos();
        } catch (e) {
          avisar(`El usuario se guardó, pero no se pudo subir la foto: ${mensajeError(e)}`, 'error');
        }
      }
      avisar(u ? 'Usuario actualizado.' : `${rol} registrado correctamente.`);
      onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const texto = (k: keyof typeof f, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={`u-${k}`} className={`${claseInput} bg-fondo`} value={f[k] as string} aria-invalid={!!errores[k]}
      onChange={(e) => set(k, e.target.value)} {...props} />
  );
  const selector = (id: string, valor: string | number, onChange: (v: string) => void, opciones: React.ReactNode, invalido?: boolean) => (
    <div className="relative">
      <Selector id={id} className={`${claseInput} bg-fondo`} value={valor} invalido={invalido} onChange={(v) => onChange(v)}>{opciones}</Selector>
    </div>
  );
  const seccion = (icono: React.ReactNode, titulo: string) => (
    <p className="mt-6 mb-3 flex items-center gap-2 text-sm font-semibold text-primario-oscuro">{icono} {titulo}</p>
  );

  return (
    <Modal abierto ancho="max-w-xl" onCerrar={onCerrar}
      titulo={u ? `Editar ${rol === 'Estudiante' ? 'Estudiante' : 'Tutor'}` : 'Registrar Nuevo Usuario'}
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton cargando={enviando} onClick={guardar}><UserPlus size={16} /> {u ? 'Guardar cambios' : 'Registrar Usuario'}</Boton>
      </>}>
      <p className="-mt-2 mb-5 text-sm text-texto-suave">
        {u ? 'Modifica los datos del perfil.' : 'Ingresa los datos para crear un nuevo perfil en el sistema.'}
      </p>

      {!u && (
        <>
          <p className="mb-2 text-sm font-semibold">Tipo de Usuario</p>
          <div className="grid max-w-xs grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(['Estudiante', 'Tutor'] as Rol[]).map((r) => (
              <button key={r} onClick={() => { setRol(r); setErrores({}); }}
                className={`rounded-lg py-1.5 text-sm font-medium ${rol === r ? 'bg-white text-primario-oscuro shadow-sm' : 'text-texto-suave'}`}>{r}</button>
            ))}
          </div>
          <hr className="mt-5 border-borde" />
        </>
      )}

      {/* Foto de perfil (opcional) */}
      <div className="mb-2 flex items-center gap-4">
        <Iniciales id={u?.id_usuario} src={vistaFoto} nombre={f.nombre_completo || 'Nuevo Usuario'} className="size-16 text-xl" />
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-borde bg-white px-3 py-1.5 text-xs font-medium text-primario-oscuro hover:bg-fondo">
            <Camera size={14} /> {foto || u ? 'Cambiar foto' : 'Subir foto'}
            <input type="file" accept={EXT_FOTO} className="hidden" onChange={(e) => {
              const a = e.target.files?.[0];
              e.target.value = '';
              if (!a) return;
              const err = validarFoto(a);
              setErrorFoto(err);
              if (!err) setFoto(a);
            }} />
          </label>
          <p className={`mt-1 text-[11px] ${errorFoto ? 'text-peligro' : 'text-texto-suave'}`}>{errorFoto || 'Opcional. PNG, JPG o WEBP, máx. 2 MB'}</p>
        </div>
      </div>

      {seccion(<User size={16} />, 'Información Personal')}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre Completo *" htmlFor="u-nombre_completo" error={errores.nombre_completo}>{texto('nombre_completo', { maxLength: 100, placeholder: 'Ej. Ana García' })}</Campo>
        <Campo etiqueta="Identificación (ID) *" htmlFor="u-identificacion" error={errores.identificacion}>
          {texto('identificacion', { maxLength: 20, placeholder: rol === 'Estudiante' ? 'Carnet, ej. GA22001' : 'Número de documento' })}
        </Campo>
        <div className={rol === 'Estudiante' ? 'sm:col-span-2' : ''}>
          <Campo etiqueta="Correo Institucional *" htmlFor="u-correo" error={errores.correo}>
            <div className="relative">
              <Mail size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" />
              <input id="u-correo" type="email" maxLength={100} className={`${claseInput} bg-fondo pl-9`} placeholder="usuario@ues.edu.sv"
                value={f.correo} aria-invalid={!!errores.correo} onChange={(e) => cambiarCorreo(e.target.value)} />
            </div>
          </Campo>
        </div>
        {rol === 'Tutor' && (
          <Campo etiqueta="Número de Teléfono *" htmlFor="u-telefono_contacto" error={errores.telefono_contacto}>{texto('telefono_contacto', { maxLength: 9, placeholder: '2440-1000' })}</Campo>
        )}
      </div>

      {seccion(<User size={16} />, 'Información de Cuenta')}
      <Campo etiqueta="Nombre de Usuario *" htmlFor="u-nombre_usuario" error={errores.nombre_usuario} ayuda="Se sugiere a partir del correo">
        <input id="u-nombre_usuario" className={`${claseInput} bg-fondo`} maxLength={30} value={f.nombre_usuario} aria-invalid={!!errores.nombre_usuario}
          onChange={(e) => { setUsuarioEditado(true); set('nombre_usuario', e.target.value); }} />
      </Campo>

      <div className="mt-6 rounded-2xl border border-borde p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primario-oscuro"><GraduationCap size={16} /> Detalles Académicos</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Facultad" htmlFor="u-facultad" error={errores.id_facultad}>
            {selector('u-facultad', idFacultad, (v) => setF((x) => ({ ...x, id_facultad: Number(v), id_carrera: 0 })), <>
              <option value={0}>Seleccionar facultad…</option>
              {cat.datos?.facultades.map((x) => <option key={x.id_facultad} value={x.id_facultad}>{x.nombre}</option>)}
            </>, !!errores.id_facultad)}
          </Campo>
          {rol === 'Estudiante' ? (
            <>
              <Campo etiqueta="Programa / Carrera" htmlFor="u-carrera" error={errores.id_carrera}>
                {selector('u-carrera', f.id_carrera, (v) => set('id_carrera', Number(v)), <>
                  <option value={0}>{idFacultad ? 'Seleccionar programa' : 'Primero elige la facultad'}</option>
                  {carreras.map((c) => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre}</option>)}
                </>, !!errores.id_carrera)}
              </Campo>
              <Campo etiqueta="Ciclo" opcional htmlFor="u-ciclo">
                {selector('u-ciclo', f.ciclo, (v) => set('ciclo', v), <>
                  <option value="">Seleccionar ciclo</option>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Ciclo {i + 1}</option>)}
                </>)}
              </Campo>
            </>
          ) : (
            <>
              {/* Título profesional y departamento (se muestran a los estudiantes: "Ing. Jonathan Sirón") */}
              <Campo etiqueta="Título profesional" opcional htmlFor="u-titulo" ayuda="Abreviado: Ing., Lic., MSc., Dr.">
                {texto('titulo', { maxLength: 20, list: 'titulos', placeholder: 'Ej. Ing.' })}
                <datalist id="titulos">{['Ing.', 'Lic.', 'MSc.', 'Dr.', 'Dra.', 'Prof.'].map((t) => <option key={t} value={t} />)}</datalist>
              </Campo>
              <Campo etiqueta="Departamento" opcional htmlFor="u-departamento">
                {texto('departamento', { maxLength: 100, placeholder: 'Ej. Departamento de Matemática' })}
              </Campo>
              <Campo etiqueta="Especialidad / Áreas de Conocimiento" htmlFor="u-especialidad" error={errores.especialidad}>
                {texto('especialidad', { maxLength: 100, list: 'especialidades', placeholder: 'Seleccionar o escribir…' })}
                <datalist id="especialidades">{ESPECIALIDADES.map((e) => <option key={e} value={e} />)}</datalist>
              </Campo>
              <div className="sm:col-span-2">
                <Campo etiqueta="Asignaturas que imparte" error={errores.asignaturas}>
                  <div className="flex flex-wrap gap-2">
                    {cat.datos?.asignaturas.map((a) => {
                      const sel = f.asignaturas.includes(a.id_asignatura);
                      return (
                        <button key={a.id_asignatura} type="button"
                          onClick={() => set('asignaturas', sel ? f.asignaturas.filter((x) => x !== a.id_asignatura) : [...f.asignaturas, a.id_asignatura])}
                          className={`rounded-full border px-3 py-1 text-sm ${sel ? 'border-primario bg-primario-suave text-primario-oscuro' : 'border-borde hover:bg-fondo'}`}>
                          {a.nombre}
                        </button>
                      );
                    })}
                  </div>
                </Campo>
              </div>
              <div className="sm:col-span-2">
                <Campo etiqueta="Biografía" opcional htmlFor="u-biografia" derecha={`${f.biografia.length}/500`}>
                  <textarea id="u-biografia" rows={2} maxLength={500} className={`${claseInput} resize-none bg-fondo`} value={f.biografia} onChange={(e) => set('biografia', e.target.value)} />
                </Campo>
              </div>
            </>
          )}
        </div>
      </div>

      {seccion(<KeyRound size={16} />, 'Credenciales de Acceso')}
      <Campo etiqueta={u ? 'Nueva contraseña' : 'Contraseña Inicial *'} opcional={!!u} htmlFor="u-contrasena" error={errores.contrasena}
        ayuda={u ? 'Déjala vacía para no cambiarla.' : 'El usuario deberá cambiar la contraseña en su primer inicio de sesión.'}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Lock size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" />
            <input id="u-contrasena" type={verClave ? 'text' : 'password'} autoComplete="new-password" maxLength={72}
              className={`${claseInput} bg-fondo px-9`} value={f.contrasena} aria-invalid={!!errores.contrasena}
              onChange={(e) => set('contrasena', e.target.value)} />
            <button type="button" onClick={() => setVerClave(!verClave)} className="absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave"
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{verClave ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          <Boton type="button" variante="secundario" onClick={() => { set('contrasena', generarContrasena()); setVerClave(true); }}>
            <RefreshCw size={15} /> Generar
          </Boton>
        </div>
      </Campo>

      {error && <div className="mt-4"><Alerta>{error}</Alerta></div>}
    </Modal>
  );
}
