"""
Módulo Traductor Pedagógico a Lenguaje Natural Infantil (Principio de Responsabilidad Única - SOLID).
Recibe las métricas cinemáticas puras de los 33 frames y las traduce en analogías
simples, amigables y accionables (nivel niño de 5 años) para el motor de voz (TTS).
"""

from typing import Any, Dict, Optional
from backend.biomecanica.analisis_continuo import AnalizadorContinuo33Frames


class CoachTraductorVoz:
    """
    Traductor de curvas cinemáticas continuas a feedback verbal profesional y accionable.
    Estructura estricta en 3 oraciones:
      1. "Detecté un [Gesto]."
      2. (Solo si salto > 0) "Tu salto fue de [X] cm."
      3. "[Consejo basado en codo/rodilla]"
    """

    MAPA_GESTOS_VOZ = {
        "remate": "Remate",
        "bloqueo": "Bloqueo",
        "voleo": "Voleo",
        "colocacion": "Voleo",
        "colocación": "Voleo",
        "recepcion": "Recepción",
        "recepción": "Recepción",
        "saque": "Saque",
    }

    @classmethod
    def generar_feedback_voz_infantil(
        cls,
        metricas_33_frames: Any,
        gesto_detectado: str = "Remate",
        metricas_fisicas: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Devuelve `coach_voz_texto` estructurado en 3 oraciones estrictas:
          "Detecté un [Gesto]." +
          (Solo si salto > 0) "Tu salto fue de [X] cm." +
          "[Consejo basado en codo/rodilla]".
        """
        salto_cm_detectado = 0.0
        if isinstance(metricas_fisicas, dict) and metricas_fisicas.get("salto_vertical_cm") is not None:
            salto_cm_detectado = float(metricas_fisicas.get("salto_vertical_cm", 0.0))

        gesto_raw = str(gesto_detectado or "").strip()

        if isinstance(metricas_33_frames, list):
            metricas = AnalizadorContinuo33Frames.evaluar_cinematica_continua_33_frames(metricas_33_frames)
            if salto_cm_detectado <= 0.0:
                fisicas_calc = AnalizadorContinuo33Frames.calcular_salto_vertical(metricas_33_frames)
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
                metricas = AnalizadorContinuo33Frames.evaluar_cinematica_continua_33_frames(frames_temp)
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
            metricas = AnalizadorContinuo33Frames.evaluar_cinematica_continua_33_frames([])

        gesto_canonico = cls.MAPA_GESTOS_VOZ.get(gesto_raw.lower(), gesto_raw if gesto_raw else "Remate")

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
        oracion_salto = f"Tu salto fue de {salto_redondeado} cm." if salto_cm_detectado > 0.0 and salto_redondeado > 0 else ""

        # Oración 3: "[Consejo basado en codo/rodilla]" (1 oración estricta)
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


def generar_feedback_voz_infantil(
    metricas_33_frames: Any,
    gesto_detectado: str = "remate",
    metricas_fisicas: Optional[Dict[str, Any]] = None,
) -> str:
    """Función delegada para traducir métricas de 33 frames a lenguaje infantil amigable."""
    return CoachTraductorVoz.generar_feedback_voz_infantil(
        metricas_33_frames=metricas_33_frames,
        gesto_detectado=gesto_detectado,
        metricas_fisicas=metricas_fisicas,
    )
