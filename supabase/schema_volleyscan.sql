-- ============================================================================
-- VolleyScan AI — Esquema Completo de Base de Datos (Supabase / PostgreSQL)
-- Ejecutar este script en el SQL Editor de tu proyecto Supabase.
-- Es idempotente: crea tablas faltantes y actualiza columnas si ya existen.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. SESIONES DE ENTRENAMIENTO
-- Guarda la cabecera de cada sesión real con fecha, duración exacta y resumen
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sesiones_entrenamiento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_sesion text UNIQUE,
    usuario_id uuid NOT NULL,
    fecha timestamptz NOT NULL DEFAULT now(),
    fecha_fin timestamptz,
    duracion_segundos integer NOT NULL DEFAULT 0,
    gesto_tecnico text NOT NULL DEFAULT 'entrenamiento_continuo',
    dispositivo text NOT NULL DEFAULT 'VolleyScan Next.js 3D',
    total_gestos integer NOT NULL DEFAULT 0,
    puntaje_promedio numeric(5,2) NOT NULL DEFAULT 0,
    salto_maximo_cm numeric(6,2) NOT NULL DEFAULT 0,
    resumen jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sesiones_entrenamiento ADD COLUMN IF NOT EXISTS codigo_sesion text;
ALTER TABLE public.sesiones_entrenamiento ADD COLUMN IF NOT EXISTS fecha timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.sesiones_entrenamiento ADD COLUMN IF NOT EXISTS fecha_fin timestamptz;
ALTER TABLE public.sesiones_entrenamiento ADD COLUMN IF NOT EXISTS duracion_segundos integer NOT NULL DEFAULT 0;
ALTER TABLE public.sesiones_entrenamiento ADD COLUMN IF NOT EXISTS total_gestos integer NOT NULL DEFAULT 0;
ALTER TABLE public.sesiones_entrenamiento ADD COLUMN IF NOT EXISTS puntaje_promedio numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sesiones_entrenamiento ADD COLUMN IF NOT EXISTS salto_maximo_cm numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sesiones_entrenamiento ADD COLUMN IF NOT EXISTS resumen jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sesiones_codigo_sesion_uniq
    ON public.sesiones_entrenamiento (codigo_sesion)
    WHERE codigo_sesion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_fecha
    ON public.sesiones_entrenamiento (usuario_id, fecha DESC);

-- ----------------------------------------------------------------------------
-- 2. GESTOS POR SESIÓN (Incluye secuencia_landmarks_3d JSONB para Replay 3D)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gestos_sesion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id uuid NOT NULL REFERENCES public.sesiones_entrenamiento(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL,
    salto_index integer NOT NULL DEFAULT 1,
    tipo_gesto text NOT NULL DEFAULT 'remate',
    puntaje numeric(5,2) NOT NULL DEFAULT 0,
    altura_salto_cm numeric(6,2) NOT NULL DEFAULT 0,
    tiempo_vuelo_seg numeric(6,4) NOT NULL DEFAULT 0,
    diagnostico_causa_raiz text DEFAULT '',
    voz_coach text DEFAULT '',
    correcciones_por_fase jsonb NOT NULL DEFAULT '{}'::jsonb,
    secuencia_landmarks_3d jsonb NOT NULL DEFAULT '[]'::jsonb,
    indices_fases jsonb NOT NULL DEFAULT '{}'::jsonb,
    metricas_angulares jsonb NOT NULL DEFAULT '{}'::jsonb,
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestos_sesion_id
    ON public.gestos_sesion (sesion_id, salto_index ASC);

CREATE INDEX IF NOT EXISTS idx_gestos_usuario_creado
    ON public.gestos_sesion (usuario_id, creado_en DESC);

-- ----------------------------------------------------------------------------
-- 3. RUTINAS (Inteligentes IA + Biblioteca Predeterminada de Voleibol)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rutinas (
    id text PRIMARY KEY,
    usuario_id uuid,
    titulo text NOT NULL,
    descripcion text NOT NULL DEFAULT '',
    tipo text NOT NULL DEFAULT 'predeterminada' CHECK (tipo IN ('ia', 'predeterminada')),
    categoria text NOT NULL DEFAULT 'pliometria',
    nivel text NOT NULL DEFAULT 'Intermedio',
    duracion_min integer NOT NULL DEFAULT 20,
    enfoque_tecnico text DEFAULT '',
    error_detectado text DEFAULT '',
    estado text NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'en_progreso', 'completada')),
    progreso_pct integer NOT NULL DEFAULT 0,
    ejercicios jsonb NOT NULL DEFAULT '[]'::jsonb,
    iniciada_en timestamptz,
    completada_en timestamptz,
    creada_en timestamptz NOT NULL DEFAULT now(),
    actualizada_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'predeterminada';
ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'pliometria';
ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS error_detectado text DEFAULT '';
ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'disponible';
ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS progreso_pct integer NOT NULL DEFAULT 0;
ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS ejercicios jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS iniciada_en timestamptz;
ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS completada_en timestamptz;
ALTER TABLE public.rutinas ADD COLUMN IF NOT EXISTS actualizada_en timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_rutinas_usuario_tipo
    ON public.rutinas (usuario_id, tipo, estado);

-- ----------------------------------------------------------------------------
-- 4. PROGRESO DEL USUARIO (Resumen analítico, rachas, evolución y comparativa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.progreso_usuario (
    usuario_id uuid PRIMARY KEY,
    total_sesiones integer NOT NULL DEFAULT 0,
    total_gestos integer NOT NULL DEFAULT 0,
    tiempo_total_seg integer NOT NULL DEFAULT 0,
    racha_dias integer NOT NULL DEFAULT 0,
    mejor_racha_dias integer NOT NULL DEFAULT 0,
    ultima_fecha_sesion date,
    salto_maximo_cm numeric(6,2) NOT NULL DEFAULT 0,
    salto_promedio_cm numeric(6,2) NOT NULL DEFAULT 0,
    puntaje_promedio numeric(5,2) NOT NULL DEFAULT 0,
    precision_por_gesto jsonb NOT NULL DEFAULT '{}'::jsonb,
    evolucion_salto jsonb NOT NULL DEFAULT '[]'::jsonb,
    fortalezas jsonb NOT NULL DEFAULT '[]'::jsonb,
    areas_mejora jsonb NOT NULL DEFAULT '[]'::jsonb,
    actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. NOTIFICACIONES (Sincronización reactiva de logros y rutinas IA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id text PRIMARY KEY,
    usuario_id uuid NOT NULL,
    titulo text NOT NULL,
    mensaje text NOT NULL DEFAULT '',
    tipo text NOT NULL DEFAULT 'info',
    prioridad text NOT NULL DEFAULT 'media',
    leida boolean NOT NULL DEFAULT false,
    ruta_destino text DEFAULT '/usuario/rutinas',
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_creado
    ON public.notificaciones (usuario_id, creado_en DESC);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.sesiones_entrenamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestos_sesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progreso_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sesiones_owner_all" ON public.sesiones_entrenamiento;
CREATE POLICY "sesiones_owner_all" ON public.sesiones_entrenamiento
    FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "gestos_owner_all" ON public.gestos_sesion;
CREATE POLICY "gestos_owner_all" ON public.gestos_sesion
    FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "rutinas_select_owner_or_global" ON public.rutinas;
CREATE POLICY "rutinas_select_owner_or_global" ON public.rutinas
    FOR SELECT USING (usuario_id IS NULL OR auth.uid() = usuario_id);

DROP POLICY IF EXISTS "rutinas_write_owner" ON public.rutinas;
CREATE POLICY "rutinas_write_owner" ON public.rutinas
    FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "progreso_owner_all" ON public.progreso_usuario;
CREATE POLICY "progreso_owner_all" ON public.progreso_usuario
    FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "notificaciones_owner_all" ON public.notificaciones;
CREATE POLICY "notificaciones_owner_all" ON public.notificaciones
    FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- ----------------------------------------------------------------------------
-- 7. SEMILLA INICIAL DE RUTINAS PREDETERMINADAS GLOBALES (usuario_id IS NULL)
-- ----------------------------------------------------------------------------
INSERT INTO public.rutinas (id, usuario_id, titulo, descripcion, tipo, categoria, nivel, duracion_min, enfoque_tecnico, estado, ejercicios)
VALUES
(
    'rut_pred_pliometria',
    NULL,
    'Pliometría Explosiva y Salto Vertical',
    'Programa orientado a maximizar la potencia reactiva de tren inferior, altura de vuelo y absorción segura al aterrizar.',
    'predeterminada',
    'pliometria',
    'Intermedio',
    25,
    'Tiempo de vuelo y simetría bilateral en aterrizaje',
    'disponible',
    '[
        {"id": "ej_plio_1", "nombre": "Countermovement Jumps (CMJ) con pausa", "series": "4 x 6 reps", "descanso": "90 s", "enfoque": "Flexión 95°-110° y extensión explosiva de cadera", "completado": false},
        {"id": "ej_plio_2", "nombre": "Drop Jumps desde cajón bajo (30 cm)", "series": "3 x 5 reps", "descanso": "120 s", "enfoque": "Contacto mínimo en suelo (<220 ms) y aterrizaje blando", "completado": false},
        {"id": "ej_plio_3", "nombre": "Saltos con aproximación de 3 pasos al aro/red", "series": "4 x 5 reps", "descanso": "90 s", "enfoque": "Conversión de velocidad horizontal a impulso vertical", "completado": false}
    ]'::jsonb
),
(
    'rut_pred_remate',
    NULL,
    'Técnica de Remate: Armado y Punto de Contacto Alto',
    'Pulido mecánico de las 4 fases del ataque: batida en 3 pasos, apertura torácica en arco y latigazo con codo extendido.',
    'predeterminada',
    'remate',
    'Intermedio',
    30,
    'Extensión terminal de codo (>=165°) y elevación de hombro',
    'disponible',
    '[
        {"id": "ej_rem_1", "nombre": "Drills de armado Bow-and-Arrow contra pared", "series": "3 x 12 reps", "descanso": "45 s", "enfoque": "Codo tirador arriba del hombro antes de rotar", "completado": false},
        {"id": "ej_rem_2", "nombre": "Remate con auto-lanzamiento y contacto a máxima altura", "series": "4 x 8 reps", "descanso": "60 s", "enfoque": "Impacto con brazo completamente extendido frente al eje frontal", "completado": false},
        {"id": "ej_rem_3", "nombre": "Aterrizaje bilateral controlado tras ataque simulado", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Rodillas alineadas evitando valgo dinámico", "completado": false}
    ]'::jsonb
),
(
    'rut_pred_saque',
    NULL,
    'Saque Flotante y en Salto de Alta Precisión',
    'Control de lanzamiento (toss) estable, aceleración secuencial de hombro y golpe seco con muñeca firme.',
    'predeterminada',
    'saque',
    'Todos los niveles',
    20,
    'Toss consistente y extensión limpia sobre el plano coronal',
    'disponible',
    '[
        {"id": "ej_saq_1", "nombre": "Lanzamiento de precisión sin golpeo (marca en suelo)", "series": "3 x 12 reps", "descanso": "30 s", "enfoque": "Altura uniforme 40 cm sobre el alcance del brazo ejecutor", "completado": false},
        {"id": "ej_saq_2", "nombre": "Saque flotante corto frente a pared (contacto plano)", "series": "4 x 10 reps", "descanso": "45 s", "enfoque": "Muñeca rígida y codo extendido sin seguimiento excesivo", "completado": false},
        {"id": "ej_saq_3", "nombre": "Secuencia rítmica de saque flotante con paso-impulso", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Transferencia de peso posterior-anterior alineada al objetivo", "completado": false}
    ]'::jsonb
),
(
    'rut_pred_voleo',
    NULL,
    'Voleo y Colocación: Triángulo de Manos y Extensión',
    'Precisión en el pase de dedos sin doble contacto mediante amortiguación elástica de muñecas y empuje sincronizado.',
    'predeterminada',
    'voleo',
    'Todos los niveles',
    20,
    'Simetría de codos y contacto sobre la frente',
    'disponible',
    '[
        {"id": "ej_vol_1", "nombre": "Toques rápidos contra pared manteniendo triángulo", "series": "4 x 20 toques", "descanso": "40 s", "enfoque": "Recepción sobre la frente con pulgares hacia los ojos", "completado": false},
        {"id": "ej_vol_2", "nombre": "Voleo tras desplazamiento lateral y frenado en 2 tiempos", "series": "3 x 10 reps", "descanso": "60 s", "enfoque": "Hombros cuadrados hacia zona 4 antes de soltar el balón", "completado": false},
        {"id": "ej_vol_3", "nombre": "Jump-set controlado con balón medicinal ligero (1 kg)", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Extensión simétrica de dedos, codos y rodillas en el aire", "completado": false}
    ]'::jsonb
),
(
    'rut_pred_defensa',
    NULL,
    'Defensa, Bloqueo y Plataforma de Recepción',
    'Postura atlética baja, unión temprana de antebrazos y reacción en desplazamientos cortos ante balones rápidos.',
    'predeterminada',
    'defensa',
    'Intermedio',
    25,
    'Ángulo estable de plataforma y centro de gravedad bajo',
    'disponible',
    '[
        {"id": "ej_def_1", "nombre": "Isometría en postura baja con desplazamiento shuffle", "series": "4 x 30 s", "descanso": "45 s", "enfoque": "Mantener altura de cadera constante con espalda neutra", "completado": false},
        {"id": "ej_def_2", "nombre": "Formación de plataforma en 1 tiempo frente a espejo/cámara", "series": "3 x 12 reps", "descanso": "40 s", "enfoque": "Hombros rotados al frente y muñecas alineadas hacia abajo", "completado": false},
        {"id": "ej_def_3", "nombre": "Bloqueo lateral paso cruzado y penetración de manos", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Manos firmes invadiendo el plano sin tocar la red", "completado": false}
    ]'::jsonb
),
(
    'rut_pred_movilidad',
    NULL,
    'Movilidad Articular y Prevención de Lesiones (Hombro/Tobillo/LCA)',
    'Sesión regenerativa para liberar la cápsula posterior del hombro, dorsiflexión de tobillo y control neuromuscular de rodilla.',
    'predeterminada',
    'movilidad',
    'Todos los niveles',
    18,
    'Rango torácico saludable y estabilidad unipodal',
    'disponible',
    '[
        {"id": "ej_mov_1", "nombre": "Sleeper Stretch + rotaciones torácicas en cuadrupedia", "series": "2 x 10 reps/lado", "descanso": "30 s", "enfoque": "Prevención de pinzamiento subacromial en rematadores", "completado": false},
        {"id": "ej_mov_2", "nombre": "Movilidad de dorsiflexión de tobillo contra pared (90/90)", "series": "3 x 10 reps/lado", "descanso": "30 s", "enfoque": "Mayor absorción excéntrica durante el aterrizaje (Fase 4)", "completado": false},
        {"id": "ej_mov_3", "nombre": "Equilibrio unipodal con alcance multidireccional", "series": "3 x 8 reps/pierna", "descanso": "40 s", "enfoque": "Control femoral contra valgo de rodilla", "completado": false}
    ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
