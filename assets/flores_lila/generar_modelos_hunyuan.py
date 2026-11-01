"""Convierte las referencias de flores en GLB texturizados con Hunyuan3D local.

Requiere el servidor de `/home/carle/works/Hunyuan3D-2` en el puerto 8081.
"""

from __future__ import annotations

import base64
import json
import shutil
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
API_URL = "http://127.0.0.1:8081/generate"
VARIETIES = {
    "margarita": 1709202701,
    "tulipan": 1709202702,
    "lavanda": 1709202703,
    "amapola": 1709202704,
    "campanilla": 1709202705,
}
SOURCE_DIR = ROOT / "assets" / "models"
PUBLIC_DIR = ROOT / "public" / "models"


for variety, seed in VARIETIES.items():
    filename = f"flor_{variety}.glb"
    target = SOURCE_DIR / filename
    if target.exists():
        continue
    image = ROOT / "assets" / "flores_lila" / f"flor_{variety}_referencia.png"
    payload = {
        "image": base64.b64encode(image.read_bytes()).decode(),
        "seed": seed,
        "num_inference_steps": 5,
        "guidance_scale": 5.0,
        "octree_resolution": 128,
        "texture": True,
        "face_count": 12000,
        "type": "glb",
    }
    request = Request(
        API_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=1800) as response:
        target.write_bytes(response.read())
    shutil.copy2(target, PUBLIC_DIR / filename)
