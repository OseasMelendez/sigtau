/** Marcador para las pantallas que faltan. Reemplázalo por la pantalla real. */
export function EnConstruccion({ titulo, figma }: { titulo: string; figma: string }) {
  return (
    <div>
      <h1 className="text-3xl font-bold">{titulo}</h1>
      <p className="mt-2 text-texto-suave">Pantalla pendiente. Diseño en Figma: nodo {figma}.</p>
    </div>
  );
}
