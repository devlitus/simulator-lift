"""Convierte las texturas crudas de ComfyUI en mosaicos sin costuras.

Mezcla cada imagen con su copia desplazada media baldosa: en los bordes
manda la copia desplazada (continua en los bordes) y en el centro la
original (continua en el centro), con una ventana senoidal entre ambas.
También genera `variacion_suelo`, un mapa de tinte a gran escala que
el juego multiplica sobre el césped para romper la repetición.

python assets/escenario/hacer_tileable.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[1] / "public" / "textures"


def tileable(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    rolled = np.roll(img, (h // 2, w // 2), axis=(0, 1))
    wy = np.sin(np.linspace(0, np.pi, h)) ** 2
    wx = np.sin(np.linspace(0, np.pi, w)) ** 2
    weight = np.sqrt(np.outer(wy, wx))[..., None]
    return img * weight + rolled * (1 - weight)


def cargar(nombre: str, recorte: float = 0.0) -> np.ndarray:
    img = Image.open(HERE / f"{nombre}_cruda.png").convert("RGB")
    if recorte:
        w, h = img.size
        m = int(w * recorte)
        img = img.crop((m, m, w - m, h - m))
    return np.asarray(img, dtype=np.float32)


def guardar(arr: np.ndarray, nombre: str, lado: int, publicar: bool = True) -> None:
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    img = img.resize((lado, lado), Image.LANCZOS)
    destino = HERE / f"{nombre}.png"
    img.save(destino, optimize=True)
    print("ok", destino)
    if not publicar:
        return
    # El juego recibe JPG: el césped en PNG pesa más de 2 MB
    PUBLIC.mkdir(parents=True, exist_ok=True)
    img.save(PUBLIC / f"{nombre}.jpg", quality=88)


def ruido_valor(lado: int, celdas: int, rng: np.random.Generator) -> np.ndarray:
    """Ruido de valor periódico (bicúbico) de `celdas`×`celdas` puntos de control."""
    puntos = rng.random((celdas, celdas))
    t = np.arange(lado) * celdas / lado
    i0 = np.floor(t).astype(int)
    f = t - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % celdas
    filas = puntos[i0] * (1 - f)[:, None] + puntos[i1] * f[:, None]
    return filas[:, i0] * (1 - f)[None, :] + filas[:, i1] * f[None, :]


def variacion(lado: int = 256) -> np.ndarray:
    rng = np.random.default_rng(2610010021)
    n = (
        ruido_valor(lado, 4, rng) * 0.5
        + ruido_valor(lado, 8, rng) * 0.3
        + ruido_valor(lado, 16, rng) * 0.2
    )
    n = (n - n.min()) / (n.max() - n.min())
    seco = np.array([1.0, 0.97, 0.78])  # parches más secos, amarillentos
    base = np.array([0.93, 0.96, 0.88])
    fresco = np.array([0.74, 0.86, 0.72])  # zonas más frondosas y oscuras
    t = n[..., None]
    color = np.where(t < 0.5, fresco + (base - fresco) * (t / 0.5), base + (seco - base) * ((t - 0.5) / 0.5))
    return color * 255


guardar(tileable(cargar("cesped")), "cesped", 1024)
guardar(tileable(cargar("roca", recorte=0.2)), "roca", 512, publicar=False)  # va en el GLB
guardar(variacion(), "variacion_suelo", 256)
