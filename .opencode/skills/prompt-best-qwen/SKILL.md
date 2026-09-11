---
name: prompt-best-qwen
description: Use when generating or editing images with Qwen-Image, Qwen-Image-Edit, Qwen-Image-Edit-2511 in ComfyUI — provides official prompting best practices, edit taxonomy, text-rendering rules and parameter recipes.
---

# Qwen Image / Qwen-Image-Edit Prompt Best Practices

Source: [qwen.ai/blog?id=qwen-image-edit](https://qwen.ai/blog?id=qwen-image-edit) + mirror [qwenlm.github.io/blog/qwen-image-edit](https://qwenlm.github.io/blog/qwen-image-edit/) and official `prompt_utils.py` (`QwenLM/Qwen-Image/src/examples/tools/prompt_utils.py`). Model: **Qwen-Image 20B** base + **Qwen-Image-Edit / 2511** (dual encoding: `Qwen2.5-VL` for semantic control + `VAE Encoder` for appearance control).

Use this skill whenever you touch a Qwen ComfyUI workflow (`qwen_multiref_3img.json`, `z_image_turbo_int8.json`, etc.) or need to write `positive_prompt` / `negative_prompt` for Qwen.

## 1. Two Editing Modes (from official blog)

| Mode | What it does | Pixel behavior | Example |
|------|--------------|----------------|---------|
| **Appearance editing** | Add/remove/modify a *local* element | All other regions **must stay exactly unchanged** | Add a signboard with reflection, remove hair strands, change letter "n" to blue, change background/clothing |
| **Semantic editing** | High-level change preserving *semantic identity* | Most pixels change, identity preserved | IP creation (Capybara MBTI emoji packs), 90°/180° novel view synthesis, style transfer to Ghibli |

> Qwen-Image-Edit also has **precise bilingual text editing** (CN/EN) that preserves font/size/style, and chained editing (red/blue boxes) to iteratively fix characters like `稽` → `旨` in chained steps.

## 2. Golden Rules (T2I + Edit)

1. **Structured > narrative.** Qwen was trained on labeled structured data. Categorized prompts are ~30% more accurate than flowing prose.
2. **1–3 sentences, 50–200 chars for edits.** Concise beats verbose. 31-word prompt outperformed 82-word variant in composition + 8s faster.
3. **Subject FIRST.** Wrong: `Gray background, soft lighting, navy blazer, executive`. Right: `Professional headshot of 45-year-old executive, navy blazer / neutral gray background / soft studio lighting`.
4. **Gradual adjustments.** Tone → local detail → lighting. Don't request all complex mods at once.
5. **Always quote text** to render: `"OPEN"` not `OPEN` — spelling accuracy 65% → 85%.

## 3. T2I Prompt Structure (for `qwen_image` generation)

From `polish_prompt_en/zh` system prompt:

```
[Main subject + key attributes], [visual style / medium], [spatial relations / composition], [shot composition / lens]
+ magic suffix: "Ultra HD, 4K, cinematic composition" / "超清，4K，电影级构图"
+ keep under 200 words
```

**Template:**
```
[Subject: e.g., Professional headshot of 45-year-old executive, navy blazer]
[Background: neutral gray background]
[Lighting/style: soft studio lighting, natural skin texture]
[Shot: shot on Canon EOS R5, 85mm f/1.4]
Negative: blurry, low quality, pixelated, distorted, watermark...
```

**If text in image:** Enclose in double quotes, specify position + style, never translate the quoted text:
```
A poster with text "SUMMER SALE" at top-center, bold sans-serif, red on white, ...
Ultra HD, 4K, cinematic composition
```

Chinese uses same structure with `polish_prompt_zh` — output in Chinese, same quotation rule.

## 4. Edit Prompt Taxonomy (from `polish_edit_prompt`)

The official enhancer (`EDIT_SYSTEM_PROMPT`) classifies 6 task types. Your prompt **must** match one:

### 4.1 Add / Delete / Replace
- Clear instruction = keep intent, just fix grammar.
- Vague = infer and supplement: position (near subject/empty space/center), quantity, attributes must align with scene logic/style.
- Delete → describe *result after removal*, not the object to delete. Inpainting needs background completion.

```
Good: "Change the character's blue t-shirt to a red hoodie, maintain original pose"
Bad:  "Change clothes"

Good: "Remove the person on the left, fill background with beach sand, no distortion"
```

### 4.2 Attribute Change (color, pose, material)
Specify **entity + attribute + new value**. Keep unchanged attributes explicit.

```
"Change the letter 'n' color to blue, keep font and size unchanged"
"Rotate the object 90 degrees to the right, keep texture unchanged"
```

### 4.3 Style Transfer
Put style description **at the end** if other edits exist. Preserve content, describe reference style.

```
"Keep the portrait composition unchanged, transfer to Studio Ghibli style, soft watercolor, hand-drawn outline"
```

### 4.4 Text Editing (Qwen's superpower)
Add/delete/modify CN/EN text while preserving font/size/style. Always quote exact string and location.

```
"Replace text 'Hello' at top-left with 'OPEN', keep original font style and color"
"Add text '2026' at bottom-right, white bold sans-serif, same style as headline"
"Delete text 'SALE' and inpaint background seamlessly"
```

For small text, do **chained editing**: mark red/blue boxes, correct step-by-step. obscured characters like `稽` need two passes.

### 4.5 Tone / Color Adjustment
Use color-theory + emotion semantics.

```
"Adjust tone to warm golden hour, increase saturation slightly, cinematic color grading"
```

### 4.6 Multi-Image (critical for `qwen_multiref_3img.json`)
Must explicitly name which image's element. For stylization, describe reference style but preserve source content.

```
Original (bad): "Replace the subject of picture 1 with picture 2"
Rewritten (good): "Replace the girl of picture 1 with the boy of picture 2, keeping picture 2's background unchanged"

Current workflow (image1=subject, image2/3=style):
"Combine image 1, image 2 and image 3 into a single coherent scene, keeping the subject from image 1 and the style/elements from images 2 and 3"
```

> Also fixed templates: inpainting → `Perform inpainting on this image. The original caption is: ...` ; outpainting → `Extend the image beyond its boundaries using outpainting. The original caption is: ...`

## 5. Parameter Recipes

| Scenario | CFG | Steps | Resolution | Notes |
|----------|-----|-------|------------|-------|
| Quick composition test | 3.0–4.0 | 20–30 | 1024×1024 | ~7/10 quality, fast |
| **General / portrait (default)** | **4.0–5.0** | **40–50** | 1024–1536 | Sweet spot — alive but faithful |
| Precise / product | 5.0–7.0 | 50 | 1024×1024 | More rigid |
| Product / text-heavy | 7.0–10.0 | 50–60 | 1024×1024 | Spelling > naturalness |
| Final print | 4.5 | 60+ | 1536 | +5% detail only |

**Guidance (`true_cfg_scale` in ComfyUI):** 4.0 recommended in `prompt_utils.py` (`true_cfg_scale=4.0, num_inference_steps=50`). Segmind tests: CFG 4–5 ideal, 10 = over-constrained, 2.5 = too creative.

**Seed:** Fix seed to iterate prompt without composition shift. Ideal for series (same shoe, different angles) — lock seed `12345`, only change viewpoint.

**Negative prompts — always use:**
```
Universal: blurry, low quality, pixelated, distorted, watermark, text overlay, oversaturated, plastic-looking, artificial
Portrait +: extra fingers, deformed hands, unnatural proportions, smooth plastic skin, over-smoothed, airbrushed
Product  +: unrealistic reflections, fake materials, poor lighting, overexposed highlights
Text     +: misspelled text, garbled letters, unreadable font, overlapping characters
```

## 6. ComfyUI Wiring (this repo)

- **Workflow `qwen_multiref_3img.json:170`** (subgraph `cdb2cf24...`): 3× `LoadImage` (IDs 41/83/195) → `Image Edit (Qwen-Image 2511)` → `SaveImage`. Inputs: `image1` (subject), `image2`/`image3` (style refs), `positive_prompt`, `negative_prompt`, `unet_name` (`qwen_image_edit_2511_*`), `clip_name` (`qwen_2.5_vl_7b_fp8_scaled.safetensors`), `vae_name` (`qwen_image_vae.safetensors`), `lora_name` (`...Lightning-4steps...`), seed.
- Use `list_workflow_slots` / `set_workflow_slot` to patch `positive_prompt` without hand-editing `definitions.subgraphs`.
- Validate before run: `validate_workflow(workflow_path)` → `workflow_deps` → `install_node` if needed. Model files under `models/{diffusion_models,vae,loras,text_encoders}/` per Note node 82.
- Resolution: ComfyUI `FluxKontextImageScale` inside subgraph; upstream advise 1024×1024–1536×1536. Larger than 2048 wastes VRAM for diminishing returns.

## 7. Quick Checklist Before Queue

- [ ] Prompt is 1–3 sentences, subject first, quoted text if any, <200 words + magic suffix?
- [ ] Edit type explicit (add/delete/replace/style/text/multi-image) and position/quantity filled?
- [ ] Multi-image names picture N explicitly?
- [ ] Negative prompt included?
- [ ] CFG 4.5 / Steps 50 / Seed fixed for iteration?
- [ ] Resolution 1024–1536 and workflow validated?

## 8. Example Rewrites (from `prompt_utils.py` + blog)

**T2I brief → polished:**
```
Input: "a cat"
Polished: "A fluffy orange tabby cat lounging on a sunlit windowsill, photorealistic, soft natural light, shallow depth of field, shot on Sony A7R IV, 50mm f/1.2. Ultra HD, 4K, cinematic composition"
```

**Edit vague → specific (via `polish_edit_prompt`):**
```
Input: "make it like Ghibli"
Rewritten: "Keep the girl's pose and clothing unchanged, transfer the image to Studio Ghibli anime style, soft pastel colors, hand-drawn texture, cinematic composition"

Input: "add a hat"
Rewritten: "Add a red beret on the girl's head, centered, wool texture, keeping face and background unchanged"
```

References: official blog images demonstrate capybara IP consistency, 180° view synthesis, text color change on single letter, chained calligraphy correction — all rely on direct, specific prompts via `polish_edit_prompt`.
