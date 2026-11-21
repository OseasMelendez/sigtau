/** Nombre del tutor con su título profesional: "Ing. Jonathan Sirón" (o solo el nombre si no tiene). */
export const nombreTutor = (t: { nombre_completo: string; titulo?: string | null }) =>
  t.titulo ? `${t.titulo} ${t.nombre_completo}` : t.nombre_completo;
