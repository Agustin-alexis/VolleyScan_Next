# VolleyScan AI — Plataforma Unificada (Next.js + FastAPI Biomecánico 3D)

Plataforma unificada de análisis biomecánico de voleibol con **extracción estricta de 33 landmarks mediante MediaPipe Pose**, **Calibración Cero Ambiental ('T')**, **reconstrucción 3D temporal en 4 fases**, **cálculo de salto vertical (cm)**, **Laboratorio de Ablación (Método A vs B vs C)**, **Replay GIF / Gemelo Digital 3D**, **Coach de Voz**, y **autenticación + persistencia con Supabase Auth (JWT)**.

---

## Estructura Unificada del Proyecto

```text
C:\Users\jhgue\Desktop\VolleyScan\VolleyScan_Next\
├── backend\
│   ├── __init__.py
│   ├── api\
│   │   ├── __init__.py
│   │   ├── db_sync.py                  # Sincronización asíncrona y respaldo en memoria
│   │   └── router.py                   # API REST + WebSocket (/ws/analizar/{sesion_id}) + /api/dashboard/{usuario_id}
│   ├── biomecanica\
│   │   ├── __init__.py
│   │   ├── 1_clasificador_gestos.py    # Clasificador multi-gesto (Random Forest 25 features)
│   │   ├── 2_motor_fisico.py           # Motor cinemático 3D y altura de salto por tiempo de vuelo
│   │   ├── 3_coach_experto.py          # Evaluación en 4 fases y diagnóstico de causa raíz
│   │   ├── buffer_temporal.py          # Búfer circular FIFO y 4 candados anti falsos positivos
│   │   ├── calibracion_entorno.py      # Calibración Cero Ambiental (Postura en 'T' e iluminación)
│   │   ├── evaluador_fases.py          # Evaluador de fases F1..F4 y rangos biomecánicos
│   │   ├── generador_replay.py         # Generador de Replay GIF 640x480 en Base64
│   │   ├── laboratorio_ablacion.py     # Matriz comparativa científica Método A vs B vs C
│   │   ├── pipeline_principal.py       # Orquestador del pipeline biomecánico completo
│   │   ├── reconstruccion_3d.py        # Suavizado gaussiano temporal y reconstrucción 3D
│   │   ├── dataset_angulos_25f.npz     # Dataset de entrenamiento de gestos técnicos
│   │   └── modelo_rf_gestos_25f.joblib # Modelo Random Forest preentrenado (5 gestos)
│   ├── core\
│   │   ├── __init__.py
│   │   └── config.py                   # Configuración central y umbrales biomecánicos
│   ├── db\
│   │   ├── __init__.py
│   │   └── database.py                 # Persistencia en Supabase por usuario_id con respaldo RAM
│   └── schemas\
│       ├── __init__.py
│       ├── analisis_schemas.py         # Schemas Pydantic (exclusivo MediaPipe Pose 33 landmarks)
│       └── modelos_sesion.py           # Modelos de sesión, saltos y payloads REST/WS
├── tests\                              # Suite de pruebas unitarias e integración del motor Python
├── volleyscan\                         # Frontend Next.js 16 (App Router) + @mediapipe/tasks-vision
│   ├── .env.local                      # Variables NEXT_PUBLIC_SUPABASE_* y NEXT_PUBLIC_FASTAPI_URL
│   ├── src\
│   │   ├── proxy.js                    # Protección de rutas privadas (/usuario/*, /panel_entrenador/*, /admin/*)
│   │   ├── hooks\usePoseCamera.js      # Cámara + MediaPipe Pose + puente WebSocket al puerto 8000
│   │   ├── lib\
│   │   │   ├── supabase.js             # Registro, Log In, OAuth y gestión de sesión JWT
│   │   │   ├── api.js                  # Cliente HTTP autenticado con Bearer JWT
│   │   │   ├── engine\backendBridge.js # Cliente WebSocket (:8000) y adaptador de respuestas biomecánicas
│   │   │   ├── historial\sesionAnalisis.js # Registro autenticado de saltos e historial
│   │   │   └── voice\voiceCoach.js     # Síntesis de voz Web Speech API del Coach IA
│   │   └── app\
│   │       ├── login\page.jsx          # Inicio de sesión con Supabase Auth
│   │       ├── registro\page.jsx       # Registro de atleta/entrenador con Supabase Auth
│   │       ├── usuario\dashboard\page.jsx # Dashboard conectado a GET /api/dashboard/{usuario_id} (:8000)
│   │       └── components\analisis\
│   │           ├── GestureAnalyzer.jsx # Cámara en vivo, Calibración 'T', HUD 8 ángulos y control de sesión
│   │           ├── RepResultCard.jsx   # Tarjeta inmediata de repetición y acceso a 4 fases / 3D / Ablación
│   │           └── TecnicaFoto.jsx     # Visor 4 Fases + Gemelo Digital 3D + Ablación A/B/C & Replay GIF
├── .env                                # Variables de entorno para FastAPI y Supabase
├── entrenamiento.py                    # Script de reentrenamiento del clasificador de gestos
├── main.py                             # Servidor FastAPI (puerto 8000) con soporte headless + Next.js
└── requirements.txt                    # Dependencias Python (MediaPipe estricto, FastAPI, Supabase, scikit-learn)
```

---

## Ejecución Unificada

### 1. Backend Python — Motor Biomecánico MediaPipe (Puerto `8000`)

```powershell
cd "C:\Users\jhgue\Desktop\VolleyScan\VolleyScan_Next"
python main.py
```

Endpoints principales en `http://127.0.0.1:8000`:
- `GET /api/health` — Estado del motor estricto MediaPipe
- `POST /api/entrenamiento/iniciar` — Alta de sesión autenticada por JWT
- `WS /ws/analizar/{sesion_id}?token=<JWT>&usuario_id=<UUID>` — Flujo de landmarks en tiempo real (`CALIBRANDO` → `ACTIVO` → `evaluacion_secuencia_completa`)
- `POST /api/entrenamiento/{sesion_id}/salto` — Persistencia autenticada de saltos y 8 ángulos
- `GET /api/dashboard/{usuario_id}` — Métricas consolidadas para el dashboard de Next.js

### 2. Frontend Web — Next.js 16 + Visor 3D + Supabase Auth (Puerto `3000`)

```powershell
cd "C:\Users\jhgue\Desktop\VolleyScan\VolleyScan_Next\volleyscan"
npm install
npm run dev
```

Abrir en el navegador: `http://localhost:3000`
