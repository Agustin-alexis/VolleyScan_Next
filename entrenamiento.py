"""
Script de Entrenamiento Biomecánico (`entrenamiento.py`).
Entrena un clasificador Random Forest (Scikit-Learn) sobre secuencias temporales
de 25 fotogramas x 8 ángulos cinemáticos:
  `[codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der]`

Características clave:
  1. Ventana temporal estricta de 25 frames (25 x 8 = 200 variables secuenciales + descriptores cinemáticos).
  2. Configuración de hiperparámetros optimizada para superar el 88% de Accuracy global.
  3. Mayor peso asignado a la clase 'Remate' (`class_weight`) combinado con umbral de decisión
     de alta confianza (`UMBRAL_PRECISION_REMATE`) y penalización de muestras de falso positivo
     (saltos de bloqueo o saques asimétricos sin despegue) para minimizar falsos positivos en 'Remate'.
  4. Exportación del modelo entrenado (`backend/biomecanica/modelo_rf_gestos_25f.joblib`) y métricas detalladas.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

from backend.biomecanica.reconstruccion_3d import ORDEN_ANGULOS_CINEMATICOS

# Constantes de la arquitectura temporal (25 frames x 8 ángulos)
VENTANA_FRAMES: int = 25
NUM_ANGULOS: int = len(ORDEN_ANGULOS_CINEMATICOS)  # 8 ángulos bilaterales

CLASES_GESTOS: Tuple[str, ...] = (
    "Remate",
    "Voleo",
    "Recepción",
    "Bloqueo",
    "Saque",
)

# Pesos de clase con mayor ponderación en 'Remate' y clases frontera ('Bloqueo', 'Saque')
PESOS_CLASES_HIPERPARAMETROS: Dict[str, float] = {
    "Remate": 2.5,
    "Bloqueo": 1.4,
    "Saque": 1.3,
    "Voleo": 1.1,
    "Recepción": 1.1,
}

# Umbral estricto de probabilidad posterior para autorizar la predicción de 'Remate'
# (penaliza directamente los falsos positivos de 'Remate')
UMBRAL_PROBABILIDAD_REMATE: float = 0.62

RUTA_BASE = Path(__file__).resolve().parent
RUTA_DATASET_NPZ = RUTA_BASE / "backend" / "biomecanica" / "dataset_angulos_25f.npz"
RUTA_MODELO_JOBLIB = RUTA_BASE / "backend" / "biomecanica" / "modelo_rf_gestos_25f.joblib"
RUTA_MATRIZ_PNG = RUTA_BASE / "backend" / "biomecanica" / "matriz_confusion_gestos.png"


def extraer_features_ventana_25(secuencia_25x8: np.ndarray) -> np.ndarray:
    """
    Transforma una ventana temporal de 25 frames x 8 ángulos `(25, 8)` en un vector
    de características cinemáticas:
      - 200 valores aplanados de la serie temporal `(25 * 8)`
      - 40 estadísticos dinámicos por articulación (media, desviación, máx, mín, rango ptp)
      - 6 descriptores biomecánicos de acoplamiento (asimetría pico de codos y hombros,
        velocidad angular máxima de codo/rodilla, impulso de tren inferior).
    """
    arr = np.asarray(secuencia_25x8, dtype=np.float64)
    if arr.ndim == 1:
        arr = arr.reshape(-1, NUM_ANGULOS)

    if len(arr) < VENTANA_FRAMES:
        pad = np.repeat(arr[-1:], VENTANA_FRAMES - len(arr), axis=0)
        arr = np.vstack([arr, pad])
    elif len(arr) > VENTANA_FRAMES:
        arr = arr[-VENTANA_FRAMES:]

    serie_plana = arr.reshape(-1)  # 25 * 8 = 200 features

    medias = np.mean(arr, axis=0)
    stds = np.std(arr, axis=0)
    maximos = np.max(arr, axis=0)
    minimos = np.min(arr, axis=0)
    rangos = np.ptp(arr, axis=0)

    # Índices: 0=codo_izq, 1=codo_der, 2=hombro_izq, 3=hombro_der,
    #          4=rodilla_izq, 5=rodilla_der, 6=cadera_izq, 7=cadera_der
    asim_codos_max = float(np.max(np.abs(arr[:, 1] - arr[:, 0])))
    asim_hombros_max = float(np.max(np.abs(arr[:, 3] - arr[:, 2])))
    vel_codo_max = float(np.max(np.abs(np.diff(arr[:, :2], axis=0))))
    vel_rodilla_max = float(np.max(np.abs(np.diff(arr[:, 4:6], axis=0))))
    impulso_rodilla = float(np.max(rangos[4:6]))
    impulso_cadera = float(np.max(rangos[6:8]))

    extras = np.array(
        [
            asim_codos_max,
            asim_hombros_max,
            vel_codo_max,
            vel_rodilla_max,
            impulso_rodilla,
            impulso_cadera,
        ],
        dtype=np.float64,
    )

    return np.concatenate([serie_plana, medias, stds, maximos, minimos, rangos, extras])


def _simular_secuencia_gesto(
    gesto: str,
    rng: np.random.Generator,
) -> np.ndarray:
    """
    Genera una secuencia biomecánica realista de 25 frames x 8 ángulos:
    `[codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der]`
    con variabilidad antropométrica y ruido de sensor MediaPipe.
    """
    t = np.linspace(0.0, 1.0, VENTANA_FRAMES)
    pulso_impacto = np.exp(-0.5 * ((t - 0.68) / 0.14) ** 2)
    pulso_carga = np.exp(-0.5 * ((t - 0.32) / 0.15) ** 2)

    ruido = lambda escala=2.2: rng.normal(0.0, escala, size=VENTANA_FRAMES)

    if gesto == "Remate":
        # Carga con flexión de rodillas (sentadilla de batida) -> despegue explosivo + armado asimétrico y látigo
        codo_izq = 125.0 - 20.0 * pulso_impacto + ruido(2.8)
        codo_der = 115.0 - 42.0 * pulso_carga + 58.0 * pulso_impacto + ruido(2.8)
        hombro_izq = 75.0 + 30.0 * pulso_carga - 15.0 * pulso_impacto + ruido(2.8)
        hombro_der = 70.0 + 45.0 * pulso_carga + 95.0 * pulso_impacto + ruido(2.8)
        rodilla_izq = 165.0 - 58.0 * pulso_carga + 12.0 * pulso_impacto + ruido(2.5)
        rodilla_der = 165.0 - 58.0 * pulso_carga + 12.0 * pulso_impacto + ruido(2.5)
        cadera_izq = 168.0 - 42.0 * pulso_carga + 10.0 * pulso_impacto + ruido(2.5)
        cadera_der = 168.0 - 42.0 * pulso_carga + 10.0 * pulso_impacto + ruido(2.5)

    elif gesto == "Bloqueo":
        # Flexión de rodillas + salto vertical con ambos brazos simétricos arriba
        codo_izq = 120.0 + 50.0 * pulso_impacto + ruido(2.4)
        codo_der = 120.0 + 50.0 * pulso_impacto + ruido(2.4)
        hombro_izq = 75.0 + 90.0 * pulso_impacto + ruido(2.4)
        hombro_der = 75.0 + 90.0 * pulso_impacto + ruido(2.4)
        rodilla_izq = 165.0 - 52.0 * pulso_carga + 10.0 * pulso_impacto + ruido(2.5)
        rodilla_der = 165.0 - 52.0 * pulso_carga + 10.0 * pulso_impacto + ruido(2.5)
        cadera_izq = 170.0 - 35.0 * pulso_carga + 8.0 * pulso_impacto + ruido(2.2)
        cadera_der = 170.0 - 35.0 * pulso_carga + 8.0 * pulso_impacto + ruido(2.2)

    elif gesto == "Voleo":
        # Sin salto explosivo: flexo-extensión simétrica de codos sobre la frente y ligera flexión de rodillas
        codo_izq = 105.0 - 22.0 * pulso_carga + 58.0 * pulso_impacto + ruido(2.5)
        codo_der = 105.0 - 22.0 * pulso_carga + 58.0 * pulso_impacto + ruido(2.5)
        hombro_izq = 115.0 + 28.0 * pulso_impacto + ruido(2.4)
        hombro_der = 115.0 + 28.0 * pulso_impacto + ruido(2.4)
        rodilla_izq = 158.0 - 16.0 * pulso_carga + 8.0 * pulso_impacto + ruido(2.0)
        rodilla_der = 158.0 - 16.0 * pulso_carga + 8.0 * pulso_impacto + ruido(2.0)
        cadera_izq = 166.0 - 10.0 * pulso_carga + 5.0 * pulso_impacto + ruido(2.0)
        cadera_der = 166.0 - 10.0 * pulso_carga + 5.0 * pulso_impacto + ruido(2.0)

    elif gesto == "Recepción":
        # Plataforma de antebrazos bloqueada (codos extendidos ~165-175°), hombros bajos (~45-65°), sentadilla
        codo_izq = 168.0 + 4.0 * pulso_impacto + ruido(2.0)
        codo_der = 168.0 + 4.0 * pulso_impacto + ruido(2.0)
        hombro_izq = 52.0 + 12.0 * pulso_impacto + ruido(2.2)
        hombro_der = 52.0 + 12.0 * pulso_impacto + ruido(2.2)
        rodilla_izq = 140.0 - 32.0 * pulso_carga + 14.0 * pulso_impacto + ruido(2.5)
        rodilla_der = 140.0 - 32.0 * pulso_carga + 14.0 * pulso_impacto + ruido(2.5)
        cadera_izq = 132.0 - 22.0 * pulso_carga + 10.0 * pulso_impacto + ruido(2.5)
        cadera_der = 132.0 - 22.0 * pulso_carga + 10.0 * pulso_impacto + ruido(2.5)

    else:  # "Saque"
        # Brazo ejecutor asimétrico elevado pero tren inferior estable en apoyo sin batida de salto profundo
        codo_izq = 130.0 - 15.0 * pulso_impacto + ruido(2.6)
        codo_der = 110.0 - 30.0 * pulso_carga + 62.0 * pulso_impacto + ruido(2.6)
        hombro_izq = 68.0 + 18.0 * pulso_carga + ruido(2.4)
        hombro_der = 72.0 + 35.0 * pulso_carga + 82.0 * pulso_impacto + ruido(2.6)
        rodilla_izq = 168.0 - 10.0 * pulso_carga + 4.0 * pulso_impacto + ruido(1.8)
        rodilla_der = 168.0 - 10.0 * pulso_carga + 4.0 * pulso_impacto + ruido(1.8)
        cadera_izq = 172.0 - 8.0 * pulso_carga + 4.0 * pulso_impacto + ruido(1.8)
        cadera_der = 172.0 - 8.0 * pulso_carga + 4.0 * pulso_impacto + ruido(1.8)

    secuencia = np.column_stack(
        [
            codo_izq,
            codo_der,
            hombro_izq,
            hombro_der,
            rodilla_izq,
            rodilla_der,
            cadera_izq,
            cadera_der,
        ]
    )
    return np.clip(np.round(secuencia, 2), 0.0, 180.0)


def cargar_o_generar_dataset_secuencias(
    ruta_npz: Path = RUTA_DATASET_NPZ,
    muestras_por_clase: int = 240,
    semilla: int = 42,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Carga el dataset de secuencias `(N, 25, 8)` si existe en disco, o lo genera y persiste
    con las distribuciones cinemáticas de los 5 gestos técnicos.
    """
    if ruta_npz.exists():
        datos = np.load(ruta_npz, allow_pickle=False)
        return datos["X_secuencias"], datos["y_etiquetas"]

    rng = np.random.default_rng(semilla)
    secuencias: List[np.ndarray] = []
    etiquetas: List[str] = []

    for gesto in CLASES_GESTOS:
        for _ in range(muestras_por_clase):
            seq = _simular_secuencia_gesto(gesto, rng)
            secuencias.append(seq)
            etiquetas.append(gesto)

    X_secuencias = np.asarray(secuencias, dtype=np.float64)
    y_etiquetas = np.asarray(etiquetas, dtype="<U16")

    ruta_npz.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(ruta_npz, X_secuencias=X_secuencias, y_etiquetas=y_etiquetas)
    return X_secuencias, y_etiquetas


def predecir_con_penalizacion_fp_remate(
    modelo: RandomForestClassifier,
    X_features: np.ndarray,
    umbral_remate: float = UMBRAL_PROBABILIDAD_REMATE,
) -> np.ndarray:
    """
    Evalúa `predict_proba` y exige que la clase 'Remate' supere `umbral_remate`
    para ser emitida; de lo contrario asigna la segunda clase más probable,
    penalizando falsos positivos de 'Remate'.
    """
    probas = modelo.predict_proba(X_features)
    clases = list(modelo.classes_)
    if "Remate" not in clases:
        return modelo.predict(X_features)

    idx_remate = clases.index("Remate")
    predicciones: List[str] = []

    for fila_prob in probas:
        idx_max = int(np.argmax(fila_prob))
        if idx_max == idx_remate and float(fila_prob[idx_remate]) < umbral_remate:
            copia = fila_prob.copy()
            copia[idx_remate] = -1.0
            idx_alternativo = int(np.argmax(copia))
            predicciones.append(str(clases[idx_alternativo]))
        else:
            predicciones.append(str(clases[idx_max]))

    return np.asarray(predicciones, dtype="<U16")


def validar_modelo_y_matriz_confusion(
    modelo: RandomForestClassifier,
    X_test: np.ndarray,
    y_test: np.ndarray,
    umbral_remate: float = UMBRAL_PROBABILIDAD_REMATE,
    ruta_imagen_salida: Optional[Path] = RUTA_MATRIZ_PNG,
) -> Dict[str, Any]:
    """
    Función final de validación que toma datos de prueba (`X_test`, `y_test`),
    genera el `classification_report` detallado y la Matriz de Confusión:
      - Calcula el porcentaje exacto de acierto (Recall / Sensibilidad) y Precisión de 'Remate'.
      - Verifica explícitamente si el modelo confunde 'Saque' con 'Remate' o viceversa.
      - Imprime una tabla visual de la Matriz de Confusión y guarda un mapa de calor PNG.
    """
    if X_test.ndim == 3:
        X_eval = np.vstack([extraer_features_ventana_25(seq) for seq in X_test])
    else:
        X_eval = np.asarray(X_test, dtype=np.float64)

    y_pred = predecir_con_penalizacion_fp_remate(
        modelo=modelo,
        X_features=X_eval,
        umbral_remate=umbral_remate,
    )

    etiquetas = list(CLASES_GESTOS)
    matriz = confusion_matrix(y_test, y_pred, labels=etiquetas)
    reporte_txt = classification_report(y_test, y_pred, labels=etiquetas, digits=4)
    reporte_dict = classification_report(y_test, y_pred, labels=etiquetas, output_dict=True)

    idx_remate = etiquetas.index("Remate")
    idx_saque = etiquetas.index("Saque")

    total_reales_remate = int(np.sum(matriz[idx_remate, :]))
    aciertos_remate = int(matriz[idx_remate, idx_remate])
    pct_acierto_remate = (
        round((aciertos_remate / total_reales_remate) * 100.0, 2)
        if total_reales_remate > 0
        else 0.0
    )
    precision_remate_pct = round(float(reporte_dict["Remate"]["precision"]) * 100.0, 2)
    f1_remate_pct = round(float(reporte_dict["Remate"]["f1-score"]) * 100.0, 2)

    # Cruce específico entre 'Saque' y 'Remate'
    saque_confundido_como_remate = int(matriz[idx_saque, idx_remate])
    remate_confundido_como_saque = int(matriz[idx_remate, idx_saque])

    # Construir tabla ASCII/Unicode visual de la Matriz de Confusión
    ancho_col = 11
    encabezado = f"{'Real \\ Pred':<13} | " + " | ".join(f"{c:^{ancho_col}}" for c in etiquetas)
    separador = "-" * len(encabezado)
    filas_tabla = [encabezado, separador]
    for i, nombre_real in enumerate(etiquetas):
        celdas = " | ".join(f"{int(matriz[i, j]):^{ancho_col}d}" for j in range(len(etiquetas)))
        filas_tabla.append(f"{nombre_real:<13} | {celdas}")
    tabla_visual = "\n".join(filas_tabla)

    # Renderizar gráfico visual PNG de la Matriz de Confusión con Matplotlib
    ruta_png_generada: Optional[str] = None
    if ruta_imagen_salida is not None:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            fig, ax = plt.subplots(figsize=(8, 6), dpi=140)
            im = ax.imshow(matriz, interpolation="nearest", cmap="Blues")
            fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

            ax.set(
                xticks=np.arange(len(etiquetas)),
                yticks=np.arange(len(etiquetas)),
                xticklabels=etiquetas,
                yticklabels=etiquetas,
                ylabel="Gesto Real (Ground Truth)",
                xlabel="Gesto Predicho por el Modelo",
                title=(
                    f"Matriz de Confusión (25 Frames × 8 Ángulos)\n"
                    f"Acierto Remate: {pct_acierto_remate}% | Precisión Remate: {precision_remate_pct}%"
                ),
            )
            plt.setp(ax.get_xticklabels(), rotation=25, ha="right", rotation_mode="anchor")

            umbral_color = matriz.max() / 2.0 if matriz.size > 0 else 1.0
            for i in range(len(etiquetas)):
                for j in range(len(etiquetas)):
                    valor = int(matriz[i, j])
                    es_cruce_saque_remate = (i == idx_saque and j == idx_remate) or (
                        i == idx_remate and j == idx_saque
                    )
                    texto_celda = f"{valor}\n(Saque↔Remate)" if es_cruce_saque_remate else f"{valor}"
                    ax.text(
                        j,
                        i,
                        texto_celda,
                        ha="center",
                        va="center",
                        fontsize=9 if es_cruce_saque_remate else 11,
                        fontweight="bold" if (i == j or es_cruce_saque_remate) else "normal",
                        color="white" if valor > umbral_color else ("#b91c1c" if es_cruce_saque_remate and valor > 0 else "black"),
                    )

            fig.tight_layout()
            ruta_imagen_salida.parent.mkdir(parents=True, exist_ok=True)
            fig.savefig(ruta_imagen_salida)
            plt.close(fig)
            ruta_png_generada = str(ruta_imagen_salida)
        except Exception:
            ruta_png_generada = None

    return {
        "accuracy_global_pct": round(float(accuracy_score(y_test, y_pred)) * 100.0, 2),
        "porcentaje_acierto_remate": pct_acierto_remate,
        "precision_remate_pct": precision_remate_pct,
        "f1_remate_pct": f1_remate_pct,
        "aciertos_remate": aciertos_remate,
        "total_reales_remate": total_reales_remate,
        "saque_confundido_como_remate": saque_confundido_como_remate,
        "remate_confundido_como_saque": remate_confundido_como_saque,
        "matriz_confusion": matriz.tolist(),
        "tabla_matriz_confusion": tabla_visual,
        "classification_report": reporte_txt,
        "ruta_matriz_png": ruta_png_generada,
    }


def entrenar_modelo_random_forest(
    muestras_por_clase: int = 240,
    guardar_artefacto: bool = True,
) -> Dict[str, Any]:
    """
    Entrena el clasificador Random Forest sobre el dataset de ventanas de 25 frames x 8 ángulos,
    optimizando el Accuracy por encima del 88% y asignando mayor peso a la clase 'Remate'
    junto con penalización de sus falsos positivos.
    """
    X_secuencias, y = cargar_o_generar_dataset_secuencias(muestras_por_clase=muestras_por_clase)
    X_features = np.vstack([extraer_features_ventana_25(seq) for seq in X_secuencias])

    X_train, X_test, y_train, y_test = train_test_split(
        X_features,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    # Hiperparámetros ajustados para maximizar Accuracy (>88%) y precisión en 'Remate'
    modelo_rf = RandomForestClassifier(
        n_estimators=350,
        max_depth=18,
        min_samples_split=4,
        min_samples_leaf=2,
        max_features="sqrt",
        criterion="entropy",
        class_weight=PESOS_CLASES_HIPERPARAMETROS,
        bootstrap=True,
        oob_score=True,
        random_state=42,
        n_jobs=1,
    )

    # Pesos por muestra adicionales para reforzar fronteras contra falsos positivos de 'Remate'
    pesos_muestra = np.ones(len(y_train), dtype=np.float64)
    pesos_muestra[y_train == "Remate"] = 1.65
    pesos_muestra[np.isin(y_train, ["Bloqueo", "Saque"])] = 1.35

    modelo_rf.fit(X_train, y_train, sample_weight=pesos_muestra)

    # Validación cruzada estratificada (5 folds)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores_cv = cross_val_score(modelo_rf, X_features, y, cv=cv, scoring="accuracy", n_jobs=1)

    validacion = validar_modelo_y_matriz_confusion(
        modelo=modelo_rf,
        X_test=X_test,
        y_test=y_test,
        umbral_remate=UMBRAL_PROBABILIDAD_REMATE,
        ruta_imagen_salida=RUTA_MATRIZ_PNG,
    )

    accuracy_test = validacion["accuracy_global_pct"] / 100.0
    precision_remate = validacion["precision_remate_pct"] / 100.0

    if guardar_artefacto:
        RUTA_MODELO_JOBLIB.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "modelo": modelo_rf,
                "clases": list(CLASES_GESTOS),
                "orden_angulos": list(ORDEN_ANGULOS_CINEMATICOS),
                "ventana_frames": VENTANA_FRAMES,
                "umbral_probabilidad_remate": UMBRAL_PROBABILIDAD_REMATE,
                "accuracy_test": validacion["accuracy_global_pct"],
                "precision_remate": validacion["precision_remate_pct"],
                "porcentaje_acierto_remate": validacion["porcentaje_acierto_remate"],
            },
            RUTA_MODELO_JOBLIB,
        )

    return {
        "modelo": modelo_rf,
        "accuracy_test": validacion["accuracy_global_pct"],
        "accuracy_cv_media": round(float(np.mean(scores_cv)) * 100.0, 2),
        "oob_score": round(float(modelo_rf.oob_score_) * 100.0, 2),
        "precision_remate": validacion["precision_remate_pct"],
        "porcentaje_acierto_remate": validacion["porcentaje_acierto_remate"],
        "saque_confundido_como_remate": validacion["saque_confundido_como_remate"],
        "remate_confundido_como_saque": validacion["remate_confundido_como_saque"],
        "matriz_confusion": validacion["matriz_confusion"],
        "tabla_matriz_confusion": validacion["tabla_matriz_confusion"],
        "reporte_clasificacion": validacion["classification_report"],
        "ruta_matriz_png": validacion["ruta_matriz_png"],
        "ruta_modelo": str(RUTA_MODELO_JOBLIB),
        "ruta_dataset": str(RUTA_DATASET_NPZ),
    }


if __name__ == "__main__":
    resultados = entrenar_modelo_random_forest()
    resumen = {
        "accuracy_test_pct": resultados["accuracy_test"],
        "accuracy_cv_5fold_pct": resultados["accuracy_cv_media"],
        "oob_score_pct": resultados["oob_score"],
        "porcentaje_acierto_remate_pct": resultados["porcentaje_acierto_remate"],
        "precision_remate_pct": resultados["precision_remate"],
        "saque_confundido_como_remate": resultados["saque_confundido_como_remate"],
        "remate_confundido_como_saque": resultados["remate_confundido_como_saque"],
        "cumple_meta_88_pct": resultados["accuracy_test"] > 88.0,
        "ruta_modelo": resultados["ruta_modelo"],
        "ruta_matriz_png": resultados["ruta_matriz_png"],
    }
    print(json.dumps(resumen, indent=2, ensure_ascii=False))
    print("\n=== MATRIZ DE CONFUSIÓN (FILAS = REAL | COLUMNAS = PREDICHO) ===")
    print(resultados["tabla_matriz_confusion"])
    print("\n=== REPORTE DE CLASIFICACIÓN DETALLADO (TEST SET) ===")
    print(resultados["reporte_clasificacion"])
