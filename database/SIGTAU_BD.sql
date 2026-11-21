-- =====================================================================
--  SIGTAU - Sistema Integral de Gestión de Tutorías Académicas Universitarias
--  Script de creación de la base de datos (PostgreSQL 16 o superior)
--  Avance de proyecto 10 % - Análisis y Diseño de Software II, Ciclo II/2026
--
--  Basado en el Manual del Analista (Rev. 1.0) y el Manual de Usuario del Ciclo I.
--
--  Uso (pgAdmin 4):
--    1. Crear la base de datos: clic derecho en "Databases" > Create > Database...
--       Nombre: sigtau  > Save.
--    2. Seleccionar la base "sigtau" > menú Tools > Query Tool.
--    3. Abrir este archivo (ícono de carpeta) y ejecutarlo completo (F5).
--    4. Luego abrir y ejecutar SIGTAU_Consultas_Prueba.sql.
--
--  El script se puede volver a ejecutar: borra y recrea el esquema "sigtau".
-- =====================================================================

-- Extensiones incluidas en la instalación estándar de PostgreSQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- bcrypt para los datos de prueba (RNF-02)
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- evita franjas horarias solapadas (RF-05)

DROP SCHEMA IF EXISTS sigtau CASCADE;
CREATE SCHEMA sigtau;
SET search_path TO sigtau, public;

-- Las próximas conexiones a esta base usarán el esquema sigtau por defecto
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO sigtau, public', current_database());
END $$;

-- =====================================================================
--  1. CATÁLOGOS ACADÉMICOS
-- =====================================================================

CREATE TABLE facultad (
  id_facultad  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE carrera (
  id_carrera   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_facultad  INT          NOT NULL REFERENCES facultad (id_facultad),
  codigo       VARCHAR(10)  NOT NULL UNIQUE,
  nombre       VARCHAR(100) NOT NULL
);

CREATE TABLE asignatura (
  id_asignatura INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo        VARCHAR(10)  NOT NULL UNIQUE,
  nombre        VARCHAR(100) NOT NULL,
  area          VARCHAR(60)  NULL,                  -- área académica, p. ej. "Matemáticas" (Figma Historial)
  activa        BOOLEAN      NOT NULL DEFAULT TRUE
);

-- =====================================================================
--  2. USUARIOS Y SESIONES  (Módulos 1 y 8)
-- =====================================================================

-- Datos básicos y de acceso de todos los usuarios (Manual del Analista, 2.4 y 3.33)
CREATE TABLE usuario (
  id_usuario              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_usuario          VARCHAR(30)  NOT NULL UNIQUE,        -- RF-01
  nombre_completo         VARCHAR(100) NOT NULL,
  identificacion          VARCHAR(20)  NOT NULL UNIQUE,        -- carnet o documento
  correo                  VARCHAR(100) NOT NULL UNIQUE CHECK (correo LIKE '%_@_%._%'),
  contrasena_hash         CHAR(60)     NOT NULL,               -- bcrypt, factor >= 10 (RNF-02)
  rol                     VARCHAR(12)  NOT NULL CHECK (rol IN ('Estudiante', 'Tutor', 'Coordinador')),
  activo                  BOOLEAN      NOT NULL DEFAULT TRUE,  -- RF-12: desactivar, no eliminar
  debe_cambiar_contrasena BOOLEAN      NOT NULL DEFAULT TRUE,  -- cambio en el primer inicio de sesión
  intentos_fallidos       SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta         TIMESTAMP    NULL,                   -- bloqueo temporal por intentos fallidos
  ultimo_acceso           TIMESTAMP    NULL,
  foto                    VARCHAR(255) NULL,                   -- archivo de la foto de perfil (backend/uploads/fotos)
  fecha_registro          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Token de sesión; al cerrar sesión se registra fecha_cierre y el token deja de ser válido (RF-02)
CREATE TABLE sesion (
  id_sesion        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario       INT       NOT NULL REFERENCES usuario (id_usuario),
  token_hash       CHAR(64)  NOT NULL UNIQUE,              -- SHA-256 del token, nunca el token
  fecha_inicio     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion TIMESTAMP NOT NULL,
  fecha_cierre     TIMESTAMP NULL,
  CHECK (fecha_expiracion > fecha_inicio)
);

-- Regla 3.4: no se permiten sesiones simultáneas con la misma cuenta
CREATE UNIQUE INDEX uq_sesion_activa ON sesion (id_usuario) WHERE fecha_cierre IS NULL;

CREATE TABLE estudiante (
  id_usuario  INT      PRIMARY KEY REFERENCES usuario (id_usuario),
  id_carrera  INT      NOT NULL REFERENCES carrera (id_carrera),
  ciclo       SMALLINT NULL CHECK (ciclo BETWEEN 1 AND 12)
);

CREATE TABLE tutor (
  id_usuario         INT          PRIMARY KEY REFERENCES usuario (id_usuario),
  id_facultad        INT          NOT NULL REFERENCES facultad (id_facultad),
  titulo             VARCHAR(20)  NULL,             -- título profesional abreviado: "Ing.", "Lic.", "MSc."...
  departamento       VARCHAR(100) NULL,             -- departamento académico (Figma Historial)
  especialidad       VARCHAR(100) NOT NULL,
  telefono_contacto  VARCHAR(15)  NULL,
  biografia          VARCHAR(500) NULL
);

-- Asignaturas que imparte cada tutor (relación N:M)
CREATE TABLE tutor_asignatura (
  id_tutor      INT NOT NULL REFERENCES tutor (id_usuario),
  id_asignatura INT NOT NULL REFERENCES asignatura (id_asignatura),
  PRIMARY KEY (id_tutor, id_asignatura)
);

-- =====================================================================
--  3. HORARIOS DEL TUTOR  (Módulo 3)
-- =====================================================================

CREATE TABLE horario_tutor (
  id_horario  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_tutor    INT         NOT NULL REFERENCES tutor (id_usuario),
  fecha       DATE        NOT NULL,
  hora_inicio TIME        NOT NULL,
  hora_fin    TIME        NOT NULL,
  estado      VARCHAR(10) NOT NULL DEFAULT 'Disponible' CHECK (estado IN ('Disponible', 'Ocupado')),
  CONSTRAINT chk_horario_fin_posterior CHECK (hora_fin > hora_inicio),
  -- Regla 3.13: un tutor no puede registrar dos franjas que se solapen
  CONSTRAINT exc_horario_sin_solapamiento EXCLUDE USING gist (
    id_tutor WITH =,
    tsrange(fecha + hora_inicio, fecha + hora_fin) WITH &&
  )
);

-- =====================================================================
--  4. SOLICITUDES, TUTORÍAS Y REPROGRAMACIONES  (Módulos 2 y 4)
-- =====================================================================

-- El tutor se obtiene a través de id_horario (por eso no se repite aquí: 3FN)
CREATE TABLE solicitud_tutoria (
  id_solicitud           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_estudiante          INT          NOT NULL REFERENCES estudiante (id_usuario),
  id_asignatura          INT          NOT NULL REFERENCES asignatura (id_asignatura),
  id_horario             INT          NOT NULL REFERENCES horario_tutor (id_horario), -- RF-07
  descripcion_dificultad VARCHAR(500) NOT NULL CHECK (length(trim(descripcion_dificultad)) > 0),
  documento_apoyo        VARCHAR(255) NULL,           -- ruta del PDF, DOCX o imagen adjunto
  estado                 VARCHAR(10)  NOT NULL DEFAULT 'Pendiente'
                         CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada')),
  motivo_rechazo         VARCHAR(255) NULL,            -- opcional (3.8)
  fecha_solicitud        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta        TIMESTAMP    NULL,
  CONSTRAINT chk_solicitud_respuesta CHECK ((estado = 'Pendiente') = (fecha_respuesta IS NULL))
);

-- La tutoría nace al aprobar la solicitud (RF-04 / RF-07): relación 1:1 con la solicitud
CREATE TABLE tutoria (
  id_tutoria          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_solicitud        INT          NOT NULL UNIQUE REFERENCES solicitud_tutoria (id_solicitud),
  id_horario          INT          NOT NULL REFERENCES horario_tutor (id_horario), -- horario vigente
  lugar               VARCHAR(100) NULL,             -- aula u oficina (3.14)
  estado              VARCHAR(10)  NOT NULL DEFAULT 'Programada'
                      CHECK (estado IN ('Programada', 'Realizada', 'Cancelada')),       -- 3.16.2
  fecha_programacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,                    -- 3.17
  motivo_cancelacion  VARCHAR(255) NULL,
  fecha_cancelacion   TIMESTAMP    NULL,
  -- RF-13: cancelar exige motivo
  CONSTRAINT chk_tutoria_cancelacion CHECK (
    estado <> 'Cancelada' OR (motivo_cancelacion IS NOT NULL AND length(trim(motivo_cancelacion)) > 0
                              AND fecha_cancelacion IS NOT NULL)
  )
);

-- Regla 3.17: no se pueden programar dos tutorías en la misma franja
CREATE UNIQUE INDEX uq_tutoria_horario_programada ON tutoria (id_horario) WHERE estado = 'Programada';

-- RF-14: propuesta de nuevo horario que el estudiante acepta o rechaza
CREATE TABLE reprogramacion (
  id_reprogramacion    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_tutoria           INT          NOT NULL REFERENCES tutoria (id_tutoria),
  id_horario_anterior  INT          NOT NULL REFERENCES horario_tutor (id_horario),
  id_horario_propuesto INT          NOT NULL REFERENCES horario_tutor (id_horario),
  motivo               VARCHAR(255) NOT NULL CHECK (length(trim(motivo)) > 0),
  estado               VARCHAR(10)  NOT NULL DEFAULT 'Pendiente'
                       CHECK (estado IN ('Pendiente', 'Aceptada', 'Rechazada')),
  fecha_propuesta      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta      TIMESTAMP    NULL,
  CHECK (id_horario_anterior <> id_horario_propuesto),
  CHECK ((estado = 'Pendiente') = (fecha_respuesta IS NULL))
);

-- Solo una reprogramación pendiente por tutoría
CREATE UNIQUE INDEX uq_reprogramacion_pendiente ON reprogramacion (id_tutoria) WHERE estado = 'Pendiente';

-- =====================================================================
--  5. SEGUIMIENTO, NOTIFICACIONES Y REPORTES  (Módulos 5, 6 y 7)
-- =====================================================================

CREATE TABLE seguimiento (
  id_seguimiento INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_tutoria     INT        NOT NULL UNIQUE REFERENCES tutoria (id_tutoria),
  asistio        BOOLEAN    NOT NULL,
  nivel_progreso VARCHAR(8) NULL CHECK (nivel_progreso IN ('Bajo', 'Medio', 'Avanzado')),
  observaciones  TEXT       NOT NULL CHECK (length(trim(observaciones)) > 0),             -- 3.21
  fecha_registro TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Si el estudiante asistió, el nivel de progreso es obligatorio
  CONSTRAINT chk_seguimiento_nivel CHECK (NOT asistio OR nivel_progreso IS NOT NULL)
);

CREATE TABLE notificacion (
  id_notificacion INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario      INT          NOT NULL REFERENCES usuario (id_usuario),     -- destinatario
  tipo            VARCHAR(15)  NOT NULL CHECK (tipo IN ('Solicitud', 'Tutoría', 'Reprogramación',
                    'Cancelación', 'Recordatorio', 'Seguimiento', 'Usuario', 'Reporte', 'Sistema')),
  titulo          VARCHAR(100) NOT NULL,
  mensaje         VARCHAR(255) NOT NULL,
  leida           BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha_envio     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Historial de reportes generados (3.29.3): tipo, filtros y fecha
CREATE TABLE reporte (
  id_reporte       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_coordinador   INT         NOT NULL REFERENCES usuario (id_usuario),
  tipo             VARCHAR(25) NOT NULL CHECK (tipo IN ('Tutorías realizadas', 'Asistencia estudiantil',
                     'Progreso académico', 'Demanda por asignatura', 'Gestión de solicitudes')),
  fecha_desde      DATE        NOT NULL,
  fecha_hasta      DATE        NOT NULL,
  id_tutor         INT         NULL REFERENCES tutor (id_usuario),         -- filtro opcional
  id_asignatura    INT         NULL REFERENCES asignatura (id_asignatura), -- filtro opcional
  estado_filtro    VARCHAR(10) NULL CHECK (estado_filtro IN ('Programada', 'Realizada', 'Cancelada')),
  formato          VARCHAR(4)  NOT NULL CHECK (formato IN ('PDF', 'XLSX')),
  fecha_generacion TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (fecha_hasta >= fecha_desde)
);

-- Contenido de los archivos subidos (fotos de perfil y documentos de apoyo). usuario.foto y
-- solicitud_tutoria.documento_apoyo guardan el nombre; aquí van los bytes, para que no dependan
-- del disco del servidor (en Render gratis el disco se borra en cada reinicio).
CREATE TABLE archivo (
  nombre      VARCHAR(255) PRIMARY KEY,                -- p. ej. usuario-3.png, solicitud-4.pdf
  tipo        VARCHAR(100) NOT NULL,                   -- tipo MIME
  contenido   BYTEA        NOT NULL,
  fecha_subida TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de apoyo para las consultas más frecuentes
CREATE INDEX idx_solicitud_estudiante ON solicitud_tutoria (id_estudiante);
CREATE INDEX idx_solicitud_horario    ON solicitud_tutoria (id_horario);
CREATE INDEX idx_tutoria_estado       ON tutoria (estado);
CREATE INDEX idx_notificacion_usuario ON notificacion (id_usuario, leida);

-- =====================================================================
--  6. DISPARADORES: REGLAS DE NEGOCIO DEL CICLO I
-- =====================================================================

-- D1. Registros que nunca se eliminan: usuarios (RF-12), notificaciones (3.26) y reportes (3.30)
CREATE FUNCTION impedir_eliminacion() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'No se permite eliminar registros de %: %', TG_TABLE_NAME, TG_ARGV[0];
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuario_sin_eliminar BEFORE DELETE ON usuario
  FOR EACH ROW EXECUTE FUNCTION impedir_eliminacion('los usuarios solo se desactivan (RF-12)');
CREATE TRIGGER trg_notificacion_sin_eliminar BEFORE DELETE ON notificacion
  FOR EACH ROW EXECUTE FUNCTION impedir_eliminacion('solo se marcan como leídas (regla 3.26)');
CREATE TRIGGER trg_reporte_sin_eliminar BEFORE DELETE ON reporte
  FOR EACH ROW EXECUTE FUNCTION impedir_eliminacion('el historial solo se consulta (regla 3.30)');

-- D2. Validaciones al crear una solicitud (3.7.1 y Manual de Usuario, sección 5)
CREATE FUNCTION validar_solicitud() RETURNS trigger AS $$
DECLARE
  v_tutor  INT;
  v_estado VARCHAR(10);
BEGIN
  IF NEW.id_horario IS NULL THEN
    RETURN NEW;  -- la restricción NOT NULL rechaza la fila (RF-07)
  END IF;
  SELECT id_tutor, estado INTO v_tutor, v_estado FROM horario_tutor WHERE id_horario = NEW.id_horario;
  IF v_estado = 'Ocupado' THEN
    RAISE EXCEPTION 'La franja seleccionada está ocupada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tutor_asignatura
                 WHERE id_tutor = v_tutor AND id_asignatura = NEW.id_asignatura) THEN
    RAISE EXCEPTION 'El tutor de la franja no imparte la asignatura seleccionada.';
  END IF;
  IF NEW.estado = 'Pendiente' AND EXISTS (
       SELECT 1 FROM solicitud_tutoria s JOIN horario_tutor h ON h.id_horario = s.id_horario
       WHERE s.id_estudiante = NEW.id_estudiante AND s.id_asignatura = NEW.id_asignatura
         AND h.id_tutor = v_tutor AND s.estado = 'Pendiente') THEN
    RAISE EXCEPTION 'Ya existe una solicitud pendiente para el mismo tutor y asignatura.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_solicitud BEFORE INSERT ON solicitud_tutoria
  FOR EACH ROW EXECUTE FUNCTION validar_solicitud();

-- D3. Ciclo de vida de la tutoría y ocupación de franjas (RF-07, RF-13, RF-14, 3.17)
CREATE FUNCTION gestionar_tutoria() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM solicitud_tutoria
                   WHERE id_solicitud = NEW.id_solicitud AND estado = 'Aprobada'
                     AND id_horario = NEW.id_horario) THEN
      RAISE EXCEPTION 'Solo una solicitud aprobada genera una tutoría, con el horario elegido por el estudiante.';
    END IF;
    UPDATE horario_tutor SET estado = 'Ocupado' WHERE id_horario = NEW.id_horario;  -- RF-07
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.estado <> 'Programada' THEN
    RAISE EXCEPTION 'Una tutoría % no se puede modificar.', lower(OLD.estado);
  END IF;
  IF NEW.estado = 'Cancelada' THEN
    UPDATE horario_tutor SET estado = 'Disponible' WHERE id_horario = OLD.id_horario; -- RF-13
  ELSIF NEW.id_horario <> OLD.id_horario THEN                                         -- RF-14
    IF (SELECT estado FROM horario_tutor WHERE id_horario = NEW.id_horario) <> 'Disponible' THEN
      RAISE EXCEPTION 'La nueva franja no está disponible.';
    END IF;
    UPDATE horario_tutor SET estado = 'Disponible' WHERE id_horario = OLD.id_horario;
    UPDATE horario_tutor SET estado = 'Ocupado'    WHERE id_horario = NEW.id_horario;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gestionar_tutoria BEFORE INSERT OR UPDATE ON tutoria
  FOR EACH ROW EXECUTE FUNCTION gestionar_tutoria();

-- D4. Reprogramación (RF-14): validar la propuesta y aplicarla cuando el estudiante la acepta
CREATE FUNCTION gestionar_reprogramacion() RETURNS trigger AS $$
DECLARE
  v_tutoria tutoria%ROWTYPE;
BEGIN
  SELECT * INTO v_tutoria FROM tutoria WHERE id_tutoria = NEW.id_tutoria;
  IF TG_OP = 'INSERT' THEN
    IF v_tutoria.estado <> 'Programada' THEN
      RAISE EXCEPTION 'Solo se reprograma una tutoría Programada.';
    END IF;
    IF NEW.id_horario_anterior <> v_tutoria.id_horario THEN
      RAISE EXCEPTION 'El horario anterior no coincide con el horario vigente de la tutoría.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM horario_tutor a JOIN horario_tutor p ON p.id_tutor = a.id_tutor
                   WHERE a.id_horario = NEW.id_horario_anterior AND p.id_horario = NEW.id_horario_propuesto
                     AND p.estado = 'Disponible') THEN
      RAISE EXCEPTION 'La franja propuesta debe ser una franja disponible del mismo tutor.';
    END IF;
  ELSIF OLD.estado = 'Pendiente' AND NEW.estado = 'Aceptada' THEN
    UPDATE tutoria SET id_horario = NEW.id_horario_propuesto WHERE id_tutoria = NEW.id_tutoria;
  ELSIF OLD.estado <> 'Pendiente' THEN
    RAISE EXCEPTION 'Una reprogramación ya respondida no se puede modificar.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gestionar_reprogramacion BEFORE INSERT OR UPDATE ON reprogramacion
  FOR EACH ROW EXECUTE FUNCTION gestionar_reprogramacion();

-- D5. Registro de seguimiento (RF-08, 3.20.1 y 3.21)
CREATE FUNCTION registrar_seguimiento() RETURNS trigger AS $$
DECLARE
  v_estado VARCHAR(10);
  v_fecha  DATE;
BEGIN
  SELECT t.estado, h.fecha INTO v_estado, v_fecha
  FROM tutoria t JOIN horario_tutor h ON h.id_horario = t.id_horario
  WHERE t.id_tutoria = NEW.id_tutoria;
  IF v_estado <> 'Programada' THEN
    RAISE EXCEPTION 'Solo se registra seguimiento de una tutoría Programada.';
  END IF;
  IF v_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'La sesión aún no ha ocurrido (fecha %).', to_char(v_fecha, 'DD/MM/YYYY');
  END IF;
  UPDATE tutoria SET estado = 'Realizada' WHERE id_tutoria = NEW.id_tutoria;  -- RF-08
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registrar_seguimiento BEFORE INSERT ON seguimiento
  FOR EACH ROW EXECUTE FUNCTION registrar_seguimiento();

-- =====================================================================
--  7. DATOS DE PRUEBA
--  Los nombres coinciden con los prototipos del Manual de Usuario.
--  Contraseña de todas las cuentas de prueba: Sigtau2026!
--  Los estados de franjas y tutorías los calculan los disparadores.
-- =====================================================================

INSERT INTO facultad (nombre) VALUES
  ('Facultad Multidisciplinaria de Occidente');                     -- 1

INSERT INTO carrera (id_facultad, codigo, nombre) VALUES
  (1, 'IDS', 'Ingeniería en Desarrollo de Software'),               -- 1
  (1, 'IIN', 'Ingeniería Industrial');                              -- 2

INSERT INTO asignatura (codigo, nombre, area) VALUES
  ('MAT115', 'Cálculo Diferencial', 'Matemáticas'),                 -- 1
  ('MAT215', 'Cálculo Integral',    'Matemáticas'),                 -- 2
  ('FIS115', 'Física I',            'Física'),                      -- 3
  ('FIS215', 'Física II',           'Física'),                      -- 4
  ('PRG115', 'Programación I',      'Programación');                -- 5

-- bcrypt con factor 10 (RNF-02). En el sistema real el hash lo genera el backend.
INSERT INTO usuario (nombre_usuario, nombre_completo, identificacion, correo, contrasena_hash, rol, activo,
                     debe_cambiar_contrasena, ultimo_acceso) VALUES
  ('rsilva',   'Roberto Silva',   'COORD-001', 'roberto.silva@ues.edu.sv',  crypt('Sigtau2026!', gen_salt('bf', 10)), 'Coordinador', TRUE,  FALSE, '2026-10-27 08:00'), -- 1
  ('rmendez',  'Roberto Méndez',  'DOC-0101',  'roberto.mendez@ues.edu.sv', crypt('Sigtau2026!', gen_salt('bf', 10)), 'Tutor',       TRUE,  FALSE, '2026-10-27 08:10'), -- 2
  ('jsiron',   'Jonathan Sirón',  'DOC-0102',  'jonathan.siron@ues.edu.sv', crypt('Sigtau2026!', gen_salt('bf', 10)), 'Tutor',       TRUE,  FALSE, '2026-10-26 14:00'), -- 3
  ('eruiz',    'Elena Ruiz',      'DOC-0103',  'elena.ruiz@ues.edu.sv',     crypt('Sigtau2026!', gen_salt('bf', 10)), 'Tutor',       TRUE,  FALSE, '2026-10-27 09:00'), -- 4
  ('cperaza',  'Carlos Peraza',   'DOC-0104',  'carlos.peraza@ues.edu.sv',  crypt('Sigtau2026!', gen_salt('bf', 10)), 'Tutor',       TRUE,  FALSE, '2026-10-22 07:30'), -- 5
  ('asilva',   'Alex Silva',      'DOC-0105',  'alex.silva@ues.edu.sv',     crypt('Sigtau2026!', gen_salt('bf', 10)), 'Tutor',       TRUE,  FALSE, '2026-10-20 10:00'), -- 6
  ('ga22001',  'Ana García',      'GA22001',   'ga22001@ues.edu.sv',        crypt('Sigtau2026!', gen_salt('bf', 10)), 'Estudiante',  TRUE,  FALSE, '2026-10-28 08:00'), -- 7
  ('pe22002',  'Juan Pérez',      'PE22002',   'pe22002@ues.edu.sv',        crypt('Sigtau2026!', gen_salt('bf', 10)), 'Estudiante',  TRUE,  FALSE, '2026-10-26 07:00'), -- 8
  ('go22003',  'María González',  'GO22003',   'go22003@ues.edu.sv',        crypt('Sigtau2026!', gen_salt('bf', 10)), 'Estudiante',  TRUE,  FALSE, '2026-10-25 14:30'), -- 9
  ('ru22004',  'Carlos Ruiz',     'RU22004',   'ru22004@ues.edu.sv',        crypt('Sigtau2026!', gen_salt('bf', 10)), 'Estudiante',  TRUE,  TRUE,  NULL),               -- 10
  ('me22005',  'Lucía Méndez',    'ME22005',   'me22005@ues.edu.sv',        crypt('Sigtau2026!', gen_salt('bf', 10)), 'Estudiante',  FALSE, TRUE,  NULL);               -- 11 (desactivada)

INSERT INTO sesion (id_usuario, token_hash, fecha_inicio, fecha_expiracion, fecha_cierre) VALUES
  (7, encode(sha256('token-demo-ana-1'::bytea), 'hex'), '2026-10-27 08:00', '2026-10-27 16:00', '2026-10-27 09:15'), -- cerrada
  (7, encode(sha256('token-demo-ana-2'::bytea), 'hex'), '2026-10-28 08:00', '2026-10-28 16:00', NULL);              -- activa

INSERT INTO estudiante (id_usuario, id_carrera, ciclo) VALUES
  (7, 1, 5), (8, 1, 5), (9, 2, 3), (10, 1, 2), (11, 2, 7);

INSERT INTO tutor (id_usuario, id_facultad, titulo, departamento, especialidad, telefono_contacto, biografia) VALUES
  (2, 1, 'Lic.', 'Departamento de Matemática',              'Matemática',            '2440-1001', 'Docente del Departamento de Matemática con experiencia en cálculo integral.'),
  (3, 1, 'Ing.', 'Departamento de Matemática',              'Matemáticas Aplicadas', NULL,        'Docente de cálculo diferencial e integral.'),
  (4, 1, 'MSc.', 'Departamento de Física',                  'Física y Matemática',   '2440-1003', 'Docente de Física I y II.'),
  (5, 1, 'Lic.', 'Departamento de Física',                  'Física',                NULL,        NULL),
  (6, 1, 'Ing.', 'Departamento de Ingeniería y Arquitectura', 'Programación',        '2440-1005', 'Docente de programación estructurada.');

INSERT INTO tutor_asignatura (id_tutor, id_asignatura) VALUES
  (2, 2),            -- Méndez: Cálculo Integral
  (3, 1), (3, 2),    -- Sirón: Cálculo Diferencial e Integral
  (4, 3), (4, 4),    -- Ruiz: Física I y II
  (5, 3), (5, 4),    -- Peraza: Física I y II
  (6, 5);            -- Silva: Programación I

-- Todas las franjas nacen Disponibles; los disparadores las marcan Ocupadas al crear tutorías
INSERT INTO horario_tutor (id_tutor, fecha, hora_inicio, hora_fin) VALUES
  (3, '2026-06-15', '10:00', '11:30'),   -- 1  Sirón
  (4, '2026-06-08', '14:30', '16:00'),   -- 2  Ruiz
  (6, '2026-06-12', '09:15', '10:45'),   -- 3  Silva
  (6, '2026-06-12', '11:00', '12:30'),   -- 4  Silva
  (3, '2026-06-01', '09:00', '10:30'),   -- 5  Sirón
  (2, '2026-11-05', '09:00', '10:30'),   -- 6  Méndez
  (2, '2026-11-09', '09:00', '11:00'),   -- 7  Méndez
  (4, '2026-11-10', '10:00', '11:00'),   -- 8  Ruiz
  (4, '2026-11-13', '11:00', '12:00'),   -- 9  Ruiz
  (3, '2026-11-11', '14:00', '17:00'),   -- 10 Sirón
  (5, '2026-10-22', '08:00', '09:30'),   -- 11 Peraza
  (5, '2026-11-12', '08:00', '09:30');   -- 12 Peraza

INSERT INTO solicitud_tutoria
  (id_estudiante, id_asignatura, id_horario, descripcion_dificultad, estado, motivo_rechazo, fecha_solicitud, fecha_respuesta) VALUES
  (7,  1, 1,  'Dificultad con la regla de la cadena y derivadas implícitas.',          'Aprobada',  NULL, '2026-06-10 08:00', '2026-06-10 15:00'), -- 1
  (7,  3, 2,  'Problemas con diagramas de cuerpo libre.',                              'Aprobada',  NULL, '2026-06-03 10:00', '2026-06-03 17:00'), -- 2
  (7,  5, 3,  'Necesito repasar estructuras de control.',                              'Rechazada', 'Cupo máximo alcanzado para este tutor en el semestre actual.', '2026-06-05 09:00', '2026-06-05 12:00'), -- 3
  (7,  2, 6,  'Integrales por partes y sustitución trigonométrica.',                   'Pendiente', NULL, '2026-10-26 18:30', NULL),               -- 4
  (8,  2, 7,  'Integrales triples y aplicaciones de volumen; repasar teoría antes del parcial.', 'Aprobada', NULL, '2026-10-26 07:00', '2026-10-26 10:00'), -- 5
  (9,  4, 8,  'Dudas sobre el circuito RC y la aplicación de las leyes de Kirchhoff.', 'Aprobada',  NULL, '2026-10-25 14:30', '2026-10-25 16:00'), -- 6
  (10, 5, 4,  'Revisión de sintaxis en bucles for y while; el código no compila.',     'Aprobada',  NULL, '2026-06-09 09:15', '2026-06-09 11:00'), -- 7
  (8,  1, 5,  'Límites laterales y continuidad.',                                      'Aprobada',  NULL, '2026-05-28 10:00', '2026-05-28 13:00'), -- 8
  (9,  3, 11, 'Movimiento circular uniforme y aceleración centrípeta.',                'Aprobada',  NULL, '2026-10-19 11:00', '2026-10-19 15:00'); -- 9

-- Al insertar cada tutoría, el disparador D3 marca su franja como Ocupada
INSERT INTO tutoria (id_solicitud, id_horario, lugar, fecha_programacion) VALUES
  (1, 1,  'Cubículo de tutorías 3, Edificio de Ingeniería', '2026-06-10 15:00'), -- 1
  (2, 2,  'Laboratorio de Física 1',                        '2026-06-03 17:00'), -- 2
  (5, 7,  'Aula 21, Edificio de Ingeniería',                '2026-10-26 10:00'), -- 3
  (6, 8,  'Laboratorio de Física 1',                        '2026-10-25 16:00'), -- 4
  (7, 4,  'Centro de cómputo 2',                            '2026-06-09 11:00'), -- 5
  (8, 5,  'Cubículo de tutorías 3, Edificio de Ingeniería', '2026-05-28 13:00'), -- 6
  (9, 11, 'Laboratorio de Física 2',                        '2026-10-19 15:00'); -- 7 (pendiente de seguimiento)

-- RF-13: cancelación (el disparador libera la franja 5)
UPDATE tutoria SET estado = 'Cancelada', motivo_cancelacion = 'El tutor tiene una reunión de facultad.',
                   fecha_cancelacion = '2026-05-30 08:00'
WHERE id_tutoria = 6;

-- RF-08: al registrar el seguimiento, el disparador D5 cambia la tutoría a Realizada
INSERT INTO seguimiento (id_tutoria, asistio, nivel_progreso, observaciones, fecha_registro) VALUES
  (1, TRUE,  'Avanzado', 'Resolvió los ejercicios de regla de la cadena de forma independiente. Repasar identidades trigonométricas.', '2026-06-15 11:40'),
  (2, TRUE,  'Medio',    'Comprende los diagramas de cuerpo libre; necesita practicar problemas con fricción.',                       '2026-06-08 16:10'),
  (5, FALSE, NULL,       'El estudiante no se presentó a la sesión.',                                                                 '2026-06-12 12:40');

-- RF-14: el tutor propone mover la tutoría 4 a la franja 9; queda pendiente de respuesta del estudiante
INSERT INTO reprogramacion (id_tutoria, id_horario_anterior, id_horario_propuesto, motivo, fecha_propuesta) VALUES
  (4, 8, 9, 'Cambio en el horario de laboratorio del tutor.', '2026-10-27 09:00');

INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje, leida, fecha_envio) VALUES
  (2,  'Solicitud',      'Nueva solicitud de tutoría',  'Ana García solicita tutoría de Cálculo Integral: integrales por partes.', FALSE, '2026-10-26 18:30'),
  (8,  'Tutoría',        'Tutoría programada',          'Cálculo Integral con Roberto Méndez el 09/11/2026 a las 09:00, Aula 21.',  FALSE, '2026-10-26 10:00'),
  (9,  'Reprogramación', 'Propuesta de reprogramación', 'Elena Ruiz propone mover Física II al 13/11/2026 a las 11:00.',            FALSE, '2026-10-27 09:00'),
  (7,  'Solicitud',      'Solicitud rechazada',         'Tu solicitud de Programación I fue rechazada: cupo máximo alcanzado.',      TRUE,  '2026-06-05 12:00'),
  (8,  'Cancelación',    'Tutoría cancelada',           'Cálculo Diferencial del 01/06/2026 cancelada: reunión de facultad.',       TRUE,  '2026-05-30 08:00'),
  (7,  'Seguimiento',    'Seguimiento registrado',      'Jonathan Sirón registró observaciones de tu sesión de Cálculo Diferencial.', TRUE,  '2026-06-15 11:40'),
  (1,  'Reporte',        'Reporte generado',            'El reporte de Asistencia estudiantil está listo para descargar.',           TRUE,  '2026-10-27 15:00');

INSERT INTO reporte (id_coordinador, tipo, fecha_desde, fecha_hasta, id_tutor, id_asignatura, estado_filtro, formato, fecha_generacion) VALUES
  (1, 'Tutorías realizadas',    '2026-05-01', '2026-06-30', NULL, NULL, 'Realizada', 'PDF',  '2026-07-01 09:00'),
  (1, 'Progreso académico',     '2026-06-01', '2026-06-30', NULL, 1,    'Realizada', 'XLSX', '2026-07-01 09:30'),
  (1, 'Asistencia estudiantil', '2026-01-01', '2026-10-27', NULL, NULL, NULL,        'PDF',  '2026-10-27 15:00');

-- Fin del script
SELECT 'Base de datos SIGTAU creada correctamente' AS resultado;
