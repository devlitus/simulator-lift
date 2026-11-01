"""Genera referencias reproducibles para Hunyuan3D en ComfyUI local.

Ejecutar con la API local activa:
python assets/flores_lila/generar_referencias_comfy.py
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
COMFY_URL = "http://127.0.0.1:8188"
COMFY_OUTPUT = Path("/home/carle/ai/ComfyUI/output")

PROMPTS = {
    "margarita": (
        1709202611,
        "A single stylized low-poly daisy flower plant with white petals around a warm yellow center, two broad green leaves and a short slender stem. Cozy hand-painted matte 3D farming-game asset, readable chunky silhouette, front three-quarter view. Soft diffused studio light from upper left. Plain light gray studio background, centered composition, entire plant visible with generous margins, no ground platform, no pot, no vase, no people, no insects, no text, no logo.",
    ),
    "tulipan": (
        1709202612,
        "A single stylized low-poly coral tulip plant with a closed pink-coral bloom, two long curved green leaves and a short sturdy stem. Cozy hand-painted matte 3D farming-game asset, readable chunky silhouette, front three-quarter view. Soft diffused studio light from upper left. Plain light gray studio background, centered composition, entire plant visible with generous margins, no ground platform, no pot, no vase, no people, no insects, no text, no logo.",
    ),
    "lavanda": (
        1709202613,
        "A single stylized low-poly lavender plant with three upright purple flower spikes, narrow sage-green leaves and short stems. Cozy hand-painted matte 3D farming-game asset, readable chunky silhouette, front three-quarter view. Soft diffused studio light from upper left. Plain light gray studio background, centered composition, entire plant visible with generous margins, no ground platform, no pot, no vase, no people, no insects, no text, no logo.",
    ),
    "amapola": (
        1709202614,
        "A single stylized low-poly red poppy plant with four wide scarlet petals, a dark rounded center, two jagged green leaves and a slender stem. Cozy hand-painted matte 3D farming-game asset, readable chunky silhouette, front three-quarter view. Soft diffused studio light from upper left. Plain light gray studio background, centered composition, entire plant visible with generous margins, no ground platform, no pot, no vase, no people, no insects, no text, no logo.",
    ),
    "campanilla": (
        1709202615,
        "A single stylized low-poly bluebell plant with three small hanging cobalt-blue bell flowers, narrow green leaves and curved slender stems. Cozy hand-painted matte 3D farming-game asset, readable chunky silhouette, front three-quarter view. Soft diffused studio light from upper left. Plain light gray studio background, centered composition, entire plant visible with generous margins, no ground platform, no pot, no vase, no people, no insects, no text, no logo.",
    ),
}


def workflow(name: str, seed: int, prompt: str) -> dict[str, object]:
    return {
        "3": {"class_type": "KSampler", "inputs": {"model": ["11", 0], "positive": ["27", 0], "negative": ["33", 0], "latent_image": ["13", 0], "seed": seed, "steps": 8, "cfg": 1.0, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["29", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": f"flor_{name}_referencia"}},
        "11": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["28", 0], "shift": 3.0}},
        "13": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "27": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["30", 0]}},
        "28": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
        "29": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "30": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_fp8_mixed.safetensors", "type": "lumina2", "device": "default"}},
        "33": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["27", 0]}},
    }


def request_json(path: str, payload: dict[str, object]) -> dict[str, object]:
    request = Request(f"{COMFY_URL}{path}", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request) as response:
        return json.load(response)


for variety, (seed, prompt) in PROMPTS.items():
    graph = workflow(variety, seed, prompt)
    (ROOT / "assets" / "flores_lila" / f"zimage_{variety}.json").write_text(json.dumps(graph, indent=2) + "\n")
    target = ROOT / "assets" / "flores_lila" / f"flor_{variety}_referencia.png"
    if target.exists():
        continue
    prompt_id = request_json("/prompt", {"prompt": graph})["prompt_id"]
    while True:
        with urlopen(f"{COMFY_URL}/history/{prompt_id}") as response:
            history = json.load(response)
        if prompt_id in history:
            break
        time.sleep(2)
    output = history[prompt_id]["outputs"]["9"]["images"][0]
    source = COMFY_OUTPUT / output["subfolder"] / output["filename"]
    shutil.copy2(source, target)
