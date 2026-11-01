"""Genera la referencia y las texturas de la entrada en ComfyUI local (Z-Image-Turbo).

Mismo workflow que las texturas de la casa y del almacén. Cada imagen se descarga
por la API (/view) como `<nombre>.png`; `referencia` solo guía el modelado y las
demás las usa generar.py.

Ejecutar con la API local activa:
python assets/entrada_granja/generar_referencias_comfy.py [nombre ...]
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
COMFY_URL = "http://127.0.0.1:8188"

ESTILO = (
    "stylized hand-painted cozy farming game texture, flat orthographic view, the surface "
    "fills the entire frame edge to edge, flat even diffuse lighting, low contrast, no "
    "shadows, no perspective, no objects, no text."
)

IMAGENES = {
    "referencia": (
        2611030001,
        "Charming rustic farm entrance gate, a timber archway with two thick log posts on "
        "fieldstone bases, a small red shingled gable roof on top, a blank wooden sign hanging "
        "from chains under the beam, two open wooden gate leaves, hanging lanterns and flower "
        "boxes at the sides, stylized low-poly cozy farming game art, three-quarter view, plain "
        "light background, no people, no text.",
    ),
    "madera": (
        2611030012,
        "Continuous warm brown wood grain, one single solid piece of timber filling the frame, "
        "long fine grain lines running strictly from top to bottom, no planks, no logs, no "
        "horizontal lines, " + ESTILO,
    ),
    "piedra": (
        2611030003,
        "Irregular rounded fieldstones with mortar joints, warm gray and beige stones, " + ESTILO,
    ),
    "tejas": (
        2611030004,
        "Overlapping rows of hand-made terracotta red roof shingles seen straight on, warm red "
        "and rust tones, " + ESTILO,
    ),
}


def workflow(nombre: str, seed: int, prompt: str) -> dict[str, object]:
    return {
        "3": {"class_type": "KSampler", "inputs": {"model": ["11", 0], "positive": ["27", 0], "negative": ["33", 0], "latent_image": ["13", 0], "seed": seed, "steps": 8, "cfg": 1.0, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["29", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": f"entrada_granja_{nombre}"}},
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


# Sin argumentos genera todas; con argumentos, solo las nombradas.
for nombre, (seed, prompt) in IMAGENES.items():
    if len(sys.argv) > 1 and nombre not in sys.argv[1:]:
        continue
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
        (HERE / f"{nombre}.png").write_bytes(response.read())
    print("ok", HERE / f"{nombre}.png")
