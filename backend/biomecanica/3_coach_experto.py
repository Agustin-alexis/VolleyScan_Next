"""
Módulo 3: Coach Experto y Diagnóstico de Causa Raíz (`3_coach_experto.py`).
ÚNICA RESPONSABILIDAD:
  - Recibir el gesto detectado ("Remate", "Voleo", "Recepción", "Bloqueo", "Saque") y las métricas cinemáticas/físicas.
  - Construir la segmentación evaluada de las 4 fases, el string de diagnóstico (`diagnostico_causa_raiz`)
    y las 3 oraciones estrictas del asistente de voz (`coach_voz_texto`):
      1. "Detecté un [Gesto]."
      2. (Solo si salto > 0) "Tu salto fue de [X] cm."
      3. "[Consejo basado en codo/rodilla]"
"""

import importlib
from typing import Any, Dict, List, Optional

_mod_motor = importlib.import_module("backend.biomecanica.2_motor_fisico")


MAPA_GESTOS_VOZ: Dict[str, str] = {
    "remate": "Remate",
    "bloqueo": "Bloqueo",
    "voleo": "Voleo",
    "colocacion": "Voleo",
    "colocación": "Voleo",
    "recepcion": "Recepción",
    "recepción": "Recepción",
    "saque": "Saque",
}


class CoachExpertoBiomecanico:
    """
    Traductor clínico y pedagógico de métricas biomecánicas a:
      - Diagnóstico de causa raíz (`diagnostico_causa_raiz`)
      - Evaluación estructurada de las 4 fases (`fases`)
      - Voz de 3 oraciones estrictas (`coach_voz_texto`)
    """

    @classmethod
    def generar_voz_3_oraciones(
        cls,
        metricas_33_frames: Any,
        gesto_detectado: str = "Remate",
        metricas_fisicas: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Construye el string de voz con estructura estricta de 3 oraciones:
          1. "Detecté un [Gesto]."
          2. (Solo si salto > 0) "Tu salto fue de [X] cm."
          3. "[Consejo basado en codo/rodilla]"
        """
        mod_motor = _mod_motor

        salto_cm_detectado = 0.0
        if isinstance(metricas_fisicas, dict) and metricas_fisicas.get("salto_vertical_cm") is not None:
            salto_cm_detectado = float(metricas_fisicas.get("salto_vertical_cm", 0.0))

        gesto_raw = str(gesto_detectado or "").strip()

        if isinstance(metricas_33_frames, list):
            metricas = mod_motor.evaluar_cinematica_continua_33_frames(metricas_33_frames)
            if salto_cm_detectado <= 0.0:
                fisicas_calc = mod_motor.calcular_salto_vertical(metricas_33_frames, gesto_detectado=gesto_raw)
                salto_cm_detectado = float(fisicas_calc.get("salto_vertical_cm", 0.0))
        elif isinstance(metricas_33_frames, dict):
            if not gesto_raw or gesto_raw.lower() == "remate":
                gesto_en_dict = metricas_33_frames.get("gesto_detectado") or metricas_33_frames.get("gesto_tecnico")
                if gesto_en_dict:
                    gesto_raw = str(gesto_en_dict).strip()

            if salto_cm_detectado <= 0.0:
                if "salto_vertical_cm" in metricas_33_frames:
                    salto_cm_detectado = float(metricas_33_frames.get("salto_vertical_cm") or 0.0)
                elif isinstance(metricas_33_frames.get("metricas_fisicas"), dict):
                    salto_cm_detectado = float(
                        metricas_33_frames["metricas_fisicas"].get("salto_vertical_cm") or 0.0
                    )

            if "angulos_codo_33" in metricas_33_frames and "estado_suavidad" in metricas_33_frames:
                metricas = metricas_33_frames
            else:
                codos = (
                    metricas_33_frames.get("angulos_codo_33")
                    or metricas_33_frames.get("angulos_codo")
                    or metricas_33_frames.get("codo")
                    or [170.0] * 33
                )
                rodillas = (
                    metricas_33_frames.get("angulos_rodilla_33")
                    or metricas_33_frames.get("angulos_rodilla")
                    or metricas_33_frames.get("rodilla")
                    or [110.0] * 33
                )
                frames_temp = [
                    {"angulos_3d": {"codo": c, "rodilla": r}}
                    for c, r in zip(codos, rodillas)
                ]
                metricas = mod_motor.evaluar_cinematica_continua_33_frames(frames_temp)
                if "es_movimiento_brusco" in metricas_33_frames:
                    metricas["es_movimiento_brusco"] = bool(metricas_33_frames["es_movimiento_brusco"])
                if "estado_suavidad" in metricas_33_frames:
                    metricas["estado_suavidad"] = metricas_33_frames["estado_suavidad"]
                if "max_extension_codo_impacto" in metricas_33_frames:
                    metricas["max_extension_codo_impacto"] = float(metricas_33_frames["max_extension_codo_impacto"])
                if "min_flexion_rodilla_preparacion" in metricas_33_frames:
                    metricas["min_flexion_rodilla_preparacion"] = float(
                        metricas_33_frames["min_flexion_rodilla_preparacion"]
                    )
        else:
            metricas = mod_motor.evaluar_cinematica_continua_33_frames([])

        gesto_canonico = MAPA_GESTOS_VOZ.get(gesto_raw.lower(), gesto_raw if gesto_raw else "Remate")

        # Cortafuegos estricto de voz: Voleo y Recepción jamás pronuncian salto
        if gesto_canonico in ("Voleo", "Recepción"):
            salto_cm_detectado = 0.0

        es_brusco = (
            metricas.get("es_movimiento_brusco", False)
            or metricas.get("estado_suavidad") == "Movimiento errático/Peligro de lesión"
        )
        max_codo = float(metricas.get("max_extension_codo_impacto", 170.0))
        min_rodilla = float(metricas.get("min_flexion_rodilla_preparacion", 110.0))

        # Oración 1: "Detecté un [Gesto]."
        oracion_gesto = f"Detecté un {gesto_canonico}."

        # Oración 2 (Solo si salto > 0): "Tu salto fue de [X] cm."
        salto_redondeado = (
            int(round(salto_cm_detectado))
            if salto_cm_detectado >= 0.5
            else (round(salto_cm_detectado, 1) if salto_cm_detectado > 0.0 else 0)
        )
        oracion_salto = (
            f"Tu salto fue de {salto_redondeado} cm."
            if salto_cm_detectado > 0.0 and salto_redondeado > 0
            else ""
        )

        # Oración 3: "[Consejo basado en codo/rodilla]"
        if es_brusco:
            oracion_consejo = (
                "Suaviza la extensión del codo y acompaña con las rodillas como un látigo suave sin movimientos bruscos de robot."
            )
        elif max_codo < 155.0:
            oracion_consejo = (
                "Estira el codo bien alto al impactar en vez de dejar el brazo encogido como un tiranosaurio rex para alcanzar el techo."
            )
        elif min_rodilla > 140.0:
            oracion_consejo = (
                "Flexiona más las rodillas como un resorte antes del esfuerzo para no saltar con las piernas de palo."
            )
        else:
            oracion_consejo = (
                "Excelente extensión del codo y flexión de rodillas como un resorte hasta tocar el cielo con un movimiento súper suave."
            )

        partes = [oracion_gesto]
        if oracion_salto:
            partes.append(oracion_salto)
        partes.append(oracion_consejo)
        return " ".join(partes)

    @classmethod
    def segmentar_en_4_fases_exactas(
        cls,
        frames_procesados: List[Dict[str, Any]],
        t0_idx_relativo: int = 20,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Partición exacta en 4 sub-rangos disjuntos para que las 4 tarjetas del visor
        jamás repitan el mismo frame_id:
          - Fase 1 (Preparación): [0 : 10]
          - Fase 2 (Salto y Armado): [11 : 18]
          - Fase 3 (Contacto Crítico): Exactamente t0 (índice 20)
          - Fase 4 (Finalización): [25 : 32]
        """
        total = len(frames_procesados)
        idx_t0 = max(0, min(total - 1, t0_idx_relativo))

        fin_f1 = min(10, max(0, idx_t0 - 2))
        rango_f1 = list(range(0, fin_f1 + 1)) if fin_f1 >= 0 else [0]
        idx_fase1 = min(rango_f1, key=lambda i: float((frames_procesados[i].get("angulos_3d") or {}).get("rodilla", 120.0)))

        ini_f2 = min(11, idx_t0 - 1)
        fin_f2 = max(ini_f2, min(18, idx_t0 - 1))
        rango_f2 = list(range(ini_f2, fin_f2 + 1))
        idx_fase2 = min(rango_f2, key=lambda i: float((frames_procesados[i].get("angulos_3d") or {}).get("codo", 110.0)))
        if idx_fase2 == idx_fase1 and len(rango_f2) > 1:
            idx_fase2 = rango_f2[-1]
        elif idx_fase2 == idx_fase1:
            idx_fase2 = min(total - 1, idx_fase1 + 1)

        idx_fase3 = idx_t0

        ini_f4 = min(total - 1, max(idx_t0 + 2, 25))
        fin_f4 = total - 1
        rango_f4 = list(range(ini_f4, fin_f4 + 1)) if fin_f4 >= ini_f4 else [total - 1]
        idx_fase4 = min(rango_f4, key=lambda i: float((frames_procesados[i].get("angulos_3d") or {}).get("rodilla", 130.0)))
        if idx_fase4 <= idx_fase3:
            idx_fase4 = min(total - 1, idx_fase3 + 1)

        return {
            "fase_1": {
                "numero": 1,
                "nombre": "Preparación",
                "subtitulo": "Aproximación y Flexión de Rodillas",
                "rango_indices": [0, fin_f1],
                "frame_clave_idx": idx_fase1,
                "frame_clave": frames_procesados[idx_fase1],
                "frame_id": frames_procesados[idx_fase1].get("frame_id", idx_fase1),
                "timestamp": frames_procesados[idx_fase1].get("timestamp", 0.0),
            },
            "fase_2": {
                "numero": 2,
                "nombre": "Salto y Armado",
                "subtitulo": "Transición de Despegue y Retracción del Brazo",
                "rango_indices": [ini_f2, fin_f2],
                "frame_clave_idx": idx_fase2,
                "frame_clave": frames_procesados[idx_fase2],
                "frame_id": frames_procesados[idx_fase2].get("frame_id", idx_fase2),
                "timestamp": frames_procesados[idx_fase2].get("timestamp", 0.0),
            },
            "fase_3": {
                "numero": 3,
                "nombre": "Contacto Crítico",
                "subtitulo": "Instante Crítico (t0) y Extensión en Impacto",
                "rango_indices": [idx_t0, idx_t0],
                "frame_clave_idx": idx_fase3,
                "frame_clave": frames_procesados[idx_fase3],
                "frame_id": frames_procesados[idx_fase3].get("frame_id", idx_fase3),
                "timestamp": frames_procesados[idx_fase3].get("timestamp", 0.0),
            },
            "fase_4": {
                "numero": 4,
                "nombre": "Finalización",
                "subtitulo": "Seguimiento y Mecánica de Aterrizaje Bilateral",
                "rango_indices": [ini_f4, fin_f4],
                "frame_clave_idx": idx_fase4,
                "frame_clave": frames_procesados[idx_fase4],
                "frame_id": frames_procesados[idx_fase4].get("frame_id", idx_fase4),
                "timestamp": frames_procesados[idx_fase4].get("timestamp", 0.0),
            },
        }

    @classmethod
    def construir_diagnostico_y_fases(
        cls,
        frames_procesados: List[Dict[str, Any]],
        gesto_detectado: str,
        metricas_fisicas: Dict[str, Any],
        cinematica_continua_33: Dict[str, Any],
        t0_idx_relativo: int = 20,
    ) -> Dict[str, Any]:
        """
        Recibe el gesto detectado y las métricas, evalúa las 4 fases y construye
        el string de diagnóstico de causa raíz + las 3 oraciones estrictas de voz.
        """
        fases = cls.segmentar_en_4_fases_exactas(frames_procesados, t0_idx_relativo)
        evaluacion_fases: Dict[str, Any] = {}
        errores_detectados: List[Dict[str, Any]] = []

        def _estado_score(val: float) -> str:
            if val >= 80.0:
                return "Óptimo"
            if val >= 65.0:
                return "Advertencia"
            return "Deficiente"

        gesto_low = str(gesto_detectado or "remate").lower().strip()
        f1_frame = fases["fase_1"]["frame_clave"]
        f2_frame = fases["fase_2"]["frame_clave"]
        f3_frame = fases["fase_3"]["frame_clave"]
        f4_frame = fases["fase_4"]["frame_clave"]

        if gesto_low in ("remate", "saque", "bloqueo"):
            # --- FASE 1: PREPARACIÓN ---
            ang_rodilla_f1 = float((f1_frame.get("angulos_3d") or {}).get("rodilla", 120.0))
            ang_cadera_f1 = float((f1_frame.get("angulos_3d") or {}).get("cadera", 155.0))
            f1_errores = []
            max_rod_opt = 148.0 if gesto_low == "saque" else 128.0
            pen_factor = 1.6 if gesto_low == "saque" else 2.0

            if ang_rodilla_f1 > max_rod_opt:
                f1_score = max(45.0, min(95.0, 96.0 - (ang_rodilla_f1 - max_rod_opt) * pen_factor))
                f1_estado = _estado_score(f1_score)
                error_txt = f"Flexión de rodilla superficial ({round(ang_rodilla_f1, 1)}°), resta potencia al impulso."
                f1_errores.append(error_txt)
                errores_detectados.append({"fase": 1, "articulacion": "rodilla", "descripcion": error_txt})
            elif ang_rodilla_f1 < 80.0:
                f1_score = max(55.0, min(88.0, 88.0 - (80.0 - ang_rodilla_f1) * 1.5))
                f1_estado = _estado_score(f1_score)
                error_txt = f"Flexión muy profunda ({round(ang_rodilla_f1, 1)}°), ralentiza el despegue."
                f1_errores.append(error_txt)
                errores_detectados.append({"fase": 1, "articulacion": "rodilla", "descripcion": error_txt})
            else:
                f1_score = max(84.0, min(98.0, 98.0 - abs(ang_rodilla_f1 - 110.0) * 0.28))
                f1_estado = "Óptimo"

            evaluacion_fases["fase_1"] = {
                "nombre": fases["fase_1"]["nombre"],
                "subtitulo": fases["fase_1"]["subtitulo"],
                "frame_id": fases["fase_1"]["frame_id"],
                "timestamp": fases["fase_1"]["timestamp"],
                "score": round(f1_score, 1),
                "estado": f1_estado,
                "metricas_clave": {
                    "angulo_rodilla_3d": round(ang_rodilla_f1, 1),
                    "angulo_cadera_3d": round(ang_cadera_f1, 1),
                    "rango_optimo_rodilla": "105° - 145°" if gesto_low == "saque" else "95° - 125°",
                },
                "errores": f1_errores,
                "diagnostico": "Carga de piernas firme para despegar con potencia." if not f1_errores else f1_errores[0],
            }

            # --- FASE 2: SALTO Y ARMADO ---
            ang_codo_f2 = float((f2_frame.get("angulos_3d") or {}).get("codo", 110.0))
            ang_hombro_f2 = float((f2_frame.get("angulos_3d") or {}).get("hombro", 110.0))
            ang_hombro_op_f2 = float((f2_frame.get("angulos_3d") or {}).get("hombro_opuesto", ang_hombro_f2))
            vel_muneca_f2 = float((f2_frame.get("cinematica") or {}).get("velocidad_muneca_3d_ms", 1.5))
            f2_errores = []

            if gesto_low == "bloqueo":
                hom_media_f2 = (ang_hombro_f2 + ang_hombro_op_f2) / 2.0
                asym_h_f2 = abs(ang_hombro_f2 - ang_hombro_op_f2)
                if hom_media_f2 < 90.0:
                    f2_score = max(48.0, min(90.0, 92.0 - (95.0 - hom_media_f2) * 1.6))
                    f2_estado = _estado_score(f2_score)
                    error_txt = f"Manos aún bajas al subir al bloqueo ({round(hom_media_f2, 1)}°)."
                    f2_errores.append(error_txt)
                    errores_detectados.append({"fase": 2, "articulacion": "hombro", "descripcion": error_txt})
                elif asym_h_f2 > 28.0:
                    f2_score = max(55.0, min(88.0, 92.0 - (asym_h_f2 - 18.0) * 1.4))
                    f2_estado = _estado_score(f2_score)
                    error_txt = f"Sube ambos brazos al mismo tiempo al armar el bloqueo (diferencia {round(asym_h_f2, 1)}°)."
                    f2_errores.append(error_txt)
                    errores_detectados.append({"fase": 2, "articulacion": "hombro", "descripcion": error_txt})
                else:
                    f2_score = max(84.0, min(97.0, 97.0 - asym_h_f2 * 0.4))
                    f2_estado = "Óptimo"
            else:
                if ang_hombro_f2 < 95.0:
                    f2_score = max(45.0, min(90.0, 95.0 - (95.0 - ang_hombro_f2) * 1.25))
                    f2_estado = _estado_score(f2_score)
                    error_txt = f"Codo retrasado o caído en el armado ({round(ang_hombro_f2, 1)}° respecto al torso)."
                    f2_errores.append(error_txt)
                    errores_detectados.append({"fase": 2, "articulacion": "hombro", "descripcion": error_txt})
                elif ang_codo_f2 > 142.0:
                    f2_score = max(58.0, min(88.0, 92.0 - (ang_codo_f2 - 135.0) * 1.2))
                    f2_estado = _estado_score(f2_score)
                    error_txt = f"Brazo extendido demasiado pronto en el armado ({round(ang_codo_f2, 1)}°)."
                    f2_errores.append(error_txt)
                    errores_detectados.append({"fase": 2, "articulacion": "codo", "descripcion": error_txt})
                else:
                    f2_score = max(84.0, min(97.0, 96.0 - max(0.0, 115.0 - ang_hombro_f2) * 0.25))
                    f2_estado = "Óptimo"

            evaluacion_fases["fase_2"] = {
                "nombre": fases["fase_2"]["nombre"],
                "subtitulo": fases["fase_2"]["subtitulo"],
                "frame_id": fases["fase_2"]["frame_id"],
                "timestamp": fases["fase_2"]["timestamp"],
                "score": round(f2_score, 1),
                "estado": f2_estado,
                "metricas_clave": {
                    "angulo_codo_armado_3d": round(ang_codo_f2, 1),
                    "angulo_hombro_elevacion_3d": round(ang_hombro_f2, 1),
                    "velocidad_ascenso_ms": round(vel_muneca_f2, 2),
                },
                "errores": f2_errores,
                "diagnostico": "Buena elevación y preparación del brazo para golpear." if not f2_errores else f2_errores[0],
            }

            # --- FASE 3: CONTACTO CRÍTICO (t0) ---
            ang_codo_f3 = float((f3_frame.get("angulos_3d") or {}).get("codo", 165.0))
            ang_codo_op_f3 = float((f3_frame.get("angulos_3d") or {}).get("codo_opuesto", ang_codo_f3))
            ang_hombro_f3 = float((f3_frame.get("angulos_3d") or {}).get("hombro", 155.0))
            ang_tronco_f3 = float((f3_frame.get("angulos_3d") or {}).get("tronco", 8.0))
            vel_muneca_f3 = float((f3_frame.get("cinematica") or {}).get("velocidad_muneca_3d_ms", 2.0))
            f3_errores = []

            if gesto_low == "bloqueo":
                codo_eval_f3 = (ang_codo_f3 + ang_codo_op_f3) / 2.0
                min_codo_opt = 148.0
                if codo_eval_f3 < min_codo_opt:
                    f3_score = max(45.0, min(90.0, 94.0 - (min_codo_opt - codo_eval_f3) * 1.4))
                    f3_estado = _estado_score(f3_score)
                    error_txt = f"Estira más ambos codos sobre la red al bloquear ({round(codo_eval_f3, 1)}°)."
                    f3_errores.append(error_txt)
                    errores_detectados.append({"fase": 3, "articulacion": "codo", "descripcion": error_txt})
                elif ang_hombro_f3 < 130.0:
                    f3_score = max(55.0, min(88.0, 92.0 - (135.0 - ang_hombro_f3) * 1.1))
                    f3_estado = _estado_score(f3_score)
                    error_txt = f"Empuja los hombros más arriba sobre la red ({round(ang_hombro_f3, 1)}°)."
                    f3_errores.append(error_txt)
                    errores_detectados.append({"fase": 3, "articulacion": "hombro", "descripcion": error_txt})
                else:
                    f3_score = max(86.0, min(98.0, 90.0 + min(8.0, (codo_eval_f3 - min_codo_opt) * 0.3)))
                    f3_estado = "Óptimo"
            else:
                if ang_codo_f3 < 155.0:
                    f3_score = max(45.0, min(90.0, 95.0 - (162.0 - ang_codo_f3) * 1.45))
                    f3_estado = _estado_score(f3_score)
                    error_txt = f"Impacto con codo encogido ({round(ang_codo_f3, 1)}° vs óptimo 165°-180°), resta altura al golpe."
                    f3_errores.append(error_txt)
                    errores_detectados.append({"fase": 3, "articulacion": "codo", "descripcion": error_txt})
                elif ang_hombro_f3 < 135.0:
                    f3_score = max(55.0, min(88.0, 92.0 - (140.0 - ang_hombro_f3) * 1.15))
                    f3_estado = _estado_score(f3_score)
                    error_txt = f"Sube más el brazo y el hombro al golpear ({round(ang_hombro_f3, 1)}°)."
                    f3_errores.append(error_txt)
                    errores_detectados.append({"fase": 3, "articulacion": "hombro", "descripcion": error_txt})
                else:
                    f3_score = max(86.0, min(99.0, 91.0 + min(8.0, (ang_codo_f3 - 155.0) * 0.35)))
                    f3_estado = "Óptimo"

            evaluacion_fases["fase_3"] = {
                "nombre": fases["fase_3"]["nombre"],
                "subtitulo": fases["fase_3"]["subtitulo"],
                "frame_id": fases["fase_3"]["frame_id"],
                "timestamp": fases["fase_3"]["timestamp"],
                "score": round(f3_score, 1),
                "estado": f3_estado,
                "metricas_clave": {
                    "angulo_codo_contacto_3d": round(ang_codo_f3, 1),
                    "angulo_hombro_contacto_3d": round(ang_hombro_f3, 1),
                    "inclinacion_tronco_3d": round(ang_tronco_f3, 1),
                    "velocidad_impacto_ms": round(vel_muneca_f3, 2),
                },
                "errores": f3_errores,
                "diagnostico": "Contacto arriba con brazo bien estirado." if not f3_errores else f3_errores[0],
            }

            # --- FASE 4: FINALIZACIÓN Y AMORTIGUACIÓN ---
            ang_rodilla_f4 = float((f4_frame.get("angulos_3d") or {}).get("rodilla", 130.0))
            ang_rodilla_op_f4 = float((f4_frame.get("angulos_3d") or {}).get("rodilla_opuesta", ang_rodilla_f4))
            f4_errores = []
            discrepancia_bilateral = abs(ang_rodilla_f4 - ang_rodilla_op_f4)

            if ang_rodilla_f4 > 162.0 or ang_rodilla_op_f4 > 162.0:
                max_r4 = max(ang_rodilla_f4, ang_rodilla_op_f4)
                f4_score = max(48.0, min(82.0, 92.0 - (max_r4 - 155.0) * 1.9))
                f4_estado = _estado_score(f4_score)
                error_txt = f"Aterrizaje con rodillas demasiado rectas ({round(max_r4, 1)}°), dobla suave al caer."
                f4_errores.append(error_txt)
                errores_detectados.append({"fase": 4, "articulacion": "rodilla", "descripcion": error_txt})
            elif discrepancia_bilateral > 22.0:
                f4_score = max(55.0, min(86.0, 92.0 - (discrepancia_bilateral - 15.0) * 1.4))
                f4_estado = _estado_score(f4_score)
                error_txt = f"Caída dispareja entre piernas (diferencia de {round(discrepancia_bilateral, 1)}°), apoya ambos pies juntos."
                f4_errores.append(error_txt)
                errores_detectados.append({"fase": 4, "articulacion": "rodilla", "descripcion": error_txt})
            else:
                f4_score = max(84.0, min(97.0, 96.0 - discrepancia_bilateral * 0.45))
                f4_estado = "Óptimo"

            evaluacion_fases["fase_4"] = {
                "nombre": fases["fase_4"]["nombre"],
                "subtitulo": fases["fase_4"]["subtitulo"],
                "frame_id": fases["fase_4"]["frame_id"],
                "timestamp": fases["fase_4"]["timestamp"],
                "score": round(f4_score, 1),
                "estado": f4_estado,
                "metricas_clave": {
                    "angulo_rodilla_aterrizaje_3d": round(ang_rodilla_f4, 1),
                    "angulo_rodilla_opuesta_3d": round(ang_rodilla_op_f4, 1),
                    "asimetria_bilateral_grados": round(discrepancia_bilateral, 1),
                },
                "errores": f4_errores,
                "diagnostico": "Aterrizaje suave y equilibrado en ambos pies." if not f4_errores else f4_errores[0],
            }
        elif gesto_low in ("voleo", "colocacion", "colocación"):
            # --- VOLEO (PASE DE DEDOS): Evaluación específica en 4 fases ---
            ang_rodilla_f1 = float((f1_frame.get("angulos_3d") or {}).get("rodilla", 132.0))
            ang_cadera_f1 = float((f1_frame.get("angulos_3d") or {}).get("cadera", 160.0))
            f1_errores = []
            if ang_rodilla_f1 > 162.0:
                f1_score = max(55.0, min(88.0, 94.0 - (ang_rodilla_f1 - 155.0) * 1.8))
                f1_errores.append(f"Flexiona un poco las rodillas para ayudar al empuje del voleo ({round(ang_rodilla_f1, 1)}°).")
                errores_detectados.append({"fase": 1, "articulacion": "rodilla", "descripcion": f1_errores[0]})
            elif ang_rodilla_f1 < 85.0:
                f1_score = 72.0
                f1_errores.append(f"Bajaste demasiado en sentadilla para un voleo ({round(ang_rodilla_f1, 1)}°).")
                errores_detectados.append({"fase": 1, "articulacion": "rodilla", "descripcion": f1_errores[0]})
            else:
                f1_score = max(84.0, min(97.0, 96.0 - abs(ang_rodilla_f1 - 128.0) * 0.25))
            evaluacion_fases["fase_1"] = {
                "nombre": fases["fase_1"]["nombre"],
                "subtitulo": "Base equilibrada de voleo",
                "frame_id": fases["fase_1"]["frame_id"],
                "timestamp": fases["fase_1"]["timestamp"],
                "score": round(f1_score, 1),
                "estado": _estado_score(f1_score),
                "metricas_clave": {"angulo_rodilla_3d": round(ang_rodilla_f1, 1), "angulo_cadera_3d": round(ang_cadera_f1, 1)},
                "errores": f1_errores,
                "diagnostico": f1_errores[0] if f1_errores else "Buena postura lista debajo del balón.",
            }

            ang_codo_f2 = float((f2_frame.get("angulos_3d") or {}).get("codo", 105.0))
            ang_hombro_f2 = float((f2_frame.get("angulos_3d") or {}).get("hombro", 110.0))
            f2_errores = []
            if ang_hombro_f2 < 75.0:
                f2_score = max(52.0, min(88.0, 92.0 - (80.0 - ang_hombro_f2) * 1.4))
                f2_errores.append(f"Sube las manos frente a la frente antes de recibir el balón ({round(ang_hombro_f2, 1)}°).")
                errores_detectados.append({"fase": 2, "articulacion": "hombro", "descripcion": f2_errores[0]})
            elif ang_codo_f2 > 145.0:
                f2_score = max(60.0, min(88.0, 92.0 - (ang_codo_f2 - 135.0) * 1.3))
                f2_errores.append(f"Flexiona suavemente los codos sobre la frente en triángulo ({round(ang_codo_f2, 1)}°).")
                errores_detectados.append({"fase": 2, "articulacion": "codo", "descripcion": f2_errores[0]})
            else:
                f2_score = max(84.0, min(97.0, 96.0 - abs(ang_codo_f2 - 102.0) * 0.25))
            evaluacion_fases["fase_2"] = {
                "nombre": fases["fase_2"]["nombre"],
                "subtitulo": "Ventana de dedos sobre frente",
                "frame_id": fases["fase_2"]["frame_id"],
                "timestamp": fases["fase_2"]["timestamp"],
                "score": round(f2_score, 1),
                "estado": _estado_score(f2_score),
                "metricas_clave": {"angulo_codo_armado_3d": round(ang_codo_f2, 1), "angulo_hombro_elevacion_3d": round(ang_hombro_f2, 1)},
                "errores": f2_errores,
                "diagnostico": f2_errores[0] if f2_errores else "Manos bien ubicadas arriba de la frente.",
            }

            ang_codo_f3 = float((f3_frame.get("angulos_3d") or {}).get("codo", 155.0))
            ang_codo_op_f3 = float((f3_frame.get("angulos_3d") or {}).get("codo_opuesto", ang_codo_f3))
            ang_hombro_f3 = float((f3_frame.get("angulos_3d") or {}).get("hombro", 135.0))
            asym_v_f3 = abs(ang_codo_f3 - ang_codo_op_f3)
            codo_v_prom = (ang_codo_f3 + ang_codo_op_f3) / 2.0
            f3_errores = []
            if codo_v_prom < 135.0:
                f3_score = max(48.0, min(88.0, 94.0 - (140.0 - codo_v_prom) * 1.4))
                f3_errores.append(f"Extiende más ambos codos al empujar el balón hacia arriba ({round(codo_v_prom, 1)}°).")
                errores_detectados.append({"fase": 3, "articulacion": "codo", "descripcion": f3_errores[0]})
            elif asym_v_f3 > 25.0:
                f3_score = max(58.0, min(88.0, 92.0 - (asym_v_f3 - 15.0) * 1.3))
                f3_errores.append(f"Empuja con los dos brazos igual de parejos (diferencia {round(asym_v_f3, 1)}°).")
                errores_detectados.append({"fase": 3, "articulacion": "codo", "descripcion": f3_errores[0]})
            else:
                f3_score = max(86.0, min(98.0, 96.0 - asym_v_f3 * 0.35))
            evaluacion_fases["fase_3"] = {
                "nombre": fases["fase_3"]["nombre"],
                "subtitulo": "Extensión simétrica en voleo",
                "frame_id": fases["fase_3"]["frame_id"],
                "timestamp": fases["fase_3"]["timestamp"],
                "score": round(f3_score, 1),
                "estado": _estado_score(f3_score),
                "metricas_clave": {"angulo_codo_contacto_3d": round(codo_v_prom, 1), "angulo_hombro_contacto_3d": round(ang_hombro_f3, 1)},
                "errores": f3_errores,
                "diagnostico": f3_errores[0] if f3_errores else "Empuje parejo y suave con ambos brazos.",
            }

            ang_rodilla_f4 = float((f4_frame.get("angulos_3d") or {}).get("rodilla", 145.0))
            ang_rodilla_op_f4 = float((f4_frame.get("angulos_3d") or {}).get("rodilla_opuesta", ang_rodilla_f4))
            asim_v_f4 = abs(ang_rodilla_f4 - ang_rodilla_op_f4)
            f4_errores = []
            if asim_v_f4 > 22.0:
                f4_score = max(58.0, min(88.0, 92.0 - (asim_v_f4 - 14.0) * 1.2))
                f4_errores.append("Mantén el peso repartido por igual entre ambos pies al terminar el voleo.")
                errores_detectados.append({"fase": 4, "articulacion": "rodilla", "descripcion": f4_errores[0]})
            else:
                f4_score = max(85.0, min(97.0, 96.0 - asim_v_f4 * 0.4))
            evaluacion_fases["fase_4"] = {
                "nombre": fases["fase_4"]["nombre"],
                "subtitulo": "Seguimiento del pase",
                "frame_id": fases["fase_4"]["frame_id"],
                "timestamp": fases["fase_4"]["timestamp"],
                "score": round(f4_score, 1),
                "estado": _estado_score(f4_score),
                "metricas_clave": {"angulo_rodilla_aterrizaje_3d": round(ang_rodilla_f4, 1), "asimetria_bilateral_grados": round(asim_v_f4, 1)},
                "errores": f4_errores,
                "diagnostico": f4_errores[0] if f4_errores else "Acompañamiento firme hacia tu compañero.",
            }
        else:
            # --- RECEPCIÓN (GOLPE DE ANTEBRAZOS): 100% medido desde ángulos y distancias reales ---
            ang_rod_r1 = float((f1_frame.get("angulos_3d") or {}).get("rodilla", 118.0))
            ang_cad_r1 = float((f1_frame.get("angulos_3d") or {}).get("cadera", 138.0))
            r1_errores = []
            if ang_rod_r1 > 142.0:
                r1_score = max(48.0, min(88.0, 94.0 - (ang_rod_r1 - 132.0) * 1.6))
                r1_errores.append(f"Baja un poco más las rodillas para recibir el balón ({round(ang_rod_r1, 1)}°).")
                errores_detectados.append({"fase": 1, "articulacion": "rodilla", "descripcion": r1_errores[0]})
            else:
                r1_score = max(84.0, min(97.0, 96.0 - abs(ang_rod_r1 - 110.0) * 0.3))
            evaluacion_fases["fase_1"] = {
                "nombre": "Postura Base",
                "subtitulo": "Centro bajo y estable",
                "frame_id": fases["fase_1"]["frame_id"],
                "timestamp": fases["fase_1"]["timestamp"],
                "score": round(r1_score, 1),
                "estado": _estado_score(r1_score),
                "metricas_clave": {"angulo_rodilla_3d": round(ang_rod_r1, 1), "angulo_cadera_3d": round(ang_cad_r1, 1)},
                "errores": r1_errores,
                "diagnostico": r1_errores[0] if r1_errores else "Posición baja firme para defender.",
            }

            dist_r2 = float((f2_frame.get("cinematica") or {}).get("distancia_munecas_3d_m", 0.14))
            ang_codo_r2 = float((f2_frame.get("angulos_3d") or {}).get("codo", 160.0))
            r2_errores = []
            if dist_r2 > 0.20:
                r2_score = max(50.0, min(86.0, 92.0 - (dist_r2 - 0.14) * 180.0))
                r2_errores.append("Junta más rápido las manos y antebrazos antes de que llegue el balón.")
                errores_detectados.append({"fase": 2, "articulacion": "hombro", "descripcion": r2_errores[0]})
            else:
                r2_score = max(84.0, min(97.0, 96.0 - max(0.0, 165.0 - ang_codo_r2) * 0.3))
            evaluacion_fases["fase_2"] = {
                "nombre": "Lectura y Acople",
                "subtitulo": "Alineación corporal",
                "frame_id": fases["fase_2"]["frame_id"],
                "timestamp": fases["fase_2"]["timestamp"],
                "score": round(r2_score, 1),
                "estado": _estado_score(r2_score),
                "metricas_clave": {"angulo_codo_armado_3d": round(ang_codo_r2, 1), "distancia_munecas_m": round(dist_r2, 3)},
                "errores": r2_errores,
                "diagnostico": r2_errores[0] if r2_errores else "Buen acople de brazos a tiempo.",
            }

            dist_munecas = float((f3_frame.get("cinematica") or {}).get("distancia_munecas_3d_m", 0.10))
            ang_codo_rec = float((f3_frame.get("angulos_3d") or {}).get("codo", 168.0))
            ang_hombro_rec = float((f3_frame.get("angulos_3d") or {}).get("hombro", 75.0))
            f3_errores = []
            if dist_munecas > 0.14:
                f3_score = max(50.0, min(85.0, 92.0 - (dist_munecas - 0.10) * 190.0))
                f3_errores.append("Sella más las muñecas para armar una plataforma firme de antebrazos.")
                errores_detectados.append({"fase": 3, "articulacion": "codo", "descripcion": f3_errores[0]})
            elif ang_codo_rec < 158.0:
                f3_score = max(48.0, min(86.0, 94.0 - (165.0 - ang_codo_rec) * 1.8))
                f3_errores.append(f"Estira por completo los codos al recibir ({round(ang_codo_rec, 1)}° vs >165°).")
                errores_detectados.append({"fase": 3, "articulacion": "codo", "descripcion": f3_errores[0]})
            else:
                f3_score = max(86.0, min(98.0, 92.0 + min(6.0, (ang_codo_rec - 158.0) * 0.3)))
            evaluacion_fases["fase_3"] = {
                "nombre": "Contacto con Balón",
                "subtitulo": "Plataforma de pase",
                "frame_id": fases["fase_3"]["frame_id"],
                "timestamp": fases["fase_3"]["timestamp"],
                "score": round(f3_score, 1),
                "estado": _estado_score(f3_score),
                "metricas_clave": {"angulo_codo_contacto_3d": round(ang_codo_rec, 1), "angulo_hombro_contacto_3d": round(ang_hombro_rec, 1), "distancia_munecas_m": round(dist_munecas, 3)},
                "errores": f3_errores,
                "diagnostico": f3_errores[0] if f3_errores else "Plataforma de antebrazos firme y plana.",
            }

            ang_rod_r4 = float((f4_frame.get("angulos_3d") or {}).get("rodilla", 132.0))
            ang_rod_op_r4 = float((f4_frame.get("angulos_3d") or {}).get("rodilla_opuesta", ang_rod_r4))
            asim_r4 = abs(ang_rod_r4 - ang_rod_op_r4)
            r4_errores = []
            if asim_r4 > 20.0:
                r4_score = max(55.0, min(88.0, 92.0 - (asim_r4 - 12.0) * 1.3))
                r4_errores.append("Mantén ambos pies firmes en el suelo al acompañar el pase.")
                errores_detectados.append({"fase": 4, "articulacion": "rodilla", "descripcion": r4_errores[0]})
            else:
                r4_score = max(84.0, min(97.0, 96.0 - asim_r4 * 0.45))
            evaluacion_fases["fase_4"] = {
                "nombre": "Acompañamiento",
                "subtitulo": "Dirección del pase",
                "frame_id": fases["fase_4"]["frame_id"],
                "timestamp": fases["fase_4"]["timestamp"],
                "score": round(r4_score, 1),
                "estado": _estado_score(r4_score),
                "metricas_clave": {"angulo_rodilla_aterrizaje_3d": round(ang_rod_r4, 1), "asimetria_bilateral_grados": round(asim_r4, 1)},
                "errores": r4_errores,
                "diagnostico": r4_errores[0] if r4_errores else "Acompañamiento suave hacia el armador.",
            }

        # Construcción del string de diagnóstico de causa raíz
        diagnostico_causa_raiz = "Técnica fluida y encadenamiento cinemático sin fallas biomecánicas críticas."

        f1_bad = evaluacion_fases["fase_1"]["score"] < 80.0
        f2_bad = evaluacion_fases["fase_2"]["score"] < 80.0
        f3_bad = evaluacion_fases["fase_3"]["score"] < 80.0
        f4_bad = evaluacion_fases["fase_4"]["score"] < 80.0

        if f1_bad and f3_bad:
            r1_txt = evaluacion_fases["fase_1"]["metricas_clave"].get("angulo_rodilla_3d", "")
            c3_txt = evaluacion_fases["fase_3"]["metricas_clave"].get("angulo_codo_contacto_3d", "")
            diagnostico_causa_raiz = (
                f"Al empezar con rodillas poco flexionadas ({r1_txt}°) faltó impulso, y el brazo llegó encogido al golpe ({c3_txt}°)."
            )
        elif f2_bad and f3_bad:
            h2_txt = evaluacion_fases["fase_2"]["metricas_clave"].get(
                "angulo_hombro_elevacion_3d",
                evaluacion_fases["fase_2"]["metricas_clave"].get("angulo_codo_armado_3d", ""),
            )
            diagnostico_causa_raiz = (
                f"El brazo quedó un poco bajo al prepararse en Fase 2 ({h2_txt}°) y no alcanzó a estirarse completo en Fase 3."
            )
        elif f3_bad:
            c3_txt = evaluacion_fases["fase_3"]["metricas_clave"].get("angulo_codo_contacto_3d", "")
            diagnostico_causa_raiz = (
                f"El contacto fue con el codo algo doblado en Fase 3 ({c3_txt}°). Estira todo el brazo para ganar altura."
            )
        elif f4_bad:
            r4_txt = evaluacion_fases["fase_4"]["metricas_clave"].get("angulo_rodilla_aterrizaje_3d", "")
            diagnostico_causa_raiz = (
                f"Caída con rodillas rígidas en Fase 4 ({r4_txt}°). Dobla suave ambas piernas por igual al aterrizar."
            )
        elif f1_bad:
            diagnostico_causa_raiz = "Flexiona un poquito más las rodillas en Fase 1 para impulsar con más fuerza."

        if cinematica_continua_33.get("es_movimiento_brusco", False):
            errores_detectados.append({
                "fase": 0,
                "articulacion": "cadena_cinetica_33f",
                "descripcion": (
                    f"Movimiento errático/Peligro de lesión (pico de derivada angular: "
                    f"{cinematica_continua_33.get('max_derivada_angular', 0.0)}°/frame)."
                ),
            })

        coach_voz_texto = cls.generar_voz_3_oraciones(
            metricas_33_frames=cinematica_continua_33,
            gesto_detectado=gesto_detectado,
            metricas_fisicas=metricas_fisicas,
        )

        score_global = round(
            0.20 * evaluacion_fases["fase_1"]["score"]
            + 0.25 * evaluacion_fases["fase_2"]["score"]
            + 0.35 * evaluacion_fases["fase_3"]["score"]
            + 0.20 * evaluacion_fases["fase_4"]["score"],
            1,
        )

        return {
            "score_global": score_global,
            "fases": evaluacion_fases,
            "frames_clave_fases": {
                "fase_1": fases["fase_1"]["frame_id"],
                "fase_2": fases["fase_2"]["frame_id"],
                "fase_3": fases["fase_3"]["frame_id"],
                "fase_4": fases["fase_4"]["frame_id"],
            },
            "diagnostico_causa_raiz": diagnostico_causa_raiz,
            "coach_voz_texto": coach_voz_texto,
            "voz_coach": coach_voz_texto,
            "errores_detectados": errores_detectados,
        }


def generar_feedback_voz_infantil(
    metricas_33_frames: Any,
    gesto_detectado: str = "Remate",
    metricas_fisicas: Optional[Dict[str, Any]] = None,
) -> str:
    """Función delegada de nivel de módulo para construir las 3 oraciones estrictas de voz."""
    return CoachExpertoBiomecanico.generar_voz_3_oraciones(
        metricas_33_frames=metricas_33_frames,
        gesto_detectado=gesto_detectado,
        metricas_fisicas=metricas_fisicas,
    )


def construir_diagnostico_y_voz(
    frames_procesados: List[Dict[str, Any]],
    gesto_detectado: str,
    metricas_fisicas: Dict[str, Any],
    cinematica_continua_33: Dict[str, Any],
    t0_idx_relativo: int = 20,
) -> Dict[str, Any]:
    """Función delegada de nivel de módulo para construir diagnóstico de causa raíz, 4 fases y voz."""
    return CoachExpertoBiomecanico.construir_diagnostico_y_fases(
        frames_procesados=frames_procesados,
        gesto_detectado=gesto_detectado,
        metricas_fisicas=metricas_fisicas,
        cinematica_continua_33=cinematica_continua_33,
        t0_idx_relativo=t0_idx_relativo,
    )
