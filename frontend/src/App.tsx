import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RutaProtegida } from './auth/RutaProtegida';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { LoginPage } from './pages/LoginPage';
import { DetalleTutoriaPage } from './pages/DetalleTutoriaPage';
import { InicioEstudiantePage } from './pages/estudiante/InicioEstudiantePage';
import { NuevaSolicitudPage } from './pages/estudiante/NuevaSolicitudPage';
import { DetalleTutorPage } from './pages/estudiante/DetalleTutorPage';
import { MisSolicitudesPage } from './pages/estudiante/MisSolicitudesPage';
import { HistorialPage } from './pages/estudiante/HistorialPage';
import { SolicitudesPendientesPage } from './pages/tutor/SolicitudesPendientesPage';
import { MisTutoriasPage } from './pages/tutor/MisTutoriasPage';
import { GestionarHorariosPage } from './pages/tutor/GestionarHorariosPage';
import { ProgramacionTutoriasPage } from './pages/tutor/ProgramacionTutoriasPage';
import { InicioCoordinadorPage } from './pages/coordinador/InicioCoordinadorPage';
import { UsuariosPage } from './pages/coordinador/UsuariosPage';
import { GenerarReportePage } from './pages/coordinador/GenerarReportePage';

/** Rutas por rol. Los nodos de Figma de cada pantalla están en CLAUDE.md. */
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RutaProtegida roles={['Estudiante']} />}>
              <Route path="/estudiante" element={<Layout />}>
                <Route index element={<InicioEstudiantePage />} />
                <Route path="nueva-solicitud" element={<NuevaSolicitudPage />} />
                <Route path="nueva-solicitud/tutor/:id" element={<DetalleTutorPage />} />
                <Route path="solicitudes" element={<MisSolicitudesPage />} />
                <Route path="tutorias/:id" element={<DetalleTutoriaPage />} />
                <Route path="historial" element={<HistorialPage />} />
              </Route>
            </Route>

            <Route element={<RutaProtegida roles={['Tutor']} />}>
              <Route path="/tutor" element={<Layout />}>
                <Route index element={<SolicitudesPendientesPage />} />
                <Route path="programacion" element={<ProgramacionTutoriasPage />} />
                <Route path="horarios" element={<GestionarHorariosPage />} />
                <Route path="tutorias" element={<MisTutoriasPage />} />
                <Route path="tutorias/:id" element={<DetalleTutoriaPage />} />
              </Route>
            </Route>

            <Route element={<RutaProtegida roles={['Coordinador']} />}>
              <Route path="/coordinador" element={<Layout />}>
                <Route index element={<InicioCoordinadorPage />} />
                <Route path="usuarios" element={<UsuariosPage />} />
                <Route path="reportes" element={<GenerarReportePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
