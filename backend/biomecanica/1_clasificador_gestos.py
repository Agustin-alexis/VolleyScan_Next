"""
1. Clasificador Cinemático Temporal de Gestos (`1_clasificador_gestos.py`).
Responsabilidad Única: Recibir una ventana temporal de 25 frames (`collections.deque(maxlen=25)`)
con los arrays de 8 ángulos cinemáticos `[codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der]`
(y/o la secuencia de fotogramas del movimiento), evaluar la evolución completa del movimiento
en los 25 frames en lugar de un frame aislado, y devolver ÚNICAMENTE un string canónico:
"Remate", "Voleo", "Recepción", "Bloqueo" o "Saque".
"""

from collections import deque
from typing import Any, Deque, Dict, List, Optional, Sequence, Tuple, Union
import numpy as np

from backend.biomecanica.reconstruccion_3d import calcular_angulos_flexion_frame

VENTANA_CLASIFICACION_FRAMES: int = 25


def _es_vector_angulos_valido(item: Any) -> bool:
    """Verifica si el elemento es un array numérico de 8 ángulos cinemáticos."""
    return (
        isinstance(item, (list, tuple))
        and len(item) == 8
        and all(isinstance(x, (int, float)) for x in item)
    )


def _extraer_array_angulos_frame(frame: Any) -> List[float]:
    """
    Extrae o calcula el array de 8 ángulos cinemáticos de un fotograma:
    `[codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der]`.
    """
    if _es_vector_angulos_valido(frame):
        return [round(float(v), 2) for v in frame]

    if isinstance(frame, dict):
        ang_cin = frame.get("angulos_cinematicos")
        if _es_vector_angulos_valido(ang_cin):
            return [round(float(v), 2) for v in ang_cin]
    elif hasattr(frame, "angulos_cinematicos"):
        ang_attr = getattr(frame, "angulos_cinematicos", None)
        if _es_vector_angulos_valido(ang_attr):
            return [round(float(v), 2) for v in ang_attr]

    return calcular_angulos_flexion_frame(frame)


def construir_ventana_25_angulos(
    entrada: Any,
    t0_index: int = 20,
) -> Deque[List[float]]:
    """
    Construye un búfer temporal `collections.deque(maxlen=25)` con los arrays de 8 ángulos
    cinemáticos de los 25 frames que conforman la secuencia del movimiento.
    """
    ventana_angulos: Deque[List[float]] = deque(maxlen=VENTANA_CLASIFICACION_FRAMES)
    if not entrada:
        return ventana_angulos

    if isinstance(entrada, (list, tuple, deque)):
        lista_entrada = list(entrada)
    else:
        lista_entrada = [entrada]

    if not lista_entrada:
        return ventana_angulos

    total = len(lista_entrada)
    if total > VENTANA_CLASIFICACION_FRAMES:
        idx_centro = max(0, min(total - 1, int(t0_index)))
        idx_ini = max(0, idx_centro - 16)
        idx_fin = min(total, idx_ini + VENTANA_CLASIFICACION_FRAMES)
        if idx_fin - idx_ini < VENTANA_CLASIFICACION_FRAMES:
            idx_ini = max(0, idx_fin - VENTANA_CLASIFICACION_FRAMES)
        recorte = lista_entrada[idx_ini:idx_fin]
    else:
        recorte = lista_entrada

    for item in recorte:
        ventana_angulos.append(_extraer_array_angulos_frame(item))

    return ventana_angulos


def _extraer_ventana_25_frames(
    entrada: Any,
    t0_index: int = 20,
) -> Tuple[Deque[Any], int]:
    """
    Recorta la secuencia completa a una ventana `collections.deque(maxlen=25)` centrada
    alrededor del movimiento y devuelve `(ventana_deque_25, t0_relativo_en_ventana)`.
    """
    ventana_frames: Deque[Any] = deque(maxlen=VENTANA_CLASIFICACION_FRAMES)
    if not entrada:
        return (ventana_frames, 0)

    if isinstance(entrada, (list, tuple, deque)):
        lista = list(entrada)
    else:
        lista = [entrada]

    if not lista:
        return (ventana_frames, 0)

    total = len(lista)
    idx_centro = max(0, min(total - 1, int(t0_index)))
    if total > VENTANA_CLASIFICACION_FRAMES:
        idx_ini = max(0, idx_centro - 16)
        idx_fin = min(total, idx_ini + VENTANA_CLASIFICACION_FRAMES)
        if idx_fin - idx_ini < VENTANA_CLASIFICACION_FRAMES:
            idx_ini = max(0, idx_fin - VENTANA_CLASIFICACION_FRAMES)
        sub_lista = lista[idx_ini:idx_fin]
        t0_rel = max(0, min(len(sub_lista) - 1, idx_centro - idx_ini))
    else:
        sub_lista = lista
        t0_rel = idx_centro

    for f in sub_lista:
        ventana_frames.append(f)

    return (ventana_frames, t0_rel)


def _extraer_xy(
    frame: Any,
    idx_mp: int,
    claves: Tuple[str, ...],
) -> Optional[Tuple[float, float]]:
    """Extrae las coordenadas (x, y) de una articulación desde un fotograma de forma segura."""
    try:
        if isinstance(frame, dict):
            lm33 = frame.get("landmarks_33")
            if isinstance(lm33, (list, tuple)) and len(lm33) > idx_mp:
                pt = lm33[idx_mp]
                if isinstance(pt, dict) and "x" in pt and "y" in pt:
                    return (float(pt["x"]), float(pt["y"]))
                if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                    return (float(pt[0]), float(pt[1]))

            for key_src in ("landmarks_2d_original", "puntos_2d", "puntos", "puntos_3d_suaves", "world_landmarks_3d"):
                src = frame.get(key_src)
                if isinstance(src, dict):
                    for k in claves:
                        val = src.get(k)
                        if isinstance(val, dict) and "x" in val and "y" in val:
                            return (float(val["x"]), float(val["y"]))
                        if isinstance(val, (list, tuple)) and len(val) >= 2:
                            return (float(val[0]), float(val[1]))
        else:
            for attr in ("landmarks_2d", "world_landmarks_3d"):
                src = getattr(frame, attr, None)
                if isinstance(src, dict):
                    for k in claves:
                        val = src.get(k)
                        if isinstance(val, (list, tuple)) and len(val) >= 2:
                            return (float(val[0]), float(val[1]))
    except (TypeError, ValueError, KeyError, IndexError):
        return None
    return None


def _tiene_despegue_tobillos_5pct(buffer_frames: Sequence[Any]) -> bool:
    """
    Evalúa en la ventana temporal si los tobillos (27, 28) presentan un desplazamiento
    vertical en Y superior al 5% de la altura total inicial (nariz [0] a tobillos [27, 28]).
    """
    if not buffer_frames or len(buffer_frames) < 4:
        return False

    try:
        f0 = buffer_frames[0]
        nariz_0 = _extraer_xy(f0, 0, ("nariz", "nose"))
        ys_tob: List[float] = []
        for f in buffer_frames:
            ti = _extraer_xy(f, 27, ("tobillo_izq", "left_ankle"))
            td = _extraer_xy(f, 28, ("tobillo_der", "right_ankle"))
            vals = [p[1] for p in (ti, td) if p is not None]
            if vals:
                ys_tob.append(float(sum(vals) / len(vals)))

        if not ys_tob:
            return False

        y_tob_base = ys_tob[0]
        if nariz_0 is not None:
            y_nariz = nariz_0[1]
        else:
            hi = _extraer_xy(f0, 11, ("hombro_izq",))
            hd = _extraer_xy(f0, 12, ("hombro_der",))
            if hi and hd:
                yh = (hi[1] + hd[1]) / 2.0
                y_nariz = yh - 0.22 * abs(y_tob_base - yh)
            else:
                y_nariz = 0.20 if y_tob_base <= 2.0 else y_tob_base * 0.22

        altura_jugador = abs(y_tob_base - y_nariz)
        if altura_jugador <= 1e-6:
            altura_jugador = 0.75 if y_tob_base <= 2.0 else 360.0

        umbral_5pct = 0.05 * altura_jugador
        n_base = min(6, max(2, len(ys_tob) // 5))
        linea_base = float(np.median(ys_tob[:n_base]))
        max_elevacion = float(max(linea_base - y for y in ys_tob))
        return max_elevacion > umbral_5pct
    except (TypeError, ValueError, ZeroDivisionError):
        return False


def _desplazamiento_horizontal_cadera(
    frames_seq: Sequence[Any],
    t0_index: int = 20,
) -> Tuple[float, float]:
    """
    Calcula desplazamiento horizontal X/Z de la cadera en los frames previos al despegue/t0
    y la velocidad media de aproximación de cadera (m/s). Sirve para desempatar Remate vs. Saque.
    """
    if not frames_seq or len(frames_seq) < 4:
        return (0.0, 0.0)
    idx_fin = max(1, min(len(frames_seq), int(t0_index) + 1))
    idx_ini = max(0, idx_fin - 16)
    xs: List[float] = []
    zs: List[float] = []
    vels: List[float] = []

    for f in frames_seq[idx_ini:idx_fin]:
        if isinstance(f, dict):
            cin = f.get("cinematica")
            if isinstance(cin, dict) and isinstance(cin.get("velocidad_cadera_3d_ms"), (int, float)):
                vels.append(float(cin["velocidad_cadera_3d_ms"]))
            c_pts: List[Tuple[float, float]] = []
            for key_src in ("puntos_3d_suaves", "world_landmarks_3d", "landmarks_2d_original", "puntos"):
                src = f.get(key_src)
                if isinstance(src, dict):
                    ci = src.get("cadera_izq")
                    cd = src.get("cadera_der")
                    vals_x: List[float] = []
                    vals_z: List[float] = []
                    for c in (ci, cd):
                        if isinstance(c, (list, tuple)) and len(c) >= 2:
                            vals_x.append(float(c[0]))
                            vals_z.append(float(c[2]) if len(c) > 2 else 0.0)
                    if vals_x:
                        c_pts.append((sum(vals_x) / len(vals_x), sum(vals_z) / len(vals_z)))
                        break
            if c_pts:
                xs.append(c_pts[0][0])
                zs.append(c_pts[0][1])

    delta_xz = 0.0
    if len(xs) >= 2:
        dx = max(xs) - min(xs)
        dz = max(zs) - min(zs)
        delta_xz = float(np.hypot(dx, dz))
    vel_pico = max(vels) if vels else 0.0
    return (delta_xz, vel_pico)


def _metricas_asimetria_t0(
    frames_seq: Sequence[Any],
    t0_index: int = 20,
) -> Dict[str, float]:
    """Calcula elevación y simetría de codos/hombros alrededor de t0 para Voleo vs Saque vs Bloqueo."""
    if not frames_seq:
        return {"asym_codo": 0.0, "codo_prom": 150.0, "hombro_max": 90.0}
    idx_c = max(0, min(len(frames_seq) - 1, int(t0_index)))
    f = frames_seq[idx_c]
    ang8 = _extraer_array_angulos_frame(f)
    ang_3d = f.get("angulos_3d") if isinstance(f, dict) and isinstance(f.get("angulos_3d"), dict) else {}
    codo_d = float(ang_3d.get("codo", ang8[1] if len(ang8) > 1 else 150.0))
    codo_op = float(ang_3d.get("codo_opuesto", ang8[0] if len(ang8) > 0 else codo_d))
    asym_ang8 = abs(float(ang8[1]) - float(ang8[0])) if len(ang8) >= 2 else 0.0
    asym_codo = max(abs(codo_d - codo_op), asym_ang8)
    codo_prom = (codo_d + codo_op) / 2.0
    hombro_max = max(float(ang8[2]) if len(ang8) > 2 else 90.0, float(ang8[3]) if len(ang8) > 3 else 90.0)
    return {"asym_codo": asym_codo, "codo_prom": codo_prom, "hombro_max": hombro_max}


def aplicar_reglas_heuristicas_descarte_rapido(
    ventana_frames_25: Sequence[Any],
    todos_los_frames: Optional[Sequence[Any]] = None,
    salto_vertical_cm: Optional[float] = None,
    idx_t0_ventana: int = 16,
    gesto_solicitado: str = "auto",
) -> Dict[str, Any]:
    """
    Bloque de reglas heurísticas de descarte rápido ejecutado ANTES del modelo predictivo:
      1. Si la coordenada Y de los tobillos (27, 28) indica que el jugador está tocando el suelo,
         anula automáticamente cualquier predicción de 'Remate'.
      2. Si las muñecas (15, 16) están por debajo de la línea de los hombros (11, 12),
         anula automáticamente cualquier predicción de 'Voleo'.
      Si el movimiento no pasa estos filtros, marca `descarte_inmediato = True` para devolver 'Gesto no válido'.
    """
    frames_ref = list(todos_los_frames) if todos_los_frames is not None else list(ventana_frames_25)
    lista_ventana = list(ventana_frames_25)
    n_ventana = len(lista_ventana)

    if n_ventana == 0:
        return {
            "descarte_inmediato": True,
            "resultado": "Gesto no válido",
            "tobillos_tocando_suelo": True,
            "munecas_bajo_hombros": True,
            "remate_anulado": True,
            "voleo_anulado": True,
            "predicciones_anuladas": {"Remate", "Voleo"},
            "coords_validas": False,
            "alguna_muneca_arriba": False,
            "ambas_munecas_arriba": False,
            "diferencia_y_norm": 0.0,
        }

    radio_focal = min(3, max(1, n_ventana // 6))
    ini_focal = max(0, idx_t0_ventana - radio_focal)
    fin_focal = min(n_ventana, idx_t0_ventana + radio_focal + 1)
    indices_focales = list(range(ini_focal, fin_focal)) or [min(n_ventana - 1, max(0, idx_t0_ventana))]

    frames_con_muneca_arriba = 0
    frames_con_ambas_arriba = 0
    diffs_y_focales: List[float] = []
    dists_x_bajas: List[float] = []
    dists_3d_bajas: List[float] = []
    coords_validas = False

    for idx_f in indices_focales:
        f_item = lista_ventana[idx_f]
        h_izq = _extraer_xy(f_item, 11, ("hombro_izq",))
        h_der = _extraer_xy(f_item, 12, ("hombro_der",))
        m_izq = _extraer_xy(f_item, 15, ("muneca_izq",))
        m_der = _extraer_xy(f_item, 16, ("muneca_der",))
        cad_izq = _extraer_xy(f_item, 23, ("cadera_izq",))
        cad_der = _extraer_xy(f_item, 24, ("cadera_der",))

        if any(p is not None for p in (h_izq, h_der, m_izq, m_der)):
            coords_validas = True

        hombro_izq = h_izq or (-0.15, 0.38)
        hombro_der = h_der or (0.15, 0.38)
        muneca_izq = m_izq or (-0.15, 0.50)
        muneca_der = m_der or (0.15, 0.50)
        cadera_izq = cad_izq or (-0.10, 0.62)
        cadera_der = cad_der or (0.10, 0.62)

        y_hombros_avg = (hombro_izq[1] + hombro_der[1]) / 2.0
        y_caderas_avg = (cadera_izq[1] + cadera_der[1]) / 2.0
        y_m_izq = muneca_izq[1]
        y_m_der = muneca_der[1]

        escala_y = (
            480.0
            if max(abs(y_hombros_avg), abs(y_m_izq), abs(y_m_der), abs(y_caderas_avg)) > 2.0
            else 1.0
        )
        diff_norm = abs(y_m_der - y_m_izq) / escala_y

        # En MediaPipe (Y=0 arriba, Y=1 abajo): muñeca por encima de hombros => y_muneca < y_hombro
        m_izq_up = y_m_izq < (hombro_izq[1] - 0.005 * escala_y)
        m_der_up = y_m_der < (hombro_der[1] - 0.005 * escala_y)

        if m_izq_up or m_der_up:
            frames_con_muneca_arriba += 1
            diffs_y_focales.append(diff_norm)
        else:
            dists_x_bajas.append(abs(muneca_der[0] - muneca_izq[0]) / escala_y)
            if isinstance(f_item, dict) and isinstance(f_item.get("cinematica"), dict):
                d3d = f_item["cinematica"].get("distancia_munecas_3d_m")
                if isinstance(d3d, (int, float)):
                    dists_3d_bajas.append(float(d3d))
        if m_izq_up and m_der_up:
            frames_con_ambas_arriba += 1

    alguna_muneca_arriba = frames_con_muneca_arriba > 0
    ambas_munecas_arriba = frames_con_ambas_arriba > 0
    diferencia_y_norm = float(max(diffs_y_focales)) if diffs_y_focales else 0.0

    # REGLA HEURÍSTICA 1: Coordenada Y de los tobillos (¿jugador tocando el suelo?)
    if salto_vertical_cm is not None:
        hay_despegue = float(salto_vertical_cm) > 0.0
    elif len(frames_ref) >= 4:
        hay_despegue = _tiene_despegue_tobillos_5pct(lista_ventana) or _tiene_despegue_tobillos_5pct(frames_ref)
    else:
        hay_despegue = False

    tobillos_tocando_suelo = not hay_despegue
    remate_anulado = tobillos_tocando_suelo

    # REGLA HEURÍSTICA 2: Muñecas por debajo de la línea de los hombros
    munecas_bajo_hombros = not alguna_muneca_arriba
    voleo_anulado = munecas_bajo_hombros

    predicciones_anuladas = set()
    if remate_anulado:
        predicciones_anuladas.add("Remate")
        predicciones_anuladas.add("Bloqueo")
    if voleo_anulado:
        predicciones_anuladas.add("Voleo")

    gesto_req = (gesto_solicitado or "auto").strip().lower()
    descarte_inmediato = False

    # Si el usuario solicitó explícitamente un gesto que fue anulado por los filtros heurísticos:
    if gesto_req == "remate" and remate_anulado:
        descarte_inmediato = True
    elif gesto_req == "bloqueo" and remate_anulado:
        descarte_inmediato = True
    elif gesto_req in ("voleo", "colocacion", "colocación") and voleo_anulado:
        descarte_inmediato = True

    # Si ambas heurísticas se activan (en el suelo + muñecas bajo hombros) y las manos están muy separadas
    # (no forman plataforma de recepción), no pasa los filtros -> 'Gesto no válido'
    if coords_validas and tobillos_tocando_suelo and munecas_bajo_hombros:
        min_dist_3d = min(dists_3d_bajas) if dists_3d_bajas else 0.10
        min_dist_x = min(dists_x_bajas) if dists_x_bajas else 0.16
        if min_dist_3d > 0.28 or min_dist_x > 0.35:
            descarte_inmediato = True

    return {
        "descarte_inmediato": descarte_inmediato,
        "resultado": "Gesto no válido" if descarte_inmediato else None,
        "tobillos_tocando_suelo": tobillos_tocando_suelo,
        "munecas_bajo_hombros": munecas_bajo_hombros,
        "remate_anulado": remate_anulado,
        "voleo_anulado": voleo_anulado,
        "predicciones_anuladas": predicciones_anuladas,
        "coords_validas": coords_validas,
        "alguna_muneca_arriba": alguna_muneca_arriba,
        "ambas_munecas_arriba": ambas_munecas_arriba,
        "diferencia_y_norm": diferencia_y_norm,
    }


def clasificar_ventana_25_angulos(
    ventana_angulos_25: Union[Deque[List[float]], Sequence[Sequence[float]]],
    salto_vertical_cm: Optional[float] = None,
) -> str:
    """
    Clasifica el gesto deportivo evaluando exclusivamente la secuencia temporal de hasta 25 frames
    de arrays de 8 ángulos `[codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der]`.
    Analiza la dinámica de carga, impulso y extensión a lo largo de toda la ventana temporal.
    """
    if not ventana_angulos_25:
        return "Recepción"

    try:
        deque_25: Deque[List[float]] = deque(
            [[float(x) for x in fila[:8]] for fila in ventana_angulos_25 if len(fila) >= 8],
            maxlen=VENTANA_CLASIFICACION_FRAMES,
        )
        if not deque_25:
            return "Recepción"

        matriz = np.asarray(list(deque_25), dtype=float)
        # Índices: 0=codo_izq, 1=codo_der, 2=hombro_izq, 3=hombro_der,
        #          4=rodilla_izq, 5=rodilla_der, 6=cadera_izq, 7=cadera_der
        codos_izq = matriz[:, 0]
        codos_der = matriz[:, 1]
        hombros_izq = matriz[:, 2]
        hombros_der = matriz[:, 3]
        rodillas_izq = matriz[:, 4]
        rodillas_der = matriz[:, 5]
        caderas_izq = matriz[:, 6]
        caderas_der = matriz[:, 7]

        # Evolución temporal de hombros y codos en la ventana de 25 frames
        asimetria_codos_serie = np.abs(codos_der - codos_izq)
        asimetria_hombros_serie = np.abs(hombros_der - hombros_izq)
        elevacion_max_frame = np.maximum(hombros_izq, hombros_der)

        # Ubicar el instante de máxima acción articular (mayor elevación de hombro o mayor asimetría de golpeo)
        score_accion_frame = elevacion_max_frame + 0.5 * asimetria_codos_serie + 0.5 * asimetria_hombros_serie
        idx_pico = int(np.argmax(score_accion_frame))

        h_izq_pico = float(hombros_izq[idx_pico])
        h_der_pico = float(hombros_der[idx_pico])
        max_hombro = float(np.max(elevacion_max_frame))
        asimetria_hombros_pico = float(np.max(asimetria_hombros_serie))
        asimetria_codos_pico = float(np.max(asimetria_codos_serie))
        asimetria_articular_max = max(asimetria_hombros_pico, asimetria_codos_pico)

        # Dinámica de extensión de codos y rodillas en los 25 frames
        rango_codo_dom = float(
            max(np.ptp(codos_izq), np.ptp(codos_der)) if len(matriz) > 1 else 0.0
        )
        min_rodilla = float(np.min(np.minimum(rodillas_izq, rodillas_der)))
        max_rodilla = float(np.max(np.maximum(rodillas_izq, rodillas_der)))
        impulso_rodilla = max_rodilla - min_rodilla
        impulso_cadera = float(
            max(np.ptp(caderas_izq), np.ptp(caderas_der)) if len(matriz) > 1 else 0.0
        )

        # Si durante toda la ventana de 25 frames los hombros permanecen bajos (< 85°), es Recepción
        if max_hombro < 85.0:
            return "Recepción"

        if salto_vertical_cm is not None:
            hay_salto = float(salto_vertical_cm) > 0.0
        else:
            # Impulso explosivo de tren inferior (flexión profunda + extensión rápida de rodillas y cadera)
            hay_salto = (impulso_rodilla >= 32.0 and min_rodilla <= 135.0) or (
                impulso_rodilla >= 25.0 and impulso_cadera >= 20.0 and max_hombro >= 125.0
            )

        if not hay_salto:
            if asimetria_articular_max >= 35.0 and rango_codo_dom >= 35.0 and max_hombro >= 120.0:
                return "Saque"
            return "Voleo"

        # Con salto vertical confirmado en la ventana de 25 frames:
        # En Bloqueo ambos brazos suben simétricos (hombros y codos simétricos); en Remate hay asimetría de golpeo
        ambos_hombros_altos = (h_izq_pico >= 110.0) and (h_der_pico >= 110.0)
        if ambos_hombros_altos and asimetria_articular_max < 15.0:
            return "Bloqueo"

        return "Remate"
    except (TypeError, ValueError, KeyError, IndexError):
        return "Recepción"


def clasificar_ventana_25_frames(
    entrada: Union[Deque[Any], List[Any], Tuple[Any, ...], Dict[str, Any], Any],
    salto_vertical_cm: Optional[float] = None,
    t0_index: int = 20,
    gesto_solicitado: str = "auto",
) -> str:
    """
    Ejecuta primero el bloque de reglas heurísticas de descarte rápido (tobillos en el suelo
    anula 'Remate'; muñecas bajo hombros anula 'Voleo') y luego evalúa la ventana temporal
    de 25 frames (`collections.deque(maxlen=25)`) en el modelo predictivo.
    Si no pasa los filtros heurísticos, devuelve 'Gesto no válido'.
    """
    if not entrada:
        return "Gesto no válido"

    try:
        # Si la entrada ya es directamente una secuencia/deque de vectores de 8 ángulos cinemáticos:
        if (
            isinstance(entrada, (list, tuple, deque))
            and len(entrada) > 0
            and _es_vector_angulos_valido(list(entrada)[0])
        ):
            pred_ang = clasificar_ventana_25_angulos(entrada, salto_vertical_cm=salto_vertical_cm)
            if salto_vertical_cm is not None and float(salto_vertical_cm) <= 0.0 and pred_ang == "Remate":
                return "Gesto no válido"
            return pred_ang

        if isinstance(entrada, (list, tuple, deque)):
            todos_los_frames = list(entrada)
        else:
            todos_los_frames = [entrada]

        if not todos_los_frames:
            return "Gesto no válido"

        # 1. Construir el búfer temporal `collections.deque(maxlen=25)` de frames y de ángulos cinemáticos
        ventana_frames_25, idx_t0_ventana = _extraer_ventana_25_frames(todos_los_frames, t0_index=t0_index)
        ventana_angulos_25 = construir_ventana_25_angulos(todos_los_frames, t0_index=t0_index)

        if not ventana_frames_25:
            return "Gesto no válido"

        # =====================================================================
        # 2. BLOQUE DE REGLAS HEURÍSTICAS DE DESCARTE RÁPIDO (PRE-MODELO)
        #    - Regla 1: Tobillos en el suelo -> anula 'Remate'
        #    - Regla 2: Muñecas bajo la línea de los hombros -> anula 'Voleo'
        # =====================================================================
        filtro_heuristico = aplicar_reglas_heuristicas_descarte_rapido(
            ventana_frames_25=ventana_frames_25,
            todos_los_frames=todos_los_frames,
            salto_vertical_cm=salto_vertical_cm,
            idx_t0_ventana=idx_t0_ventana,
            gesto_solicitado=gesto_solicitado,
        )

        if filtro_heuristico["descarte_inmediato"]:
            return "Gesto no válido"

        coords_validas = bool(filtro_heuristico["coords_validas"])
        predicciones_anuladas = filtro_heuristico["predicciones_anuladas"]
        alguna_muneca_arriba = bool(filtro_heuristico["alguna_muneca_arriba"])
        ambas_munecas_arriba = bool(filtro_heuristico["ambas_munecas_arriba"])
        diferencia_y_norm = float(filtro_heuristico["diferencia_y_norm"])
        hay_salto = not bool(filtro_heuristico["tobillos_tocando_suelo"])

        # Si los frames carecen de coordenadas válidas, evaluar con la matriz 25x8 y aplicar las anulaciones
        if not coords_validas and len(ventana_angulos_25) > 0:
            prediccion = clasificar_ventana_25_angulos(ventana_angulos_25, salto_vertical_cm=salto_vertical_cm)
            if prediccion in predicciones_anuladas:
                return "Gesto no válido"
            return prediccion

        # =====================================================================
        # 3. MODELO PREDICTIVO SOBRE LA SECUENCIA DE 25 FRAMES
        # =====================================================================
        prediccion_angulos = clasificar_ventana_25_angulos(
            ventana_angulos_25,
            salto_vertical_cm=(10.0 if hay_salto else 0.0) if salto_vertical_cm is None else salto_vertical_cm,
        )

        gesto_req = (gesto_solicitado or "auto").strip().lower()
        delta_xz_cadera, vel_cadera_pre = _desplazamiento_horizontal_cadera(todos_los_frames, t0_index=t0_index)
        info_t0 = _metricas_asimetria_t0(todos_los_frames, t0_index=t0_index)
        asym_codo_t0 = info_t0["asym_codo"]

        if not alguna_muneca_arriba:
            prediccion_final = "Recepción"
        elif not hay_salto:
            if gesto_req == "saque":
                prediccion_final = "Saque"
            elif gesto_req in ("voleo", "colocacion", "colocación") or ambas_munecas_arriba or asym_codo_t0 < 25.0:
                prediccion_final = "Voleo"
            elif diferencia_y_norm >= 0.08 and asym_codo_t0 >= 30.0 and delta_xz_cadera < 0.06:
                prediccion_final = "Saque"
            else:
                prediccion_final = prediccion_angulos if prediccion_angulos not in predicciones_anuladas else "Voleo"
        else:
            if gesto_req == "bloqueo" or (ambas_munecas_arriba and diferencia_y_norm < 0.06):
                prediccion_final = "Bloqueo"
            elif gesto_req in ("voleo", "colocacion", "colocación") and ambas_munecas_arriba:
                prediccion_final = "Voleo"
            elif gesto_req == "saque" or (
                delta_xz_cadera < 0.045
                and gesto_req != "remate"
                and (
                    vel_cadera_pre <= 0.25
                    or (salto_vertical_cm is not None and float(salto_vertical_cm) < 20.0)
                )
            ):
                prediccion_final = "Saque"
            else:
                prediccion_final = "Remate"

        # 4. Verificación final contra las predicciones anuladas por el bloque heurístico:
        #    - Si 'Remate' o 'Bloqueo' fueron anulados por tobillos en el suelo -> 'Gesto no válido'
        #    - Si 'Voleo' fue anulado por muñecas bajo hombros -> 'Gesto no válido'
        if prediccion_final in predicciones_anuladas:
            return "Gesto no válido"

        return prediccion_final
    except (TypeError, ValueError, KeyError, IndexError):
        return "Gesto no válido"


def clasificar_gesto_t0(
    entrada: Union[Deque[Any], List[Any], Tuple[Any, ...], Dict[str, Any], Any],
    salto_vertical_cm: Optional[float] = None,
    t0_index: int = 20,
    gesto_solicitado: str = "auto",
) -> str:
    """
    Evalúa la ventana temporal de 25 frames (`collections.deque(maxlen=25)`) del movimiento
    aplicando primero las reglas heurísticas de descarte rápido y devuelve el gesto o 'Gesto no válido'.
    """
    return clasificar_ventana_25_frames(
        entrada=entrada,
        salto_vertical_cm=salto_vertical_cm,
        t0_index=t0_index,
        gesto_solicitado=gesto_solicitado,
    )


def evaluar_gesto(
    buffer: List[Any],
    salto_vertical_cm: Optional[float] = None,
    t0_index: int = 20,
    gesto_solicitado: str = "auto",
) -> str:
    """Evalúa el gesto técnico a partir de la ventana temporal de 25 frames con tipado estricto."""
    return clasificar_ventana_25_frames(
        entrada=buffer,
        salto_vertical_cm=salto_vertical_cm,
        t0_index=t0_index,
        gesto_solicitado=gesto_solicitado,
    )


def clasificar_gesto_tecnico(
    buffer_frames: Union[Deque[Any], List[Any], Tuple[Any, ...], Dict[str, Any], Any],
    salto_vertical_cm: Optional[float] = None,
    t0_index: int = 20,
    gesto_solicitado: str = "auto",
) -> str:
    """Alias compatible que evalúa la ventana de 25 frames y devuelve el gesto detectado."""
    return clasificar_ventana_25_frames(
        entrada=buffer_frames,
        salto_vertical_cm=salto_vertical_cm,
        t0_index=t0_index,
        gesto_solicitado=gesto_solicitado,
    )
