import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';

/**
 * Carga datos de la API al montar el componente.
 *   const { datos, cargando, error, recargar } = useCarga(() => solicitudes.mias(), []);
 */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setDatos(await fn());
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, cargando, error, recargar, setDatos };
}

export function mensajeError(e: unknown) {
  return e instanceof ApiError ? e.message : 'Ocurrió un error inesperado.';
}
