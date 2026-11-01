"""Genera las referencias de los diez transeúntes en ComfyUI local (Z-Image-Turbo).

Mismo workflow y estilo chibi que marta_referencia.png: figura entera de frente
sobre fondo gris liso. Solo guían el modelado procedural de generar.py (paleta,
peinado, ropa y accesorio de cada uno); el juego no las usa.

Ejecutar con la API local activa:
python assets/transeuntes/generar_referencias_comfy.py [id ...]
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
REFS = HERE / "referencias"
COMFY_URL = "http://127.0.0.1:8188"

ESTILO = (
    "cute chibi 3D character for a cozy farming village game, stylized clay toy look, big "
    "round head about 40 percent of the height, short body, simple dot eyes, rosy cheeks, "
    "smooth soft plastic materials with flat colors, full body standing straight in a "
    "relaxed A-pose, front view, centered, whole figure visible with the feet, plain "
    "neutral dark gray studio background, soft lighting, no text, no props on the floor."
)

# id: (semilla, descripción). Paletas y tocados como en data/villagers.ts.
PERSONAJES = {
    "rosa": (
        2611020001,
        "A sweet grandmother villager, short and plump, white-gray hair gathered in a round "
        "bun on top, small round glasses, plum purple cardigan over a lavender blouse, long "
        "dark purple skirt to the ankles, black flat shoes, holding a small wicker basket.",
    ),
    "pablo": (
        2611020002,
        "A cheerful young boy villager, small and slim, dark brown messy short hair, red "
        "baseball cap, bright blue t-shirt, dark navy shorts, white sneakers, big smile.",
    ),
    "ernesto": (
        2611020003,
        "A stout old farmer villager, broad body, gray hair and a full gray beard, wide "
        "straw sombrero hat, cream white shirt with rolled sleeves, brown work trousers "
        "with a dark belt, brown boots.",
    ),
    "clara": (
        2611020004,
        "A friendly baker woman villager with dark brown skin, black hair under a teal "
        "head scarf tied at the back, mustard yellow blouse, white apron, navy blue long "
        "skirt, brown shoes.",
    ),
    "mateo": (
        2611020005,
        "A tall lanky young man villager, fair skin with freckles, messy ginger red hair, "
        "no hat, green sweater, brown corduroy trousers, dark brown boots, a red scarf.",
    ),
    "ines": (
        2611020006,
        "A young woman villager, tan skin, chestnut brown hair in a round bun, coral red "
        "short sleeve blouse, charcoal gray long trousers, white shoes, small brown "
        "shoulder bag.",
    ),
    "bruno": (
        2611020007,
        "A big strong woodcutter villager with dark brown skin, very broad shoulders, short "
        "black hair, dark green cap, charcoal gray long sleeve shirt, blue denim overalls, "
        "brown work boots, short black beard.",
    ),
    "lucia": (
        2611020008,
        "A young painter girl villager, fair rosy skin, long blonde hair down to the "
        "shoulders, pink sun hat with a wide brim, light sky blue dress, white stockings, "
        "pink shoes.",
    ),
    "anselmo": (
        2611020009,
        "An old gentleman villager, medium tan skin, gray hair and gray mustache, dark "
        "brown felt fedora hat, brown tweed vest over a white shirt, dark brown trousers, "
        "black shoes, walking with a wooden cane.",
    ),
    "nuria": (
        2611020010,
        "A busy young office woman villager, fair skin, black hair in a short bob, yellow "
        "head scarf band, purple jacket, black trousers, black shoes, holding a leather "
        "briefcase.",
    ),
}


def workflow(nombre: str, seed: int, prompt: str) -> dict[str, object]:
    return {
        "3": {"class_type": "KSampler", "inputs": {"model": ["11", 0], "positive": ["27", 0], "negative": ["33", 0], "latent_image": ["13", 0], "seed": seed, "steps": 8, "cfg": 1.0, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["29", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": f"transeunte_{nombre}"}},
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


REFS.mkdir(exist_ok=True)
# Sin argumentos genera todos; con argumentos, solo los nombrados.
for nombre, (seed, descripcion) in PERSONAJES.items():
    if len(sys.argv) > 1 and nombre not in sys.argv[1:]:
        continue
    graph = workflow(nombre, seed, f"{descripcion} {ESTILO}")
    (REFS / f"zimage_{nombre}.json").write_text(json.dumps(graph, indent=2) + "\n")
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
        (REFS / f"{nombre}.png").write_bytes(response.read())
    print("ok", REFS / f"{nombre}.png", flush=True)
