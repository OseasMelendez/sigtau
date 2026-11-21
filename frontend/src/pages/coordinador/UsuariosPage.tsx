import { useEffect, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { usuarios } from '../../services';
import { mensajeError, useCarga } from '../../lib/hooks';
import { fechaHora } from '../../lib/fechas';
import { Alerta, Boton, Cargando, Encabezado, Vacio, claseInput } from '../../components/ui';
import { Iniciales } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import { ModalUsuario } from './ModalUsuario';
import type { RolUsuario, UsuarioAdmin } from '../../types';

const POR_PAGINA = 8;
const COLOR_ROL: Record<RolUsuario, string> = {
  Estudiante: 'bg-primario-suave text-primario-oscuro',
  Tutor: 'bg-[#0b4f8a] text-white',
  Coordinador: 'bg-slate-200 text-slate-700',
};

/** 8.2.10 Gestión de usuarios (Figma 91:5). RF-12 */
export function UsuariosPage() {
  const { usuario: yo } = useAuth();
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState<RolUsuario | ''>('');
  const [activo, setActivo] = useState<'' | 'true' | 'false'>('');
  const [pagina, setPagina] = useState(1);
  const [modal, setModal] = useState<UsuarioAdmin | 'nuevo' | null>(null);
  const avisar = useToast();

  // Búsqueda con retardo para no consultar en cada tecla
  useEffect(() => {
    const id = setTimeout(() => { setBusqueda(q); setPagina(1); }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const { datos, cargando, error, recargar, setDatos } = useCarga(
    () => usuarios.listar({ q: busqueda, rol, activo: activo === '' ? '' : activo === 'true' }),
    [busqueda, rol, activo],
  );

  const cambiarActivo = async (u: UsuarioAdmin) => {
    const nuevo = !u.activo;
    setDatos((l) => l?.map((x) => (x.id_usuario === u.id_usuario ? { ...x, activo: nuevo } : x)) ?? null);
    try {
      await usuarios.cambiarActivo(u.id_usuario, nuevo);
      avisar(`${u.nombre_completo} ${nuevo ? 'activado' : 'desactivado'}.`);
    } catch (e) {
      avisar(mensajeError(e), 'error');
      recargar();
    }
  };

  const lista = datos ?? [];
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const visibles = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const select = `${claseInput} !w-auto !py-2`;

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Usuarios del Sistema" subtitulo="Administre estudiantes, tutores y personal académico.">
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" />
            <input className={`${claseInput} !w-64 !py-2 pl-9`} placeholder="Buscar por nombre, usuario o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Boton onClick={() => setModal('nuevo')}><Plus size={16} /> Crear Usuario</Boton>
        </div>
      </Encabezado>

      <div className="mb-4 flex gap-3">
        <select className={select} value={rol} onChange={(e) => { setRol(e.target.value as RolUsuario | ''); setPagina(1); }} aria-label="Rol">
          <option value="">Todos los roles</option><option>Estudiante</option><option>Tutor</option><option>Coordinador</option>
        </select>
        <select className={select} value={activo} onChange={(e) => { setActivo(e.target.value as '' | 'true' | 'false'); setPagina(1); }} aria-label="Estado">
          <option value="">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option>
        </select>
      </div>

      {error && <div className="mb-4"><Alerta>{error}</Alerta></div>}
      {cargando && !datos ? <Cargando /> : lista.length === 0 ? <Vacio texto="No se encontraron usuarios." /> : (
        <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-fondo text-left text-texto-suave">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Correo</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Último acceso</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id_usuario} className={`border-t border-borde ${u.activo ? '' : 'bg-slate-50 text-texto-suave'}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Iniciales id={u.id_usuario} nombre={u.nombre_completo} className={`size-9 text-xs ${u.activo ? '' : 'grayscale'}`} />
                      <div>
                        <p className={`font-medium ${u.activo ? '' : 'line-through'}`}>{u.nombre_completo}</p>
                        <p className="text-xs text-texto-suave">{u.nombre_usuario} · {u.identificacion}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{u.correo}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_ROL[u.rol]}`}>{u.rol}</span></td>
                  <td className="px-5 py-3 text-xs">{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca'}</td>
                  <td className="px-5 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="peer sr-only" checked={u.activo} onChange={() => cambiarActivo(u)}
                        disabled={u.id_usuario === yo?.id_usuario} aria-label={`Activar o desactivar a ${u.nombre_completo}`} />
                      <span className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-primario peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                      <span className="text-xs">{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </label>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.rol !== 'Coordinador' && (
                      <button onClick={() => setModal(u)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-primario hover:bg-primario-suave/60">
                        <Pencil size={15} /> Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-borde px-5 py-3 text-xs text-texto-suave">
            <span>Mostrando {(pagina - 1) * POR_PAGINA + 1} a {Math.min(pagina * POR_PAGINA, lista.length)} de {lista.length} usuarios</span>
            <div className="flex gap-1">
              {Array.from({ length: paginas }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPagina(p)}
                  className={`size-7 rounded-full text-sm ${p === pagina ? 'bg-primario text-white' : 'hover:bg-fondo'}`}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <ModalUsuario usuario={modal === 'nuevo' ? null : modal} onCerrar={() => setModal(null)}
          onListo={() => { setModal(null); recargar(); }} />
      )}
    </div>
  );
}
