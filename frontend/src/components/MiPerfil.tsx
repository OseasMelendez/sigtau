import { useRef, useState } from 'react';
import { Camera, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { perfil } from '../services';
import { mensajeError } from '../lib/hooks';
import { Alerta, Boton, Campo, Modal, claseInput } from './ui';
import { useToast } from './Toast';
import { EXT_FOTO, Iniciales, refrescarFotos, validarFoto } from './Layout';

/**
 * "Mi perfil" (no está en el Figma): se abre con clic en el avatar o el nombre del menú lateral.
 * Foto de perfil, datos de la cuenta (solo lectura) y cambio de contraseña.
 */
export function MiPerfil({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { usuario, actualizarUsuario } = useAuth();
  const avisar = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [c, setC] = useState({ actual: '', nueva: '', confirmar: '' });
  const [ver, setVer] = useState(false);
  const [errores, setErrores] = useState<Partial<typeof c>>({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  if (!usuario) return null;

  const cerrar = () => { setC({ actual: '', nueva: '', confirmar: '' }); setErrores({}); setError(''); onCerrar(); };

  const subirFoto = async (a?: File) => {
    if (!a) return;
    const err = validarFoto(a);
    if (err) return avisar(err, 'error');
    setSubiendo(true);
    try {
      await perfil.subirFoto(a);
      refrescarFotos();
      avisar('Foto de perfil actualizada.');
    } catch (e) {
      avisar(mensajeError(e), 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const cambiar = async () => {
    const e: Partial<typeof c> = {};
    if (!c.actual) e.actual = 'Escribe tu contraseña actual';
    if (c.nueva.length < 8) e.nueva = 'La nueva contraseña debe tener al menos 8 caracteres';
    else if (c.nueva === c.actual) e.nueva = 'La nueva contraseña debe ser diferente de la actual';
    if (c.confirmar !== c.nueva) e.confirmar = 'Las contraseñas no coinciden';
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    setError('');
    try {
      await perfil.cambiarContrasena(c.actual, c.nueva);
      actualizarUsuario({ debe_cambiar_contrasena: false });
      setC({ actual: '', nueva: '', confirmar: '' });
      avisar('Contraseña actualizada.');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const clave = (k: keyof typeof c, etiqueta: string, autoComplete: string) => (
    <Campo etiqueta={etiqueta} htmlFor={`p-${k}`} error={errores[k]}>
      <input id={`p-${k}`} type={ver ? 'text' : 'password'} maxLength={72} autoComplete={autoComplete}
        className={`${claseInput} !py-2`} value={c[k]} aria-invalid={!!errores[k]}
        onChange={(e) => setC({ ...c, [k]: e.target.value })} />
    </Campo>
  );

  const datos: [string, string][] = [
    ['Usuario', usuario.nombre_usuario],
    ['Correo', usuario.correo],
    ['Rol', usuario.rol],
    ...(usuario.estudiante ? [['Carrera', usuario.estudiante.carrera] as [string, string]] : []),
    ...(usuario.estudiante?.ciclo ? [['Ciclo', String(usuario.estudiante.ciclo)] as [string, string]] : []),
    ...(usuario.tutor ? [['Especialidad', usuario.tutor.especialidad] as [string, string]] : []),
    ...(usuario.tutor?.asignaturas.length ? [['Asignaturas', usuario.tutor.asignaturas.join(', ')] as [string, string]] : []),
  ];

  return (
    <Modal abierto={abierto} titulo="Mi perfil" onCerrar={cerrar} ancho="max-w-md"
      claseCabecera="bg-fondo-tutor !py-3.5 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-primario-oscuro">
      {usuario.debe_cambiar_contrasena && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <ShieldAlert size={16} className="mt-px shrink-0" />
          <p>Estás usando la contraseña inicial que te asignó el coordinador. Por seguridad, cámbiala abajo.</p>
        </div>
      )}

      {/* Foto y nombre */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo} title="Cambiar foto de perfil"
          className="group relative shrink-0 rounded-full disabled:opacity-60">
          <Iniciales id={usuario.id_usuario} nombre={usuario.nombre_completo} className="size-20 text-2xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={20} />
          </span>
        </button>
        <div className="min-w-0">
          <p className="text-lg font-medium">{usuario.nombre_completo}</p>
          <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primario hover:underline disabled:opacity-60">
            <Camera size={13} /> {subiendo ? 'Subiendo…' : 'Cambiar foto'}
          </button>
          <p className="text-[11px] text-texto-suave">PNG, JPG o WEBP, máx. 2 MB</p>
        </div>
        <input ref={entrada} type="file" accept={EXT_FOTO} className="hidden"
          onChange={(e) => { subirFoto(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      {/* Datos de la cuenta (solo lectura; los cambia el coordinador) */}
      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-fondo-tutor p-3.5 text-xs">
        {datos.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-texto-suave">{k}</dt>
            <dd className="min-w-0 truncate font-medium" title={v}>{v}</dd>
          </div>
        ))}
      </dl>

      {/* Cambiar contraseña */}
      <div className="mt-5 border-t border-borde pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium"><KeyRound size={15} className="text-primario" /> Cambiar contraseña</p>
          <button type="button" onClick={() => setVer(!ver)} className="flex items-center gap-1 text-[11px] text-texto-suave hover:text-texto">
            {ver ? <EyeOff size={13} /> : <Eye size={13} />} {ver ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <div className="flex flex-col gap-3 [&_label]:text-xs [&_label]:font-medium">
          {clave('actual', 'Contraseña actual', 'current-password')}
          {clave('nueva', 'Nueva contraseña', 'new-password')}
          {clave('confirmar', 'Confirmar nueva contraseña', 'new-password')}
          {error && <Alerta>{error}</Alerta>}
          <div className="flex justify-end">
            <Boton cargando={guardando} className="!rounded-md !py-1.5 text-xs font-medium" onClick={cambiar}>Actualizar contraseña</Boton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
