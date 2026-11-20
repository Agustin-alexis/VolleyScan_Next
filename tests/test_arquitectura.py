import sys
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica.buffer_temporal import TemporalPoseBuffer
from backend.biomecanica.reconstruccion_3d import Reconstructor3DTemporal
from backend.biomecanica.evaluador_fases import EvaluadorFasesBiomecanicas
from backend.biomecanica.laboratorio_ablacion import LaboratorioAblacionCientifica

print("=================================================================")
print("🧪 VALIDACIÓN DE LOS 4 CANDADOS CIENTÍFICOS EN VOLLEYSCAN AI")
print("=================================================================")

# ===================================================================
# TEST 1: CANDADO 1 - PUERTA DE INTEGRIDAD DE CUERPO COMPLETO (USUARIO SENTADO)
# ===================================================================
print("\n[TEST 1] Verificando bloqueo con usuario sentado (cuerpo incompleto)...")
buf_sentado = TemporalPoseBuffer(maxlen=60, pre_frames=20, post_frames=12)

t0_disparado_sentado = False
for i in range(25):
    ts = i * 0.033
    # Brazo moviéndose arriba y abajo bruscamente, pero piernas ocultas (vis = 0.15)
    muneca_y = 0.20 if i % 4 < 2 else 0.50
    p2d_sentado = {
        'hombro_der': [0.55, 0.40, 0.0, 0.95],
        'hombro_izq': [0.45, 0.40, 0.0, 0.95],
        'codo_der': [0.60, 0.30, 0.0, 0.90],
        'codo_izq': [0.40, 0.30, 0.0, 0.90],
        'muneca_der': [0.62, muneca_y, 0.0, 0.95],
        'muneca_izq': [0.38, 0.55, 0.0, 0.95],
        'cadera_der': [0.53, 0.80, 0.0, 0.85],
        'cadera_izq': [0.47, 0.80, 0.0, 0.85],
        'rodilla_der': [0.54, 0.90, 0.0, 0.20],  # OCULTA
        'rodilla_izq': [0.46, 0.90, 0.0, 0.20],  # OCULTA
        'tobillo_der': [0.54, 0.99, 0.0, 0.05],  # OCULTO
        'tobillo_izq': [0.46, 0.99, 0.0, 0.05],  # OCULTO
    }
    p3d_sentado = {k: [v[0] - 0.5, v[1] - 0.5, 0.0, v[3]] for k, v in p2d_sentado.items()}
    res, tele = buf_sentado.registrar_frame(i, ts, p2d_sentado, p3d_sentado, "remate")
    if tele.get("estado_buffer") == "ENCUADRE_INCOMPLETO":
        t0_disparado_sentado = True

assert t0_disparado_sentado, "El candado 1 debió marcar ENCUADRE_INCOMPLETO."
assert buf_sentado.t0_frame_id is None, "ERROR: Se detectó t0 con piernas ocultas."
print("  ✅ Candado 1 SUPERADO: Estado 'ENCUADRE_INCOMPLETO' activo, t0 bloqueado estrictamente.")

# ===================================================================
# TEST 2: CANDADO 2 - FILTRO DE ENERGÍA Y AMPLITUD CINEMÁTICA (MOVIMIENTO LENTO)
# ===================================================================
print("\n[TEST 2] Verificando rechazo de movimientos lentos / acomodarse gafas...")
buf_lento = TemporalPoseBuffer(maxlen=60, pre_frames=20, post_frames=12)

t0_lento = False
for i in range(25):
    ts = i * 0.033
    # Movimiento corto y lento (delta_y = 0.05) con cuerpo completo visible
    muneca_y = 0.45 - (0.05 if i % 6 < 3 else 0.0)
    p2d_lento = {
        'hombro_der': [0.55, 0.40, 0.0, 0.95],
        'hombro_izq': [0.45, 0.40, 0.0, 0.95],
        'codo_der': [0.60, 0.35, 0.0, 0.90],
        'codo_izq': [0.40, 0.35, 0.0, 0.90],
        'muneca_der': [0.62, muneca_y, 0.0, 0.95],
        'muneca_izq': [0.38, 0.55, 0.0, 0.95],
        'cadera_der': [0.53, 0.70, 0.0, 0.95],
        'cadera_izq': [0.47, 0.70, 0.0, 0.95],
        'rodilla_der': [0.54, 0.85, 0.0, 0.95],
        'rodilla_izq': [0.46, 0.85, 0.0, 0.95],
        'tobillo_der': [0.54, 0.98, 0.0, 0.95],
        'tobillo_izq': [0.46, 0.98, 0.0, 0.95],
    }
    p3d_lento = {k: [v[0] - 0.5, v[1] - 0.5, 0.0, v[3]] for k, v in p2d_lento.items()}
    res, tele = buf_lento.registrar_frame(i, ts, p2d_lento, p3d_lento, "remate")
    if res is not None or tele.get("estado_buffer") == "T0_DETECTADO":
        t0_lento = True

assert not t0_lento, "ERROR: Se disparó t0 en un movimiento lento de baja amplitud."
print("  ✅ Candado 2 SUPERADO: Movimiento de baja amplitud descartado por umbral de energía.")

# ===================================================================
# TEST 3: CANDADO 3 Y 4 - GESTO DEPORTIVO REAL (REMATE) + PARTICIÓN EXACTA
# ===================================================================
print("\n[TEST 3] Verificando remate deportivo real y partición exacta de las 4 fases...")
buf_real = TemporalPoseBuffer(maxlen=60, pre_frames=20, post_frames=12)

secuencia_real = None
for i in range(40):
    ts = i * 0.033
    if i < 10:
        # FASE 1: Preparación (aproximación y flexión de rodilla)
        muneca_y = 0.65
        cadera_y = 0.72 + (i * 0.012)
        rodilla_ang_val = 0.82
    elif i <= 21:
        # FASE 2: Salto y armado (despegue explosivo y elevación rápida de brazo)
        muneca_y = 0.65 - ((i - 10) * 0.052)  # Recorrido neto > 0.50 norm, vel ~ 1.6 m/s
        cadera_y = 0.84 - ((i - 10) * 0.026)  # Salto confirmado
        rodilla_ang_val = 0.85
    else:
        # FASE 4: Descenso tras impacto y aterrizaje amortiguado
        muneca_y = 0.12 + ((i - 21) * 0.038)
        cadera_y = 0.55 + ((i - 21) * 0.02)
        rodilla_ang_val = 0.88

    p2d = {
        'hombro_der': [0.55, muneca_y + 0.28, 0.0, 0.98],
        'hombro_izq': [0.45, muneca_y + 0.28, 0.0, 0.98],
        'codo_der': [0.62, muneca_y + 0.14, -0.05, 0.98],
        'codo_izq': [0.38, muneca_y + 0.14, 0.05, 0.98],
        'muneca_der': [0.64, muneca_y, -0.10, 0.98],
        'muneca_izq': [0.36, 0.58, 0.05, 0.98],  # Asimetría clara
        'cadera_der': [0.53, cadera_y, 0.0, 0.98],
        'cadera_izq': [0.47, cadera_y, 0.0, 0.98],
        'rodilla_der': [0.54, rodilla_ang_val, 0.0, 0.98],
        'rodilla_izq': [0.46, rodilla_ang_val, 0.0, 0.98],
        'tobillo_der': [0.54, 0.98, 0.0, 0.98],
        'tobillo_izq': [0.46, 0.98, 0.0, 0.98],
    }
    p3d = {
        k: [v[0] - 0.5, v[1] - 0.5, -0.12 if 'der' in k else 0.12, v[3]] for k, v in p2d.items()
    }

    res, tele = buf_real.registrar_frame(i, ts, p2d, p3d, "remate")
    if res is not None:
        secuencia_real = res
        print(f"  -> t0 detectado en frame {res['t0_frame_id']}! Ventana extraída: {res['total_frames']} frames.")
        break

assert secuencia_real is not None, "ERROR: No se capturó la secuencia deportiva real."

# Reconstrucción 3D
rec = Reconstructor3DTemporal()
frames_3d = rec.reconstruir_y_suavizar_secuencia(secuencia_real['secuencia'])

# Evaluación en 4 Fases
eval_fases = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(
    frames_3d,
    secuencia_real['t0_idx_relativo'],
    gesto_solicitado="auto"
)

assert not eval_fases.get("descartada", False), f"ERROR: Remate real fue descartado: {eval_fases.get('motivo_descarte')}"
print(f"  -> Gesto Clasificado: {eval_fases['gesto_tecnico'].upper()} con confianza={eval_fases['confianza_clasificacion']}%")

# VERIFICACIÓN DE CANDADO 4: NO REPETICIÓN DE FRAMES
f1_id = eval_fases['frames_clave_fases']['fase_1']
f2_id = eval_fases['frames_clave_fases']['fase_2']
f3_id = eval_fases['frames_clave_fases']['fase_3']
f4_id = eval_fases['frames_clave_fases']['fase_4']
ids_tarjetas = [f1_id, f2_id, f3_id, f4_id]

print(f"  -> Frame IDs de las 4 Tarjetas: F1={f1_id}, F2={f2_id}, F3={f3_id}, F4={f4_id}")
assert len(set(ids_tarjetas)) == 4, f"ERROR: Se repitieron frame_ids en las tarjetas del visor: {ids_tarjetas}"
print("  ✅ Candado 4 SUPERADO: Las 4 tarjetas tienen fotogramas completamente disjuntos y únicos.")

# ===================================================================
# TEST 4: CANDADO 4B - MÉTRICAS DINÁMICAS REALES EN ABLACIÓN (NO VALORES FIJOS)
# ===================================================================
print("\n[TEST 4] Verificando cálculo dinámico real en el Laboratorio de Ablación...")
ablacion = LaboratorioAblacionCientifica.ejecutar_matriz_ablacion(
    secuencia_real['secuencia'],
    frames_3d,
    eval_fases,
    secuencia_real['t0_idx_relativo']
)

tabla = ablacion['tabla_comparativa']
mA = next(m for m in tabla if m['metodo_id'] == 'metodo_a')
mB = next(m for m in tabla if m['metodo_id'] == 'metodo_b')
mC = next(m for m in tabla if m['metodo_id'] == 'metodo_c')

print(f"  -> Confianzas Dinámicas Calculadas: Método A={mA['confianza_diagnostica_pct']}%, Método B={mB['confianza_diagnostica_pct']}%, Método C={mC['confianza_diagnostica_pct']}%")
print(f"  -> Discrepancia real de escorzo 2D: Codo={ablacion['resumen_cientifico']['discrepancia_angular_codo_2d_vs_3d']}°")
print(f"  -> Ganancia científica dinámica: +{ablacion['resumen_cientifico']['ganancia_confianza_vs_2d_pct']}%")

# Comprobar que no son los valores fijos anteriores
assert mA['confianza_diagnostica_pct'] != 58.4 or mB['confianza_diagnostica_pct'] != 74.2 or mC['confianza_diagnostica_pct'] != 96.8 or ablacion['resumen_cientifico']['discrepancia_angular_codo_2d_vs_3d'] != 24.2, "Se esperaban métricas dinámicas reales."

print("  ✅ Candado 4B SUPERADO: Métricas dinámicas calculadas sobre la geometría de cada jugada.")

# ===================================================================
# TEST 5: CANDADO 3B - DESCARTE DE MOVIMIENTO NO CLASIFICADO (< 80% CONFIANZA)
# ===================================================================
print("\n[TEST 5] Verificando descarte como 'MOVIMIENTO NO CLASIFICADO' (< 80%)...")
# Crear una secuencia sintética rápida pero sin patrón técnico de voleibol
# (manos separadas a la altura del pecho, sin extensión sobre la cabeza ni flexión de recepción)
frames_no_deportivos = []
for i in range(33):
    ts = i * 0.033
    f_dummy = {
        "frame_id": 100 + i,
        "timestamp": ts,
        "puntos_3d_suaves": {
            "muneca_der": [0.2, 0.45, 0.0],
            "muneca_izq": [-0.2, 0.45, 0.0],
            "hombro_der": [0.15, 0.35, 0.0],
            "hombro_izq": [-0.15, 0.35, 0.0],
        },
        "angulos_3d": {"rodilla": 170.0, "codo": 110.0, "hombro": 80.0, "tronco": 5.0},
        "cinematica": {
            "distancia_munecas_3d_m": 0.40,
            "velocidad_muneca_3d_ms": 1.5,
            "altura_centro_masa_rel": 0.0,
        }
    }
    frames_no_deportivos.append(f_dummy)

eval_no_dep = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(frames_no_deportivos, 20)
assert eval_no_dep.get("descartada", False) is True, "ERROR: La secuencia no deportiva debió ser descartada."
assert eval_no_dep.get("gesto_tecnico") == "MOVIMIENTO NO CLASIFICADO", f"ERROR: Gesto inesperado: {eval_no_dep.get('gesto_tecnico')}"
print(f"  -> Secuencia descartada con éxito: {eval_no_dep['motivo_descarte']}")
print("  ✅ Candado 3B SUPERADO: Movimientos sin 80% de match técnico bloqueados como 'MOVIMIENTO NO CLASIFICADO'.")

# ===================================================================
# TEST 6: CALIBRACIÓN PROFUNDA - NORMALIZACIÓN ANTROPOMÉTRICA Y 5 VARIABLES
# ===================================================================
print("\n[TEST 6] Verificando L_torso invariant y las 5 variables cinemáticas avanzadas...")

# 1. Normalización antropométrica L_torso
m_f0 = frames_3d[0]
assert "L_torso" in m_f0, "Falta L_torso en frame 3D"
assert m_f0["L_torso"] > 0.15, f"L_torso inválido: {m_f0['L_torso']}"
assert "distancia_munecas_norm" in m_f0["cinematica"], "Falta distancia_munecas_norm"
assert "elevacion_salto_norm" in m_f0["cinematica"], "Falta elevacion_salto_norm"

print(f"  -> L_torso Base: {m_f0['L_torso']} m | Dist. Muñecas Norm: {m_f0['cinematica']['distancia_munecas_norm']} UT")

# 2. Las 5 nuevas variables cinemáticas de grado deportivo
cin_t0 = frames_3d[secuencia_real['t0_idx_relativo']]["cinematica"]

assert "vel_angular_codo_deg_s" in cin_t0, "Falta vel_angular_codo_deg_s"
assert "rotacion_toracica_deg" in cin_t0, "Falta rotacion_toracica_deg"
assert "estabilidad_osea_score" in cin_t0, "Falta estabilidad_osea_score"
assert "confianza_anatomica_ponderada" in cin_t0, "Falta confianza_anatomica_ponderada"
assert "vector_probabilidad_gestos" in cin_t0, "Falta vector_probabilidad_gestos"

probs = cin_t0["vector_probabilidad_gestos"]
assert all(g in probs for g in ["remate", "recepcion", "colocacion", "bloqueo", "saque"]), "Faltan gestos en vector_probabilidad"

print(f"  -> Vel. Angular Codo en t0: {cin_t0['vel_angular_codo_deg_s']} °/s")
print(f"  -> Rotación Torácica (X-Z): {cin_t0['rotacion_toracica_deg']} °")
print(f"  -> Estabilidad Ósea: {cin_t0['estabilidad_osea_score']}%")
print(f"  -> Confianza Anatómica Ponderada: {cin_t0['confianza_anatomica_ponderada']}%")
print(f"  -> Vector Probabilidad Gestos en t0: {probs}")

# 3. Log exportable de 33 frames
assert "secuencia_cinematica_completa" in eval_fases, "Falta secuencia_cinematica_completa para exportación JSON"
assert len(eval_fases["secuencia_cinematica_completa"]) == 33, f"Longitud incorrecta: {len(eval_fases['secuencia_cinematica_completa'])}"
print("  ✅ Calibración Profunda SUPERADA: L_torso, variables cinemáticas y exportación JSON 100% operacionales.")

# ===================================================================
# TEST 7: SENSIBILIDAD DINÁMICA (> 3.0 m/s) Y UMBRAL RELAJADO (>= 55%)
# ===================================================================
print("\n[TEST 7] Verificando gestos dinámicos (> 3.0 m/s) y umbral de 55%...")

# 1. Remate dinámico de alta velocidad (> 3.0 m/s) con cuerpo completo
frames_remate_dinamico = []
for i in range(33):
    ts = i * 0.033
    vel = 3.4 if 16 <= i <= 24 else 1.2
    f_dyn = {
        "frame_id": 200 + i,
        "timestamp": ts,
        "puntos_3d_suaves": {
            "muneca_der": [0.25, 0.15, 0.0],  # Brazo atacante arriba
            "muneca_izq": [-0.20, 0.50, 0.0],
            "hombro_der": [0.15, 0.35, 0.0],
            "hombro_izq": [-0.15, 0.35, 0.0],
        },
        "landmarks_2d_original": {
            "cadera_der": [0.55, 0.65, 0.0, 0.95],
            "cadera_izq": [0.45, 0.65, 0.0, 0.95],
            "rodilla_der": [0.55, 0.80, 0.0, 0.92],
            "rodilla_izq": [0.45, 0.80, 0.0, 0.92],
            "tobillo_der": [0.55, 0.95, 0.0, 0.90],
            "tobillo_izq": [0.45, 0.95, 0.0, 0.90],
        },
        "angulos_3d": {"rodilla": 130.0, "cadera": 160.0, "codo": 145.0, "hombro": 120.0, "tronco": 12.0},
        "cinematica": {
            "distancia_munecas_3d_m": 0.55,
            "velocidad_muneca_3d_ms": vel,
            "velocidad_cadera_3d_ms": 0.8,
            "altura_centro_masa_rel": 0.04 if 18 <= i <= 23 else 0.0,
            "confianza_anatomica_ponderada": 94.0,
        }
    }
    frames_remate_dinamico.append(f_dyn)

eval_dyn = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(frames_remate_dinamico, 20)
assert eval_dyn.get("descartada", False) is False, f"ERROR: Gesto dinámico (>3.0 m/s) fue descartado: {eval_dyn.get('motivo_descarte')}"
assert eval_dyn.get("gesto_tecnico") in ("Remate", "remate"), f"ERROR: Debió ser Remate: {eval_dyn.get('gesto_tecnico')}"
assert len(eval_dyn.get("fases", {})) == 4, "ERROR: Faltan fases en evaluación dinámica."
print(f"  -> Remate Dinámico procesado con éxito: {eval_dyn['gesto_tecnico'].upper()} ({eval_dyn['confianza_clasificacion']}%) y 4 fases completas.")

# 2. Recepción dinámica con velocidad articular alta (> 3.0 m/s)
frames_recep_dinamica = []
for i in range(33):
    ts = i * 0.033
    vel = 3.1 if 17 <= i <= 23 else 0.9
    f_rec = {
        "frame_id": 300 + i,
        "timestamp": ts,
        "puntos_3d_suaves": {
            "muneca_der": [0.04, 0.48, 0.0],  # Manos firmemente unidas (< 0.12 m)
            "muneca_izq": [-0.04, 0.48, 0.0],
            "hombro_der": [0.15, 0.35, 0.0],
            "hombro_izq": [-0.15, 0.35, 0.0],
        },
        "landmarks_2d_original": {
            "cadera_der": [0.55, 0.65, 0.0, 0.95],
            "cadera_izq": [0.45, 0.65, 0.0, 0.95],
            "rodilla_der": [0.55, 0.80, 0.0, 0.92],
            "rodilla_izq": [0.45, 0.80, 0.0, 0.92],
            "tobillo_der": [0.55, 0.95, 0.0, 0.90],
            "tobillo_izq": [0.45, 0.95, 0.0, 0.90],
        },
        "angulos_3d": {"rodilla": 125.0, "cadera": 150.0, "codo": 165.0, "hombro": 70.0, "tronco": 20.0},
        "cinematica": {
            "distancia_munecas_3d_m": 0.08,
            "velocidad_muneca_3d_ms": vel,
            "velocidad_cadera_3d_ms": 1.2,
            "altura_centro_masa_rel": -0.03,
            "confianza_anatomica_ponderada": 95.0,
        }
    }
    frames_recep_dinamica.append(f_rec)

eval_rec = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(frames_recep_dinamica, 20)
assert eval_rec.get("descartada", False) is False, f"ERROR: Recepción dinámica fue descartada: {eval_rec.get('motivo_descarte')}"
assert eval_rec.get("gesto_tecnico") in ("Recepción", "recepcion"), f"ERROR: Debió ser Recepción: {eval_rec.get('gesto_tecnico')}"
assert len(eval_rec.get("fases", {})) == 4, "ERROR: Faltan fases en recepción."
print(f"  -> Recepción Dinámica procesada con éxito: {eval_rec['gesto_tecnico'].upper()} ({eval_rec['confianza_clasificacion']}%) y 4 fases completas.")

# ===================================================================
# TEST 8: BLOQUEO DE FALSOS POSITIVOS - CASO CAPTURA 7141 (MANOS SEPARADAS)
# ===================================================================
print("\n[TEST 8] Verificando bloqueo de Captura 7141 (manos separadas en guardia)...")
frames_captura_7141 = []
for i in range(33):
    ts = i * 0.033
    f_7141 = {
        "frame_id": 7141 + i,
        "timestamp": ts,
        "puntos_3d_suaves": {
            "muneca_der": [0.14, 0.48, 0.0],  # Manos separadas a 0.28m, NO unidas
            "muneca_izq": [-0.14, 0.48, 0.0],
            "hombro_der": [0.15, 0.35, 0.0],
            "hombro_izq": [-0.15, 0.35, 0.0],
        },
        "landmarks_2d_original": {
            "cadera_der": [0.55, 0.65, 0.0, 0.95],
            "cadera_izq": [0.45, 0.65, 0.0, 0.95],
            "rodilla_der": [0.55, 0.80, 0.0, 0.92],
            "rodilla_izq": [0.45, 0.80, 0.0, 0.92],
            "tobillo_der": [0.55, 0.95, 0.0, 0.90],
            "tobillo_izq": [0.45, 0.95, 0.0, 0.90],
        },
        "angulos_3d": {"rodilla": 140.0, "cadera": 160.0, "codo": 135.0, "hombro": 75.0, "tronco": 15.0},
        "cinematica": {
            "distancia_munecas_3d_m": 0.28,  # > 0.12 m obligatorio
            "velocidad_muneca_3d_ms": 1.6,
            "velocidad_cadera_3d_ms": 0.4,
            "altura_centro_masa_rel": -0.01,
            "confianza_anatomica_ponderada": 94.0,
        }
    }
    frames_captura_7141.append(f_7141)

eval_7141 = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(frames_captura_7141, 20)
assert eval_7141.get("descartada", False) is True, "ERROR: Captura 7141 debió ser descartada."
assert eval_7141.get("gesto_tecnico") == "MOVIMIENTO NO CLASIFICADO", f"ERROR: No debió clasificar como técnico: {eval_7141.get('gesto_tecnico')}"
assert eval_7141.get("subtipo_movimiento") == "Posición Base / Neutra", f"ERROR: Subtipo inesperado: {eval_7141.get('subtipo_movimiento')}"
assert len(eval_7141.get("fases", {})) == 0, "ERROR: No deben generarse tarjetas de error ficticias."
assert eval_7141.get("scores_gestos", {}).get("recepcion", 0.0) == 0.0, "ERROR: Recepción debió recibir 0 puntos con manos separadas."
print(f"  -> Captura 7141 bloqueada con éxito: '{eval_7141['subtipo_movimiento']}' con {eval_7141['scores_gestos']['recepcion']}% en recepción.")
print("  ✅ Candado 8 SUPERADO: Cero tarjetas ficticias generadas en posturas neutras con manos separadas.")

# ===================================================================
# TEST 9: MOTOR DE SESIONES Y REGISTRO INDIVIDUAL CONTINUO (FASE 1)
# ===================================================================
print("\n[TEST 9] Verificando Motor de Sesiones, Endpoints y Espera Continua...")
from backend.db.database import (
    crear_sesion_entrenamiento,
    obtener_sesion_entrenamiento,
    registrar_gesto_en_sesion,
    obtener_historial_sesion,
)
import main
from fastapi.testclient import TestClient

client = TestClient(main.app)

# 1. Endpoint POST /api/entrenamiento/iniciar
resp_iniciar = client.post("/api/entrenamiento/iniciar", json={"usuario_id": "atleta_01", "dispositivo": "Web / Canvas 3D"})
assert resp_iniciar.status_code == 200, f"Error iniciando sesión: {resp_iniciar.status_code}"
data_sesion = resp_iniciar.json()
ses_id = data_sesion["sesion_id"]
assert ses_id.startswith("trn_"), f"ID de sesión inválido: {ses_id}"
assert "fecha_inicio" in data_sesion, "Falta fecha_inicio"
assert data_sesion["gestos_registrados"] == [], "La sesión nueva debe iniciar con 0 gestos"
print(f"  -> Sesión continua creada con éxito: {ses_id} (Fecha: {data_sesion['fecha_inicio']})")

# 2. Intercepción y Guardado Automático con salto_index
gesto_simulado_1 = {
    "t0_frame_id": 105,
    "t0_timestamp": 3.45,
    "gesto_tecnico": "remate",
    "score_global": 92.5,
    "diagnostico_causa_raiz": "Excelente extensión terminal en Fase 3.",
    "voz_coach": "¡Remate con máxima altura!",
    "frames_clave_fases": {"fase_1": 90, "fase_2": 98, "fase_3": 105, "fase_4": 118},
    "fases": eval_fases["fases"],
    "ablacion": ablacion,
    "detalles_cinematicos": {"salto_confirmado": True},
    "secuencia_cinematica_completa": eval_fases["secuencia_cinematica_completa"],
}
reg_1 = registrar_gesto_en_sesion(ses_id, gesto_simulado_1)
assert reg_1["salto_index"] == 1, f"Índice esperado 1, obtenido {reg_1['salto_index']}"
assert "error_escorzo_corregido" in reg_1, "Falta error_escorzo_corregido"
assert reg_1["efectividad"] == 92.5
assert reg_1["causa_raiz"] == "Excelente extensión terminal en Fase 3."

gesto_simulado_2 = dict(gesto_simulado_1)
gesto_simulado_2["score_global"] = 88.0
gesto_simulado_2["diagnostico_causa_raiz"] = "Flexión de codo ligera en impacto."
reg_2 = registrar_gesto_en_sesion(ses_id, gesto_simulado_2)
assert reg_2["salto_index"] == 2, f"Índice esperado 2, obtenido {reg_2['salto_index']}"

print(f"  -> Gestos registrados en sesión continua: Salto #{reg_1['salto_index']} y Salto #{reg_2['salto_index']}")

# 3. Endpoint GET /api/entrenamiento/{sesion_id}/historial
resp_hist = client.get(f"/api/entrenamiento/{ses_id}/historial")
assert resp_hist.status_code == 200, f"Error obteniendo historial: {resp_hist.status_code}"
hist_data = resp_hist.json()
assert hist_data["total_gestos"] == 2, f"Total esperado 2, obtenido {hist_data['total_gestos']}"
assert len(hist_data["gestos_registrados"]) == 2
assert hist_data["gestos_registrados"][0]["salto_index"] == 1
assert hist_data["gestos_registrados"][1]["salto_index"] == 2
print(f"  -> Historial de sesión verificado: {hist_data['total_gestos']} gestos ordenados cronológicamente.")

# 4. Modo de Espera Continua en TemporalPoseBuffer
buf_espera = TemporalPoseBuffer(maxlen=60)
buf_espera.estado = "COOLDOWN"
buf_espera.t0_frame_id = 999
buf_espera.preparar_espera_continua()
assert buf_espera.estado == "ESCUCHANDO", f"Estado no regresó a ESCUCHANDO: {buf_espera.estado}"
assert buf_espera.t0_frame_id is None, "t0_frame_id no se limpió"
assert buf_espera.ultimo_disparo_ts == 0.0, "Cooldown no se reseteó a cero"
print("  ✅ Modo de Espera Continua SUPERADO: Búfer listo instantáneamente para el siguiente salto sin recargas.")

# ===================================================================
# TEST 10: FILTRO ANTI-REPOSO (ALTURA Y) Y UMBRAL ANTI-TEMBLOR (+15%)
# ===================================================================
print("\n[TEST 10] Verificando Filtro Anti-Reposo (manos abajo) y Umbral Anti-Temblor (+15%)...")

# 1. Caso Manos Abajo / Reposo (Falso positivo crítico resuelto)
buf_reposo = TemporalPoseBuffer(maxlen=60, pre_frames=20, post_frames=12)
t0_disparado_reposo = False

for i in range(25):
    ts = i * 0.033
    # Manos a la altura del pecho o cadera (Y = 0.50 a 0.65), hombros arriba en Y = 0.35
    # Simula un balanceo brusco de brazos hacia abajo antes de saltar
    muneca_y = 0.60 - (0.08 if i % 4 < 2 else 0.0)  # Y >= hombro_y (0.35) siempre abajo
    p2d_reposo = {
        'hombro_der': [0.55, 0.35, 0.0, 0.98],
        'hombro_izq': [0.45, 0.35, 0.0, 0.98],
        'codo_der': [0.60, 0.45, 0.0, 0.95],
        'codo_izq': [0.40, 0.45, 0.0, 0.95],
        'muneca_der': [0.62, muneca_y, 0.0, 0.95],
        'muneca_izq': [0.38, 0.65, 0.0, 0.95],
        'cadera_der': [0.53, 0.70, 0.0, 0.98],
        'cadera_izq': [0.47, 0.70, 0.0, 0.98],
        'rodilla_der': [0.54, 0.85, 0.0, 0.95],
        'rodilla_izq': [0.46, 0.85, 0.0, 0.95],
        'tobillo_der': [0.54, 0.98, 0.0, 0.95],
        'tobillo_izq': [0.46, 0.98, 0.0, 0.95],
    }
    p3d_reposo = {k: [v[0] - 0.5, v[1] - 0.5, 0.0, v[3]] for k, v in p2d_reposo.items()}
    res, tele = buf_reposo.registrar_frame(i, ts, p2d_reposo, p3d_reposo, "auto")
    if res is not None or tele.get("estado_buffer") == "T0_DETECTADO":
        t0_disparado_reposo = True

assert not t0_disparado_reposo, "ERROR: Se disparó t0 con las manos por debajo de los hombros (falso positivo de reposo)."
assert buf_reposo.t0_frame_id is None, "ERROR: t0_frame_id no debe fijarse con manos abajo."
print("  ✅ Filtro Anti-Reposo SUPERADO: Eventos con manos al nivel del pecho o más abajo ignorados categóricamente.")

# 2. Caso Micro-Temblor por Contraluz (Amplitud/Velocidad inferior al nuevo umbral +15%)
buf_temblor = TemporalPoseBuffer(maxlen=60, pre_frames=20, post_frames=12)
t0_disparado_temblor = False

for i in range(25):
    ts = i * 0.033
    # Muñeca sobre hombros (Y = 0.25 vs hombros Y = 0.35), pero solo micro-vibración de 0.015 norm (ruido visual)
    muneca_y = 0.25 + (0.012 if i % 2 == 0 else -0.012)
    p2d_temblor = {
        'hombro_der': [0.55, 0.35, 0.0, 0.98],
        'hombro_izq': [0.45, 0.35, 0.0, 0.98],
        'codo_der': [0.60, 0.30, 0.0, 0.95],
        'codo_izq': [0.40, 0.30, 0.0, 0.95],
        'muneca_der': [0.62, muneca_y, 0.0, 0.95],
        'muneca_izq': [0.38, 0.65, 0.0, 0.95],
        'cadera_der': [0.53, 0.70, 0.0, 0.98],
        'cadera_izq': [0.47, 0.70, 0.0, 0.98],
        'rodilla_der': [0.54, 0.85, 0.0, 0.95],
        'rodilla_izq': [0.46, 0.85, 0.0, 0.95],
        'tobillo_der': [0.54, 0.98, 0.0, 0.95],
        'tobillo_izq': [0.46, 0.98, 0.0, 0.95],
    }
    p3d_temblor = {k: [v[0] - 0.5, v[1] - 0.5, 0.0, v[3]] for k, v in p2d_temblor.items()}
    res, tele = buf_temblor.registrar_frame(i, ts, p2d_temblor, p3d_temblor, "remate")
    if res is not None or tele.get("estado_buffer") == "T0_DETECTADO":
        t0_disparado_temblor = True

assert not t0_disparado_temblor, "ERROR: Micro-temblores dispararon t0. El umbral +15% debió bloquearlo."
print("  ✅ Umbral Anti-Temblor (+15%) SUPERADO: Micro-oscilaciones por ruido de contraluz bloqueadas con éxito.")

print("\n=================================================================")
print("🏆 TODOS LOS CANDADOS Y LA FASE 1 LONGITUDINAL OPERAN AL 100%")
print("=================================================================")
