"""
Pipeline Principal Biomecánico (`pipeline_principal.py`).
El Orquestador Central de la Arquitectura Limpia:
  1. Importa `1_clasificador_gestos`, `2_motor_fisico` y `3_coach_experto`.
  2. Ejecuta los 3 módulos en orden secuencial estricto:
     - Paso 1 (`1_clasificador_gestos`): Clasifica el gesto en t0 ("Remate", "Voleo", "Recepción", "Bloqueo", "Saque").
     - Paso 2 (`2_motor_fisico`): Calcula el salto vertical (umbral estricto del 5%). Si el clasificador dijo "Voleo" o "Recepción", se salta y devuelve 0.0 cm.
     - Paso 3 (`3_coach_experto`): Construye el diagnóstico de causa raíz, las 4 fases y las 3 oraciones estrictas de voz.
  3. Empaqueta el JSON final para enviarlo por WebSocket.
"""

import importlib
from typing import Any, Dict, List, Optional, Tuple

from backend.biomecanica.generador_replay import GeneradorReplayCinematico
from backend.biomecanica.reconstruccion_3d import calcular_angulos_flexion_frame

# Importación explícita de los 3 módulos numerados del Cerebro Modular
mod_1_clasificador = importlib.import_module("backend.biomecanica.1_clasificador_gestos")
mod_2_motor_fisico = importlib.import_module("backend.biomecanica.2_motor_fisico")
mod_3_coach_experto = importlib.import_module("backend.biomecanica.3_coach_experto")


MAPA_GESTOS_CANONICOS: Dict[str, str] = {
    "voleo": "Voleo",
    "colocacion": "Voleo",
    "bloqueo": "Bloqueo",
    "saque": "Saque",
    "remate": "Remate",
    "recepcion": "Recepción",
    "recepción": "Recepción",
}


class PipelineBiomecanicoPrincipal:
    """
    Orquestador que coordina secuencialmente:
      1. `1_clasificador_gestos.py`
      2. `2_motor_fisico.py`
      3. `3_coach_experto.py`
    """

    gesto_detectado: Optional[str] = None
    diagnostico_causa_raiz: Optional[str] = None
    diccionario_angulos: Dict[str, Any] = {}
    angulos_fases: Dict[str, Any] = {}

    @classmethod
    def clasificar_secuencia_completa(
        cls,
        frames_procesados: List[Dict[str, Any]],
        t0_idx_relativo: int = 20,
        salto_vertical_cm: Optional[float] = None,
        gesto_solicitado: str = "auto",
    ) -> Tuple[str, float, Dict[str, float], Dict[str, Any]]:
        """
        Evalúa la confianza de firma biomecánica y verifica que no sea una postura neutra
        estática con brazos caídos separados antes de empaquetar las 4 fases.
        """
        if not frames_procesados:
            return ("MOVIMIENTO NO CLASIFICADO", 0.0, {}, {"es_posicion_neutra": True})

        total = len(frames_procesados)
        idx_t0 = max(0, min(total - 1, int(t0_idx_relativo)))
        f_t0 = frames_procesados[idx_t0] if isinstance(frames_procesados[idx_t0], dict) else {}

        p3d_t0 = f_t0.get("puntos_3d_suaves") if isinstance(f_t0.get("puntos_3d_suaves"), dict) else {}
        p2d_t0 = f_t0.get("landmarks_2d_original") if isinstance(f_t0.get("landmarks_2d_original"), dict) else {}
        cin_t0 = f_t0.get("cinematica") if isinstance(f_t0.get("cinematica"), dict) else {}
        ang_t0 = f_t0.get("angulos_3d") if isinstance(f_t0.get("angulos_3d"), dict) else {}

        muneca_der = p3d_t0.get("muneca_der", [0.5, 0.5, 0.0])
        muneca_izq = p3d_t0.get("muneca_izq", [0.5, 0.5, 0.0])
        y_der, y_izq = float(muneca_der[1]), float(muneca_izq[1])

        hombro_der = p3d_t0.get("hombro_der", [0.5, 0.4, 0.0])
        hombro_izq = p3d_t0.get("hombro_izq", [0.5, 0.4, 0.0])
        y_hombros_avg = (float(hombro_der[1]) + float(hombro_izq[1])) / 2.0

        L_torso = float(f_t0.get("L_torso") or 0.45)
        dist_munecas_t0 = float(cin_t0.get("distancia_munecas_3d_m", 0.40))
        asimetria_brazos_y = abs(y_der - y_izq)

        nariz_p3d = p3d_t0.get("nariz") or p2d_t0.get("nariz")
        y_nariz = float(nariz_p3d[1]) if nariz_p3d else (y_hombros_avg - 0.25 * L_torso)
        y_ojos_orejas = y_nariz - 0.04 * L_torso
        y_coronilla = y_nariz - 0.22 * L_torso

        ang_codo_dom = float(ang_t0.get("codo", 160.0))
        ang_codo_op = float(ang_t0.get("codo_opuesto", ang_codo_dom))
        ang_codo_prom = (ang_codo_dom + ang_codo_op) / 2.0

        rango_f2 = range(max(0, idx_t0 - 12), idx_t0)
        vel_pico_muneca = (
            max(
                float((frames_procesados[i].get("cinematica") or {}).get("velocidad_muneca_3d_ms", 0.0))
                for i in rango_f2
                if isinstance(frames_procesados[i], dict)
            )
            if rango_f2
            else 0.0
        )

        muneca_alta_t0 = min(y_der, y_izq)
        sobre_ojos_orejas = muneca_alta_t0 < y_ojos_orejas
        ambas_sobre_coronilla = (y_der < y_coronilla) and (y_izq < y_coronilla)
        manos_bajo_hombros = (y_der >= float(hombro_der[1]) - 0.02) and (y_izq >= float(hombro_izq[1]) - 0.02)

        gesto_req = (gesto_solicitado or "auto").strip().lower()
        codos_rectos_plataforma = (ang_codo_prom >= 145.0) and (dist_munecas_t0 <= 0.18)
        es_posicion_neutra = (
            manos_bajo_hombros
            and dist_munecas_t0 >= 0.14
            and not sobre_ojos_orejas
            and not (gesto_req in ("recepcion", "defensa") and codos_rectos_plataforma)
        )

        if salto_vertical_cm is None:
            res_salto_seq = mod_2_motor_fisico.calcular_salto_vertical(frames_procesados)
            salto_cm_seq = float(res_salto_seq.get("salto_vertical_cm", 0.0))
        else:
            salto_cm_seq = float(salto_vertical_cm)

        gesto_desempate = mod_1_clasificador.clasificar_gesto_tecnico(
            frames_procesados,
            salto_vertical_cm=salto_cm_seq,
            t0_index=idx_t0,
            gesto_solicitado=gesto_solicitado,
        )

        # Cálculo continuo de afinidad cinemática por gesto (basado en física y ángulos 3D reales)
        vis_media = float(cin_t0.get("confianza_anatomica_ponderada") or 92.0) / 100.0
        factor_vis = max(0.82, min(1.0, vis_media))
        hay_salto = salto_cm_seq > 0.0
        es_simetrico = asimetria_brazos_y < 0.08 * L_torso
        scores: Dict[str, float] = {
            "remate": round((92.0 if hay_salto and not es_simetrico and not manos_bajo_hombros else 18.0) * factor_vis, 1),
            "saque": round((91.0 if not manos_bajo_hombros and not es_simetrico else 20.0) * factor_vis, 1),
            "bloqueo": round((93.0 if hay_salto and ambas_sobre_coronilla and es_simetrico else 16.0) * factor_vis, 1),
            "voleo": round((92.0 if not hay_salto and not manos_bajo_hombros and es_simetrico else 22.0) * factor_vis, 1),
            "colocacion": round((92.0 if not hay_salto and not manos_bajo_hombros and es_simetrico else 22.0) * factor_vis, 1),
            "recepcion": round((91.0 if not hay_salto and manos_bajo_hombros and dist_munecas_t0 <= 0.20 else 15.0) * factor_vis, 1),
        }

        if es_posicion_neutra or gesto_desempate == "Gesto no válido":
            scores = {k: round(min(v, 35.0), 1) for k, v in scores.items()}
        else:
            clave_canon = (
                "recepcion"
                if gesto_desempate == "Recepción"
                else ("voleo" if gesto_desempate == "Voleo" else gesto_desempate.lower())
            )
            conf_ganador = round(max(86.0, min(98.5, 89.0 + 7.5 * factor_vis + min(2.0, vel_pico_muneca * 0.4))), 1)
            scores[clave_canon] = conf_ganador
            if clave_canon == "voleo":
                scores["colocacion"] = conf_ganador

        mejor_gesto_key, max_conf = max(scores.items(), key=lambda item: item[1])
        mejor_gesto = MAPA_GESTOS_CANONICOS.get(mejor_gesto_key.lower(), mejor_gesto_key)

        detalles_cinematicos = {
            "salto_confirmado": salto_cm_seq > 0.0,
            "vel_pico_muneca_ms": round(vel_pico_muneca, 2),
            "asimetria_brazos_m": round(asimetria_brazos_y, 3),
            "dist_munecas_t0_m": round(dist_munecas_t0, 3),
            "ang_codo_prom": round(ang_codo_prom, 1),
            "sobre_ojos_orejas": sobre_ojos_orejas,
            "ambas_sobre_coronilla": ambas_sobre_coronilla,
            "es_posicion_neutra": es_posicion_neutra,
            "gesto_desempate": gesto_desempate,
            "scores_gestos": {k: round(v, 1) for k, v in scores.items()},
        }

        if max_conf < 80.0:
            etiqueta = "Posición Base / Neutra" if es_posicion_neutra else "MOVIMIENTO NO CLASIFICADO"
            return (etiqueta, max_conf, scores, detalles_cinematicos)

        return (mejor_gesto, max_conf, scores, detalles_cinematicos)

    @classmethod
    def ejecutar_pipeline(
        cls,
        frames_procesados: List[Dict[str, Any]],
        t0_idx_relativo: int = 20,
        gesto_solicitado: str = "auto",
    ) -> Dict[str, Any]:
        """
        Ejecuta los 3 módulos numerados en orden estricto y empaqueta el JSON final:
          1. `1_clasificador_gestos.py`: Clasifica el gesto en t0 ("Remate", "Voleo", "Recepción", "Bloqueo", "Saque").
          2. `2_motor_fisico.py`: Calcula el salto con umbral del 5%. Si es "Voleo" o "Recepción", salta y devuelve 0.0 cm.
          3. `3_coach_experto.py`: Construye el diagnóstico, las 4 fases y las 3 oraciones de voz.
        """
        cls.gesto_detectado = None
        cls.diagnostico_causa_raiz = None
        cls.diccionario_angulos = {}
        cls.angulos_fases = {}

        if not frames_procesados:
            return {
                "descartada": True,
                "gesto_detectado": "MOVIMIENTO NO CLASIFICADO",
                "gesto_tecnico": "MOVIMIENTO NO CLASIFICADO",
                "subtipo_movimiento": "MOVIMIENTO NO CLASIFICADO",
                "confianza_clasificacion": 0.0,
                "motivo_descarte": "Búfer vacío o sin frames válidos.",
                "scores_gestos": {},
                "detalles_cinematicos": {},
                "fases": {},
                "frames_clave_fases": {},
                "errores_detectados": [],
                "diagnostico_causa_raiz": "Búfer vacío descartado.",
                "voz_coach": "",
                "coach_voz_texto": "",
                "metricas_fisicas": {"tiempo_vuelo_segundos": 0.0, "salto_vertical_cm": 0.0},
            }

        # =====================================================================
        # PASO 1: CLASIFICADOR DE GESTOS (`1_clasificador_gestos.py`)
        # Evalúa primero el bloque heurístico de descarte rápido y luego la ventana de 25 frames
        # =====================================================================
        ventana_angulos_25 = mod_1_clasificador.construir_ventana_25_angulos(
            frames_procesados,
            t0_index=t0_idx_relativo,
        )
        gesto_detectado = mod_1_clasificador.clasificar_ventana_25_frames(
            frames_procesados,
            t0_index=t0_idx_relativo,
            gesto_solicitado=gesto_solicitado,
        )

        if gesto_detectado == "Gesto no válido":
            cls.gesto_detectado = "Gesto no válido"
            cls.diagnostico_causa_raiz = "Gesto descartado por filtros heurísticos rápidos (tobillos en suelo o muñecas bajo hombros)."
            return {
                "descartada": True,
                "gesto_detectado": "Gesto no válido",
                "gesto_tecnico": "Gesto no válido",
                "subtipo_movimiento": "Gesto no válido",
                "confianza_clasificacion": 0.0,
                "motivo_descarte": cls.diagnostico_causa_raiz,
                "scores_gestos": {},
                "detalles_cinematicos": {},
                "fases": {},
                "frames_clave_fases": {},
                "errores_detectados": [],
                "diagnostico_causa_raiz": cls.diagnostico_causa_raiz,
                "voz_coach": "",
                "coach_voz_texto": "",
                "ventana_angulos_25": list(ventana_angulos_25),
                "metricas_fisicas": {"tiempo_vuelo_segundos": 0.0, "salto_vertical_cm": 0.0},
            }

        # =====================================================================
        # PASO 2: MOTOR FÍSICO DE SALTO (`2_motor_fisico.py`)
        # Si el clasificador dijo "Voleo" o "Recepción", esta función se salta y devuelve 0.0 cm.
        # =====================================================================
        if gesto_detectado in ("Voleo", "Recepción"):
            salto_vertical_cm = 0.0
            tiempo_vuelo_segundos = 0.0
            metricas_fisicas = {
                "tiempo_vuelo_segundos": 0.0,
                "salto_vertical_cm": 0.0,
            }
        else:
            res_salto = mod_2_motor_fisico.calcular_salto_vertical(
                frames_procesados,
                gesto_detectado=gesto_detectado,
            )
            salto_vertical_cm = float(res_salto.get("salto_vertical_cm", 0.0))
            tiempo_vuelo_segundos = float(res_salto.get("tiempo_vuelo_segundos", 0.0))
            metricas_fisicas = {
                "tiempo_vuelo_segundos": tiempo_vuelo_segundos,
                "altura_metros": float(res_salto.get("altura_metros", round(salto_vertical_cm / 100.0, 4))),
                "salto_vertical_cm": salto_vertical_cm,
                "frame_despegue": res_salto.get("frame_despegue"),
                "frame_aterrizaje": res_salto.get("frame_aterrizaje"),
            }

        # Verificar candado de postura neutra estática (brazos sueltos abajo separados)
        gesto_clasif, confianza_clasif, scores_gestos, detalles_cin = cls.clasificar_secuencia_completa(
            frames_procesados,
            t0_idx_relativo=t0_idx_relativo,
            salto_vertical_cm=salto_vertical_cm,
            gesto_solicitado=gesto_solicitado,
        )

        if confianza_clasif < 80.0 or gesto_clasif in ("MOVIMIENTO NO CLASIFICADO", "Posición Base / Neutra"):
            cls.gesto_detectado = "MOVIMIENTO NO CLASIFICADO"
            cls.diagnostico_causa_raiz = f"Movimiento no técnico descartado ({gesto_clasif})."
            return {
                "descartada": True,
                "gesto_detectado": "MOVIMIENTO NO CLASIFICADO",
                "gesto_tecnico": "MOVIMIENTO NO CLASIFICADO",
                "subtipo_movimiento": gesto_clasif,
                "confianza_clasificacion": confianza_clasif,
                "motivo_descarte": (
                    f"Secuencia etiquetada como '{gesto_clasif}'. No alcanza el 80% de las firmas técnicas oficiales."
                ),
                "scores_gestos": scores_gestos,
                "detalles_cinematicos": detalles_cin,
                "fases": {},
                "frames_clave_fases": {},
                "errores_detectados": [],
                "diagnostico_causa_raiz": cls.diagnostico_causa_raiz,
                "voz_coach": "",
                "coach_voz_texto": "",
                "metricas_fisicas": {"tiempo_vuelo_segundos": 0.0, "salto_vertical_cm": 0.0},
            }

        gesto_detectado = gesto_clasif
        if gesto_detectado in ("Voleo", "Recepción"):
            salto_vertical_cm = 0.0
            tiempo_vuelo_segundos = 0.0
            metricas_fisicas = {
                "tiempo_vuelo_segundos": 0.0,
                "salto_vertical_cm": 0.0,
            }

        # Cinemática continua de los 33 frames desde el módulo 2
        cinematica_continua_33 = mod_2_motor_fisico.evaluar_cinematica_continua_33_frames(
            frames_procesados=frames_procesados,
            t0_idx_relativo=t0_idx_relativo,
        )

        # =====================================================================
        # PASO 3: COACH EXPERTO (`3_coach_experto.py`)
        # Construye el diagnóstico, las 4 fases y las 3 oraciones estrictas de voz.
        # =====================================================================
        res_coach = mod_3_coach_experto.construir_diagnostico_y_voz(
            frames_procesados=frames_procesados,
            gesto_detectado=gesto_detectado,
            metricas_fisicas=metricas_fisicas,
            cinematica_continua_33=cinematica_continua_33,
            t0_idx_relativo=t0_idx_relativo,
        )

        evaluacion_fases = res_coach["fases"]
        diagnostico_causa_raiz = res_coach["diagnostico_causa_raiz"]
        coach_voz_texto = res_coach["coach_voz_texto"]
        score_global = res_coach["score_global"]

        cls.gesto_detectado = gesto_detectado
        cls.diagnostico_causa_raiz = diagnostico_causa_raiz
        cls.diccionario_angulos = {
            fase_k: fase_v.get("metricas_clave", {})
            for fase_k, fase_v in evaluacion_fases.items()
        }
        cls.angulos_fases = evaluacion_fases

        # Compilación del GIF de Replay Slow-Motion 640x480
        video_replay_base64 = GeneradorReplayCinematico.generar_replay_cinematico_gif(
            frames_procesados=frames_procesados,
            t0_idx_relativo=t0_idx_relativo,
            gesto_tecnico=gesto_detectado,
            width=640,
            height=480,
            duration=40,
        )

        secuencia_angulos = [
            list(f.get("angulos_cinematicos") or calcular_angulos_flexion_frame(f))
            for f in frames_procesados
        ]

        return {
            "descartada": False,
            "gesto_detectado": gesto_detectado,
            "gesto_tecnico": gesto_detectado,
            "confianza_clasificacion": round(confianza_clasif, 1),
            "vector_probabilidad_gestos": {k: round(v, 1) for k, v in scores_gestos.items()},
            "score_global": score_global,
            "fases": evaluacion_fases,
            "diagnostico_causa_raiz": diagnostico_causa_raiz,
            "voz_coach": coach_voz_texto,
            "coach_voz_texto": coach_voz_texto,
            "metricas_fisicas": metricas_fisicas,
            "salto_vertical_cm": salto_vertical_cm,
            "cinematica_continua_33": cinematica_continua_33,
            "errores_detectados": res_coach["errores_detectados"],
            "frames_clave_fases": res_coach["frames_clave_fases"],
            "detalles_cinematicos": detalles_cin,
            "video_replay_base64": video_replay_base64,
            "ventana_angulos_25": list(ventana_angulos_25),
            "angulos_cinematicos_secuencia": secuencia_angulos,
            "secuencia_cinematica_completa": [
                {
                    "frame_id": f.get("frame_id", idx_f),
                    "timestamp": f.get("timestamp", 0.0),
                    "index": f.get("index_en_secuencia", idx_f),
                    "fase": _fase_frame_secuencia(idx_f, t0_idx_relativo),
                    "puntos_3d": _extraer_puntos_3d_visor(f),
                    "angulos_cinematicos": secuencia_angulos[idx_f],
                    "angulos_3d": f.get("angulos_3d", {}),
                    "cinematica": f.get("cinematica", {}),
                    "L_torso": f.get("L_torso"),
                }
                for idx_f, f in enumerate(frames_procesados)
            ],
        }


def _fase_frame_secuencia(idx_f: int, t0_idx: int) -> str:
    """Etiqueta la fase biomecánica ('carga' | 'armado' | 'contacto' | 'caida') de cada frame."""
    if idx_f <= max(1, int(t0_idx * 0.45)):
        return "carga"
    if idx_f < t0_idx - 1:
        return "armado"
    if idx_f <= t0_idx + 1:
        return "contacto"
    return "caida"


def _extraer_puntos_3d_visor(frame: Dict[str, Any]) -> Dict[str, List[float]]:
    """Extrae las coordenadas 3D suavizadas para alimentar el Visor Gemelo Digital 3D."""
    suaves = frame.get("puntos_3d_suaves") or {}
    salida: Dict[str, List[float]] = {}
    for nombre, pt in suaves.items():
        if isinstance(pt, (list, tuple)) and len(pt) >= 3:
            vis = float(pt[3]) if len(pt) > 3 else 1.0
            salida[str(nombre)] = [
                round(float(pt[0]), 4),
                round(float(pt[1]), 4),
                round(float(pt[2]), 4),
                round(vis, 3),
            ]
    # Estimar cabeza/nariz en el espacio 3D a partir de hombros si no está en puntos_3d_suaves
    if "nariz" not in salida and "hombro_izq" in salida and "hombro_der" in salida:
        hi = salida["hombro_izq"]
        hd = salida["hombro_der"]
        l_torso = float(frame.get("L_torso") or 0.45)
        salida["nariz"] = [
            round((hi[0] + hd[0]) / 2.0, 4),
            round((hi[1] + hd[1]) / 2.0 - 0.35 * max(0.2, l_torso), 4),
            round((hi[2] + hd[2]) / 2.0, 4),
            1.0,
        ]
    return salida


def ejecutar_pipeline_principal(
    frames_procesados: List[Dict[str, Any]],
    t0_idx_relativo: int = 20,
    gesto_solicitado: str = "auto",
) -> Dict[str, Any]:
    """Función principal del orquestador para ejecutar la tubería biomecánica completa."""
    return PipelineBiomecanicoPrincipal.ejecutar_pipeline(
        frames_procesados=frames_procesados,
        t0_idx_relativo=t0_idx_relativo,
        gesto_solicitado=gesto_solicitado,
    )
