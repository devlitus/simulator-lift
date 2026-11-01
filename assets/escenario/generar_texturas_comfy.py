"""Genera las texturas del escenario en ComfyUI local (Z-Image-Turbo).

Mismo workflow que la regadera y las flores de Lila. Cada textura se
descarga por la API (/view) como `<nombre>_cruda.png`; después
`hacer_tileable.py` la convierte en mosaico sin costuras.

Ejecutar con la API local activa:
python assets/escenario/generar_texturas_comfy.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
COMFY_URL = "http://127.0.0.1:8188"

TEXTURAS = {
    "cesped": (
        2610010011,
        "Seamless tileable stylized hand-painted lawn ground texture, flat orthographic "
        "top-down view, a dense carpet of very short fine grass painted with small soft "
        "brush dabs and tiny strokes, fine uniform detail at a small scale, medium spring "
        "green with gentle mottled patches of lighter yellow-green and slightly deeper "
        "green, low contrast, even flat lighting, no shadows, no large plants, no tufts, no "
        "leaves, no flowers, no stones, no dirt, no objects, no perspective, uniform density "
        "across the whole image, cozy farming game terrain texture, no text.",
    ),
    "roca": (
        2610010013,
        "Stylized hand-painted close-up of the surface of a big weathered granite boulder, "
        "the rock face fills the entire frame edge to edge, soft cool gray with warm beige "
        "patches, painterly brush strokes, gentle mottled variation, a couple of faint thin "
        "cracks and tiny pale lichen specks, flat even diffuse lighting, low contrast, cozy "
        "farming game painted texture, nothing else in the image, no text.",
    ),
}


def workflow(nombre: str, seed: int, prompt: str) -> dict[str, object]:
    return {
        "3": {"class_type": "KSampler", "inputs": {"model": ["11", 0], "positive": ["27", 0], "negative": ["33", 0], "latent_image": ["13", 0], "seed": seed, "steps": 8, "cfg": 1.0, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["29", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": f"escenario_{nombre}"}},
        "11": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["28", 0], "shift": 3.0}},
        "13": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "27": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["30", 0]}},
        "28": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
        "29": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "30": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_fp8_mixed.safetensors", "type": "lumina2", "device": "default"}},
        "33": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["27", 0]}},
    }


def post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
    request = Request(f"{COMFY_URL}{path}", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request) as response:
        return json.load(response)


for nombre, (seed, prompt) in TEXTURAS.items():
    graph = workflow(nombre, seed, prompt)
    (HERE / f"zimage_{nombre}.json").write_text(json.dumps(graph, indent=2) + "\n")
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
        (HERE / f"{nombre}_cruda.png").write_bytes(response.read())
    print("ok", HERE / f"{nombre}_cruda.png")
