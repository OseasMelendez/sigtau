import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RutaProtegida } from './auth/RutaProtegida';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { EnConstruccion } from './pages/EnConstruccion';

/**
 * Rutas por rol. Los nodos de Figma de cada pantalla están en CLAUDE.md.
 * Al terminar una pantalla, reemplaza su <EnConstruccion /> por el componente real.
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RutaProtegida roles={['Estudiante']} />}>
            <Route path="/estudiante" element={<Layout />}>
              <Route index element={<EnConstruccion titulo="Vista de Inicio" figma="1:5" />} />
              <Route path="nueva-solicitud" element={<EnConstruccion titulo="Nueva Solicitud" figma="1:179" />} />
              <Route path="solicitudes" element={<EnConstruccion titulo="Mis Solicitudes" figma="8:2" />} />
              <Route path="historial" element={<EnConstruccion titulo="Historial de Tutorías" figma="3:333" />} />
            </Route>
          </Route>

          <Route element={<RutaProtegida roles={['Tutor']} />}>
            <Route path="/tutor" element={<Layout />}>
              <Route index element={<EnConstruccion titulo="Mis Solicitudes Pendientes" figma="25:58" />} />
              <Route path="horarios" element={<EnConstruccion titulo="Gestionar Horarios" figma="82:804" />} />
              <Route path="tutorias" element={<EnConstruccion titulo="Mis Tutorías" figma="26:330" />} />
            </Route>
          </Route>

          <Route element={<RutaProtegida roles={['Coordinador']} />}>
            <Route path="/coordinador" element={<Layout />}>
              <Route index element={<EnConstruccion titulo="Inicio / Métricas" figma="99:695" />} />
              <Route path="usuarios" element={<EnConstruccion titulo="Usuarios del Sistema" figma="91:5" />} />
              <Route path="reportes" element={<EnConstruccion titulo="Generar Reporte" figma="96:366" />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
