import { useState } from 'react';
import { GraduationCap, UserCog } from 'lucide-react';
import { catalogos, usuarios, type DatosUsuario } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { Alerta, Boton, Campo, Modal, claseInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import type { UsuarioAdmin } from '../../types';

type Rol = 'Estudiante' | 'Tutor';
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registrar / editar estudiante o tutor (Figma 102:1093, 128:285, 162:782, 162:586). RF-12
 * Al crear, el backend cifra la contraseña con bcrypt y marca debe_cambiar_contrasena.
 */
export function ModalUsuario({ usuario: u, onCerrar, onListo }: { usuario: UsuarioAdmin | null; onCerrar: () => void; onListo: () => void }) {
  const cat = useCarga(() => catalogos.todos(), []);
  const avisar = useToast();
  const [rol, setRol] = useState<Rol>((u?.rol as Rol) ?? 'Estudiante');
  const [f, setF] = useState({
    nombre_completo: u?.nombre_completo ?? '',
    nombre_usuario: u?.nombre_usuario ?? '',
    identificacion: u?.identificacion ?? '',
    correo: u?.correo ?? '',
    contrasena: '',
    id_carrera: u?.estudiante?.id_carrera ?? 0,
    ciclo: u?.estudiante?.ciclo ?? '',
    id_facultad: u?.tutor?.id_facultad ?? 0,
    especialidad: u?.tutor?.especialidad ?? '',
    telefono_contacto: u?.tutor?.telefono_contacto ?? '',
    biografia: u?.tutor?.biografia ?? '',
    asignaturas: u?.tutor?.asignaturas.map((a) => a.id_asignatura) ?? ([] as number[]),
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  const validar = () => {
    const e: Record<string, string> = {};
    if (!f.nombre_completo.trim()) e.nombre_completo = 'El nombre es obligatorio';
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(f.nombre_usuario)) e.nombre_usuario = 'De 3 a 30 caracteres: letras, números, punto, guion';
    if (!f.identificacion.trim()) e.identificacion = rol === 'Estudiante' ? 'El carnet es obligatorio' : 'La identificación es obligatoria';
    if (!CORREO.test(f.correo)) e.correo = 'Ingresa un correo válido';
    if (!u && f.contrasena.length < 8) e.contrasena = 'Mínimo 8 caracteres';
    if (u && f.contrasena && f.contrasena.length < 8) e.contrasena = 'Mínimo 8 caracteres';
    if (rol === 'Estudiante') {
      if (!f.id_carrera) e.id_carrera = 'Selecciona la carrera';
      if (f.ciclo !== '' && (Number(f.ciclo) < 1 || Number(f.ciclo) > 12)) e.ciclo = 'El ciclo va de 1 a 12';
    } else {
      if (!f.id_facultad) e.id_facultad = 'Selecciona la facultad';
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
        ? { estudiante: { id_carrera: Number(f.id_carrera), ciclo: f.ciclo === '' ? null : Number(f.ciclo) } }
        : { tutor: {
            id_facultad: Number(f.id_facultad), especialidad: f.especialidad.trim(),
            telefono_contacto: f.telefono_contacto.trim() || null, biografia: f.biografia.trim() || null, asignaturas: f.asignaturas,
          } }),
    };
    setEnviando(true);
    setError('');
    try {
      if (u) await usuarios.editar(u.id_usuario, datos);
      else await usuarios.crear(datos);
      avisar(u ? 'Usuario actualizado.' : `${rol} registrado correctamente.`);
      onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const input = (k: keyof typeof f, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={`u-${k}`} className={claseInput} value={f[k] as string} aria-invalid={!!errores[k]}
      onChange={(e) => set(k, e.target.value)} {...props} />
  );

  return (
    <Modal abierto ancho="max-w-2xl" onCerrar={onCerrar}
      titulo={u ? `Editar ${rol.toLowerCase()}` : `Registrar nuevo ${rol.toLowerCase()}`}
      icono={rol === 'Estudiante' ? <GraduationCap size={20} className="text-primario" /> : <UserCog size={20} className="text-primario" />}
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton cargando={enviando} onClick={guardar}>{u ? 'Guardar cambios' : 'Registrar'}</Boton></>}>

      {!u && (
        <div className="mb-5 inline-flex rounded-xl border border-borde p-1">
          {(['Estudiante', 'Tutor'] as Rol[]).map((r) => (
            <button key={r} onClick={() => { setRol(r); setErrores({}); }}
              className={`rounded-lg px-5 py-1.5 text-sm font-medium ${rol === r ? 'bg-primario text-white' : 'text-texto-suave'}`}>{r}</button>
          ))}
        </div>
      )}

      <p className="mb-3 text-[11px] font-semibold tracking-wide text-texto-suave uppercase">Datos de la cuenta</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Campo etiqueta="Nombre completo" htmlFor="u-nombre_completo" error={errores.nombre_completo}>{input('nombre_completo', { maxLength: 100 })}</Campo></div>
        <Campo etiqueta={rol === 'Estudiante' ? 'Carnet' : 'Identificación'} htmlFor="u-identificacion" error={errores.identificacion}>
          {input('identificacion', { maxLength: 20, placeholder: rol === 'Estudiante' ? 'VM24009' : 'DOC-0106' })}
        </Campo>
        <Campo etiqueta="Nombre de usuario" htmlFor="u-nombre_usuario" error={errores.nombre_usuario}>{input('nombre_usuario', { maxLength: 30 })}</Campo>
        <Campo etiqueta="Correo institucional" htmlFor="u-correo" error={errores.correo}>{input('correo', { type: 'email', maxLength: 100, placeholder: 'usuario@ues.edu.sv' })}</Campo>
        <Campo etiqueta={u ? 'Nueva contraseña' : 'Contraseña temporal'} opcional={!!u} htmlFor="u-contrasena" error={errores.contrasena}
          ayuda={u ? 'Déjala vacía para no cambiarla' : 'Se pedirá cambiarla en el primer inicio de sesión'}>
          {input('contrasena', { type: 'password', autoComplete: 'new-password', maxLength: 72 })}
        </Campo>
      </div>

      <p className="mt-6 mb-3 text-[11px] font-semibold tracking-wide text-texto-suave uppercase">Datos académicos</p>
      {rol === 'Estudiante' ? (
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Campo etiqueta="Carrera" htmlFor="u-carrera" error={errores.id_carrera}>
            <select id="u-carrera" className={claseInput} value={f.id_carrera} onChange={(e) => set('id_carrera', Number(e.target.value))} aria-invalid={!!errores.id_carrera}>
              <option value={0}>Selecciona…</option>
              {cat.datos?.carreras.map((c) => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Ciclo" opcional htmlFor="u-ciclo" error={errores.ciclo}>{input('ciclo', { type: 'number', min: 1, max: 12 })}</Campo>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Facultad" htmlFor="u-facultad" error={errores.id_facultad}>
            <select id="u-facultad" className={claseInput} value={f.id_facultad} onChange={(e) => set('id_facultad', Number(e.target.value))} aria-invalid={!!errores.id_facultad}>
              <option value={0}>Selecciona…</option>
              {cat.datos?.facultades.map((x) => <option key={x.id_facultad} value={x.id_facultad}>{x.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Especialidad" htmlFor="u-especialidad" error={errores.especialidad}>{input('especialidad', { maxLength: 100, placeholder: 'Matemática' })}</Campo>
          <Campo etiqueta="Teléfono de contacto" opcional htmlFor="u-telefono_contacto">{input('telefono_contacto', { maxLength: 15, placeholder: '2440-1000' })}</Campo>
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
              <textarea id="u-biografia" rows={3} maxLength={500} className={`${claseInput} resize-none`} value={f.biografia} onChange={(e) => set('biografia', e.target.value)} />
            </Campo>
          </div>
        </div>
      )}
      {error && <div className="mt-4"><Alerta>{error}</Alerta></div>}
    </Modal>
  );
}
