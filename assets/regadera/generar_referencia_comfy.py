"""Genera la referencia de la regadera en ComfyUI local (Z-Image-Turbo).

Mismo workflow que las flores de Lila. La imagen se descarga por la API
(/view), así que funciona tanto si ComfyUI corre en WSL como en Windows.

Ejecutar con la API local activa:
python assets/regadera/generar_referencia_comfy.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
COMFY_URL = "http://127.0.0.1:8188"
SEED = 1711010001
PROMPT = (
    "A single stylized low-poly metal watering can, rounded cylindrical sage-green "
    "body with a darker green rim band, a curved arched handle on top, a long thin "
    "straight spout angled upward from the lower front ending in a round perforated "
    "brass sprinkler rose. Cozy hand-painted matte 3D farming-game prop, readable "
    "chunky silhouette, clean side view with the spout pointing to the right. Soft "
    "diffused studio light from upper left. Plain light gray studio background, "
    "centered composition, entire object visible with generous margins, no water, "
    "no ground platform, no plants, no people, no text, no logo."
)


def workflow() -> dict[str, object]:
    return {
        "3": {"class_type": "KSampler", "inputs": {"model": ["11", 0], "positive": ["27", 0], "negative": ["33", 0], "latent_image": ["13", 0], "seed": SEED, "steps": 8, "cfg": 1.0, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["29", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": "regadera_referencia"}},
        "11": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["28", 0], "shift": 3.0}},
        "13": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "27": {"class_type": "CLIPTextEncode", "inputs": {"text": PROMPT, "clip": ["30", 0]}},
        "28": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
        "29": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "30": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_fp8_mixed.safetensors", "type": "lumina2", "device": "default"}},
        "33": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["27", 0]}},
    }


def post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
    request = Request(f"{COMFY_URL}{path}", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request) as response:
        return json.load(response)


graph = workflow()
(HERE / "zimage_regadera.json").write_text(json.dumps(graph, indent=2) + "\n")
prompt_id = post_json("/prompt", {"prompt": graph})["prompt_id"]
while True:
    with urlopen(f"{COMFY_URL}/history/{prompt_id}") as response:
        history = json.load(response)
    if prompt_id in history:
        break
    time.sleep(2)
image = history[prompt_id]["outputs"]["9"]["images"][0]
query = urlencode({"filename": image["filename"], "subfolder": image["subfolder"], "type": image["type"]})
with urlopen(f"{COMFY_URL}/view?{query}") as response:
    (HERE / "regadera_referencia.png").write_bytes(response.read())
print("ok", HERE / "regadera_referencia.png")
