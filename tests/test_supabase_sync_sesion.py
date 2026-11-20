"""
Suite de Verificación de Sincronización SaaS con Supabase (Tabla 'sesiones').
Verifica:
  1. `backend/api/db_sync.py`: configuración de `SUPABASE_URL` / `SUPABASE_KEY` y `guardar_resumen_sesion(datos_sesion)`
     insertando en la tabla `sesiones` (`fecha`, `total_saltos`, `salto_maximo_cm`, `alertas_fatiga`, `gestos_entrenados`).
  2. `backend/api/router.py`: endpoint `POST /api/sesiones/finalizar`.
  3. `frontend/js/reporte.js`: bloque `fetch` asíncrono a `/api/sesiones/finalizar` inmediatamente después de descargar
     `VolleyScan_Reporte.pdf` y notificación Toast `"Sesión guardada exitosamente en la nube"`.
"""

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from fastapi.testclient import TestClient
import main
from backend.api import db_sync
from backend.api.db_sync import guardar_resumen_sesion


class _MockSupabaseQuery:
    def __init__(self, storage_list):
        self._storage = storage_list
        self._payload = None

    def insert(self, payload):
        self._payload = payload
        return self

    def execute(self):
        self._storage.append(self._payload)

        class _Resp:
            data = [self._payload]

        return _Resp()


class _MockSupabaseClient:
    def __init__(self):
        self.tablas = {}

    def table(self, nombre_tabla: str):
        if nombre_tabla not in self.tablas:
            self.tablas[nombre_tabla] = []
        return _MockSupabaseQuery(self.tablas[nombre_tabla])


print("=================================================================")
print("🧪 TEST DE PERSISTENCIA SAAS CON SUPABASE (FINALIZAR SESIÓN)")
print("=================================================================")

# 1. Prueba directa de guardar_resumen_sesion() con Mock de cliente Supabase
print("\n[1] Verificando inserción en tabla 'sesiones' mediante guardar_resumen_sesion()...")
mock_client = _MockSupabaseClient()
cliente_original = db_sync.supabase_client
db_sync.supabase_client = mock_client

payload_prueba = {
    "fecha": "2026-11-05T15:10:00Z",
    "total_saltos": 14,
    "salto_maximo_cm": 51.8,
    "alertas_fatiga": 2,
    "gestos_entrenados": ["Remate", "Bloqueo", "Voleo"],
}

res_directo = guardar_resumen_sesion(payload_prueba)
assert res_directo["status"] == "ok"
assert res_directo["sincronizado_supabase"] is True
assert "sesiones" in mock_client.tablas, "No se invocó .table('sesiones') en el cliente Supabase"
registro_insertado = mock_client.tablas["sesiones"][0]
for campo in ("fecha", "total_saltos", "salto_maximo_cm", "alertas_fatiga", "gestos_entrenados"):
    assert campo in registro_insertado, f"Falta el campo '{campo}' en el registro insertado en 'sesiones'"
assert registro_insertado["total_saltos"] == 14
assert registro_insertado["salto_maximo_cm"] == 51.8
assert registro_insertado["alertas_fatiga"] == 2
assert registro_insertado["gestos_entrenados"] == ["Remate", "Bloqueo", "Voleo"]
print(f"  ✅ Registro insertado en tabla 'sesiones': {registro_insertado}")

# 2. Prueba del endpoint POST /api/sesiones/finalizar
print("\n[2] Verificando endpoint POST /api/sesiones/finalizar...")
client = TestClient(main.app)
resp_api = client.post("/api/sesiones/finalizar", json={
    "fecha": "2026-11-05T15:15:00Z",
    "total_saltos": 18,
    "salto_maximo_cm": 54.2,
    "alertas_fatiga": 1,
    "gestos_entrenados": ["Remate", "Saque", "Recepción"],
})
assert resp_api.status_code == 200, f"Status inesperado: {resp_api.status_code}"
json_api = resp_api.json()
assert json_api["status"] == "ok"
assert json_api["mensaje"] == "Sesión guardada exitosamente en la nube"
assert json_api["sesion"]["total_saltos"] == 18
assert json_api["sesion"]["gestos_entrenados"] == ["Remate", "Saque", "Recepción"]
print(f"  ✅ Endpoint POST /api/sesiones/finalizar respondió 200 OK: {json_api['mensaje']}")

db_sync.supabase_client = cliente_original

# 3. Verificación de frontend/js/reporte.js (fetch + Toast)
print("\n[3] Verificando integración en frontend/js/reporte.js...")
ruta_reporte_js = os.path.join(ROOT_DIR, "frontend", "js", "reporte.js")
with open(ruta_reporte_js, "r", encoding="utf-8") as f_js:
    codigo_js = f_js.read()

assert 'fetch("/api/sesiones/finalizar"' in codigo_js, "Falta llamada fetch a /api/sesiones/finalizar en reporte.js"
assert '"Sesión guardada exitosamente en la nube"' in codigo_js, "Falta mensaje Toast requerido en reporte.js"
for clave_req in ("fecha", "total_saltos", "salto_maximo_cm", "alertas_fatiga", "gestos_entrenados"):
    assert clave_req in codigo_js, f"Falta clave '{clave_req}' en el payload enviado desde reporte.js"

print("  ✅ Integración en frontend/js/reporte.js (fetch POST + Toast visual) verificada.")
print("\n🏆 SINCRONIZACIÓN SAAS CON SUPABASE VERIFICADA AL 100%")
