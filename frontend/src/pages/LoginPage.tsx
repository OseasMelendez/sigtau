import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, Lock, Mail, ShieldCheck } from 'lucide-react';
import { INICIO_POR_ROL, useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

/** 8.2.1 Inicio de sesión (Figma: "Login", igual para los tres roles). RF-01 */
export function LoginPage() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ usuario: '', contrasena: '' });
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.usuario.trim() || !form.contrasena) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }
    setEnviando(true);
    try {
      const u = await login(form.usuario, form.contrasena);
      navigate(INICIO_POR_ROL[u.rol], { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  };

  const input =
    'w-full rounded-lg border border-borde bg-white py-2.5 pr-3 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-login focus:ring-2 focus:ring-login/20';

  return (
    <div className="grid min-h-screen bg-white md:grid-cols-2">
      <section className="hidden flex-col items-center justify-center bg-gradient-to-b from-login to-login-oscuro px-10 text-center text-white md:flex">
        <span className="mb-6 flex size-24 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
          <GraduationCap size={52} />
        </span>
        <h1 className="text-5xl font-bold tracking-tight">SIGTAU</h1>
        <p className="mt-6 max-w-sm text-lg text-white/85">
          Sistema Integral de Gestión de Tutorías Académicas Universitarias
        </p>
      </section>

      <section className="flex items-center justify-center px-6">
        <form onSubmit={enviar} noValidate className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-login">Iniciar Sesión</h2>
          <p className="mt-1 mb-8 text-sm text-texto-suave">Ingresa tus credenciales institucionales</p>

          <label htmlFor="usuario" className="mb-1.5 block text-sm font-semibold">Usuario o correo institucional</label>
          <div className="relative mb-5">
            <Mail size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" />
            <input
              id="usuario" autoComplete="username" autoFocus className={input} placeholder="usuario@ues.edu.sv"
              value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })}
            />
          </div>

          <label htmlFor="contrasena" className="mb-1.5 block text-sm font-semibold">Contraseña</label>
          <div className="relative mb-4">
            <Lock size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" />
            <input
              id="contrasena" type={ver ? 'text' : 'password'} autoComplete="current-password" className={`${input} pr-10`}
              placeholder="••••••••" value={form.contrasena}
              onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
            />
            <button type="button" onClick={() => setVer(!ver)} className="absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave"
              aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {ver ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro">{error}</p>
          )}

          <button type="submit" disabled={enviando}
            className="mt-2 w-full rounded-lg bg-login py-3 text-sm font-semibold text-white hover:bg-login-oscuro disabled:opacity-60">
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-texto-suave">
            <ShieldCheck size={14} /> Acceso seguro y encriptado
          </p>
        </form>
      </section>
    </div>
  );
}
