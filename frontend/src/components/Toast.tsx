import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface Aviso { id: number; texto: string; tipo: 'exito' | 'error' }
const ToastContext = createContext<(texto: string, tipo?: 'exito' | 'error') => void>(() => {});

/** Avisos flotantes de confirmación. Uso: const avisar = useToast(); avisar('Solicitud enviada'); */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: 'exito' | 'error' = 'exito') => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={avisar}>
      {children}
      <div className="fixed right-6 bottom-6 z-[60] flex flex-col gap-2">
        {avisos.map((a) => (
          <div key={a.id} role="status"
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${a.tipo === 'exito' ? 'bg-exito' : 'bg-peligro'}`}>
            {a.tipo === 'exito' ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {a.texto}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
