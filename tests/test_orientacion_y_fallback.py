import os
import sys
import unittest
from unittest.mock import MagicMock, patch

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica.buffer_temporal import TemporalPoseBuffer
from backend.biomecanica.evaluador_fases import EvaluadorFasesBiomecanicas
import backend.db.database as db
from main import app
from fastapi.testclient import TestClient

def test_candado_orientacion_corporal():
    print("Testing Candado de Orientación Corporal...")
    
    # 1. Caso Usuario de Espaldas por Baja Visibilidad de Ojos (< 0.70)
    buf_espaldas_vis = TemporalPoseBuffer(maxlen=60, pre_frames=20, post_frames=12)
    bloqueado_vis = False
    for i in range(20):
        ts = i * 0.033
        p2d = {
            'nariz': [0.50, 0.20, 0.0, 0.30],
            'ojo_1': [0.48, 0.19, 0.0, 0.25],      # Visibilidad ojos < 0.70
            'ojo_2': [0.47, 0.19, 0.0, 0.20],
            'ojo_3': [0.46, 0.19, 0.0, 0.15],
            'ojo_4': [0.52, 0.19, 0.0, 0.25],
            'hombro_der': [0.55, 0.40, 0.0, 0.95],
            'hombro_izq': [0.45, 0.40, 0.0, 0.95],
            'codo_der': [0.60, 0.35, 0.0, 0.90],
            'codo_izq': [0.40, 0.35, 0.0, 0.90],
            'muneca_der': [0.62, 0.20, 0.0, 0.95],
            'muneca_izq': [0.38, 0.55, 0.0, 0.95],
            'cadera_der': [0.53, 0.70, 0.0, 0.95],
            'cadera_izq': [0.47, 0.70, 0.0, 0.95],
            'rodilla_der': [0.54, 0.85, 0.0, 0.95],
            'rodilla_izq': [0.46, 0.85, 0.0, 0.95],
            'tobillo_der': [0.54, 0.98, 0.0, 0.90],
            'tobillo_izq': [0.46, 0.98, 0.0, 0.90],
        }
        p3d = {k: [v[0] - 0.5, v[1] - 0.5, v[2], v[3]] for k, v in p2d.items()}
        res, tele = buf_espaldas_vis.registrar_frame(i, ts, p2d, p3d, "remate")
        if tele.get("estado_buffer") == "USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL":
            bloqueado_vis = True

    assert bloqueado_vis, "Debe emitir estado 'USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL' por visibilidad de ojos < 0.70."
    assert buf_espaldas_vis.t0_frame_id is None, "ERROR: No debe permitirse t0 cuando el usuario está de espaldas."
    print("  ✅ Candado Orientación: Usuario bloqueado por visibilidad de ojos < 0.70 ('USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL').")

    # 2. Caso Usuario de Espaldas por Posición Espacial Z (Nariz detrás de Hombros)
    buf_espaldas_z = TemporalPoseBuffer(maxlen=60, pre_frames=20, post_frames=12)
    bloqueado_z = False
    for i in range(20):
        ts = i * 0.033
        p2d = {
            'nariz': [0.50, 0.20, 0.15, 0.95],       # Z = +0.15 (más lejos de la cámara que hombros)
            'ojo_1': [0.48, 0.19, 0.12, 0.95],
            'ojo_2': [0.47, 0.19, 0.12, 0.95],
            'ojo_3': [0.46, 0.19, 0.12, 0.95],
            'ojo_4': [0.52, 0.19, 0.12, 0.95],
            'hombro_der': [0.55, 0.40, -0.05, 0.95], # Z = -0.05 (más cerca de la cámara)
            'hombro_izq': [0.45, 0.40, -0.05, 0.95],
            'codo_der': [0.60, 0.35, 0.0, 0.90],
            'codo_izq': [0.40, 0.35, 0.0, 0.90],
            'muneca_der': [0.62, 0.20, 0.0, 0.95],
            'muneca_izq': [0.38, 0.55, 0.0, 0.95],
            'cadera_der': [0.53, 0.70, 0.0, 0.95],
            'cadera_izq': [0.47, 0.70, 0.0, 0.95],
            'rodilla_der': [0.54, 0.85, 0.0, 0.95],
            'rodilla_izq': [0.46, 0.85, 0.0, 0.95],
            'tobillo_der': [0.54, 0.98, 0.0, 0.90],
            'tobillo_izq': [0.46, 0.98, 0.0, 0.90],
        }
        p3d = {k: [v[0] - 0.5, v[1] - 0.5, v[2], v[3]] for k, v in p2d.items()}
        res, tele = buf_espaldas_z.registrar_frame(i, ts, p2d, p3d, "remate")
        if tele.get("estado_buffer") == "USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL":
            bloqueado_z = True

    assert bloqueado_z, "Debe emitir estado 'USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL' por Z_nariz > Z_hombros."
    assert buf_espaldas_z.t0_frame_id is None, "ERROR: No debe permitirse t0 con nariz detrás de los hombros."
    print("  ✅ Candado Orientación: Usuario bloqueado por nariz espacialmente detrás de los hombros.")

    # 3. Caso Usuario de Frente Correcto
    buf_frente = TemporalPoseBuffer(maxlen=60, pre_frames=20, post_frames=12)
    p2d_frente = {
        'nariz': [0.50, 0.20, -0.08, 0.95],     # Z = -0.08 (al frente de los hombros)
        'ojo_1': [0.48, 0.19, -0.06, 0.95],
        'ojo_2': [0.47, 0.19, -0.06, 0.95],
        'ojo_3': [0.46, 0.19, -0.06, 0.95],
        'ojo_4': [0.52, 0.19, -0.06, 0.95],
        'hombro_der': [0.55, 0.40, 0.02, 0.95], # Z = 0.02
        'hombro_izq': [0.45, 0.40, 0.02, 0.95],
        'cadera_der': [0.53, 0.70, 0.0, 0.95],
        'cadera_izq': [0.47, 0.70, 0.0, 0.95],
        'rodilla_der': [0.54, 0.85, 0.0, 0.95],
        'rodilla_izq': [0.46, 0.85, 0.0, 0.95],
        'tobillo_der': [0.54, 0.98, 0.0, 0.90],
        'tobillo_izq': [0.46, 0.98, 0.0, 0.90],
    }
    p3d_frente = {k: [v[0] - 0.5, v[1] - 0.5, v[2], v[3]] for k, v in p2d_frente.items()}
    res, tele = buf_frente.registrar_frame(1, 0.033, p2d_frente, p3d_frente, "remate")
    assert tele.get("estado_buffer") != "USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL", "Usuario de frente no debe bloquearse."
    print("  ✅ Candado Orientación: Usuario de frente aceptado sin bloqueo.")

def test_supabase_fallback():
    print("\nTesting Fallback en Memoria RAM para Supabase y memoria_respaldo_sesion...")
    
    # Simular fallo 401 en Supabase
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.insert.side_effect = Exception("Invalid API key (401 Unauthorized)")
    mock_table.select.side_effect = Exception("Invalid API key (401 Unauthorized)")

    with patch.object(db, "supabase", mock_supabase):
        # 1. Crear sesión debe tener éxito en memoria RAM
        sesion = db.crear_sesion_entrenamiento("user_test", "Web 3D")
        assert sesion is not None
        assert "sesion_id" in sesion
        sesion_id = sesion["sesion_id"]
        print(f"  ✅ Sesión creada en RAM a pesar de error 401 en Supabase: {sesion_id}")

        # 2. Registrar gesto en sesión
        eval_demo = {
            "t0_frame_id": 105,
            "gesto_tecnico": "remate",
            "score_global": 92.5,
            "diagnostico_causa_raiz": "Excelente coordinación.",
            "fases": {"fase_3": {"score": 95.0}},
            "ablacion": {}
        }
        item = db.registrar_gesto_en_sesion(sesion_id, eval_demo)
        assert item["salto_index"] == 1
        assert item["efectividad"] == 92.5
        assert len(db.memoria_respaldo_sesion) > 0, "Debe registrarse en memoria_respaldo_sesion"
        print("  ✅ Gesto registrado en RAM y memoria_respaldo_sesion a pesar de error 401 en Supabase.")

        # 3. Probar guardar_salto_con_fallback directamente
        res_guardar = db.guardar_salto_con_fallback(sesion_id, {"salto_num": 7, "score": 88.0})
        assert res_guardar["status"] == "ok"
        assert res_guardar["codigo"] == 200
        print("  ✅ guardar_salto_con_fallback retorna status: ok y código: 200 con fallback en RAM.")

        # 4. Probar endpoints de FastAPI con TestClient
        client = TestClient(app)
        resp_post = client.post("/api/entrenamiento/iniciar")
        assert resp_post.status_code == 200
        s_id_api = resp_post.json()["sesion_id"]

        resp_salto = client.post(f"/api/entrenamiento/{s_id_api}/salto", json={"gesto": "bloqueo", "score": 90.0})
        assert resp_salto.status_code == 200
        assert resp_salto.json()["codigo"] == 200
        print("  ✅ Endpoint POST /api/entrenamiento/{id}/salto responde 200 OK con fallback activo.")

        resp_get = client.get(f"/api/entrenamiento/{s_id_api}/historial")
        assert resp_get.status_code == 200
        assert resp_get.json()["total_gestos"] == 0
        print("  ✅ Endpoint GET /api/entrenamiento/{id}/historial responde 200 OK.")

def test_purga_estricta_clasificador():
    print("\nTesting Purga Estricta del Clasificador...")
    # Simular estado sucio remanente de un salto previo (ej. Salto #7)
    EvaluadorFasesBiomecanicas.gesto_detectado = "REMANENTE_SALTO_7"
    EvaluadorFasesBiomecanicas.diagnostico_causa_raiz = "DIAGNOSTICO_ANTIGUO_SALTO_7"
    EvaluadorFasesBiomecanicas.diccionario_angulos = {"rodilla_falsa": 999.0}
    EvaluadorFasesBiomecanicas.angulos_fases = {"fase_1": {"score": 0.0}}

    # Generar secuencia sintética para Salto #8 (descartada o clasificada)
    frames_sinteticos = []
    for f_idx in range(33):
        frames_sinteticos.append({
            "frame_id": f_idx,
            "timestamp": f_idx * 0.033,
            "puntos_3d_suaves": {
                "nariz": [0.0, 0.0, -0.05],
                "muneca_der": [0.1, 0.2, 0.0],
                "muneca_izq": [-0.1, 0.2, 0.0],
                "hombro_der": [0.2, 0.4, 0.0],
                "hombro_izq": [-0.2, 0.4, 0.0],
                "cadera_der": [0.15, 0.8, 0.0],
                "cadera_izq": [-0.15, 0.8, 0.0],
                "rodilla_der": [0.15, 1.2, 0.0],
                "rodilla_izq": [-0.15, 1.2, 0.0],
                "tobillo_der": [0.15, 1.5, 0.0],
                "tobillo_izq": [-0.15, 1.5, 0.0],
            },
            "angulos_3d": {"codo": 170.0, "rodilla": 110.0, "cadera": 140.0},
            "cinematica": {"distancia_munecas_3d_m": 0.35},
            "L_torso": 0.45,
        })

    # Evaluar: Debe purgar inmediatamente las variables al inicio
    res = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(frames_sinteticos, 20, "remate")
    
    assert EvaluadorFasesBiomecanicas.gesto_detectado != "REMANENTE_SALTO_7", "El gesto previo del Salto #7 no fue purgado."
    assert EvaluadorFasesBiomecanicas.diagnostico_causa_raiz != "DIAGNOSTICO_ANTIGUO_SALTO_7", "El diagnóstico del Salto #7 no fue purgado."
    assert "rodilla_falsa" not in EvaluadorFasesBiomecanicas.diccionario_angulos, "Los ángulos del Salto #7 persistieron en el clasificador."
    print("  ✅ Purga Estricta: Reseteo explícito de gesto, causa raíz y diccionarios de ángulos verificado sin arrastre métrico.")

if __name__ == "__main__":
    test_candado_orientacion_corporal()
    test_supabase_fallback()
    test_purga_estricta_clasificador()
    print("\n🏆 TODOS LOS TESTS DE ORIENTACIÓN VECTORIAL, FALLBACK Y PURGA SUPERADOS AL 100%!")
