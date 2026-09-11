---
name: minimax-h3-prompting
description: Best practices for writing prompts for the MiniMax H3 video model (official formula, reference roles, scene-by-scene timeline, audio and common mistakes), applied to the local video_minimax_h3_i2v workflow of this ComfyUI installation
type: prompt
whenToUse: When the user asks to create, generate, or produce a video (spot, ad, clip, animation) from text or an image, especially if they use or mention the MiniMax workflow (video_minimax_h3_i2v.json) or the MiniMax H3 model
---

# Prompting for MiniMax H3 (local ComfyUI)

Guide for writing the prompt before running the MiniMax H3 workflow. Based on the
official MiniMax manual (via https://pixo.video/es/blog/minimax-h3-prompt-guide).

## Official prompt formula

**Full prompt = reference material notes + core idea + scene-by-scene description.**

Three blocks, in that order. Mistake #1 is cramming everything into a single paragraph.

1. **References**: each uploaded file is numbered in order (`@image1`, `@video1`,
   `@audio1`) and needs a declared role. In the local i2v workflow there is only one image:
   `@image1 is the first frame` (or "character reference / object reference / scene reference",
   depending on what it should lock in). A file without a declared role is ignored.
2. **Core idea**: subject + place + action + genre/style (cinematic, commercial,
   documentary…). Optional: camera behavior. H3 cuts between shots by default;
   for a continuous take, say so explicitly. Concrete camera movements
   ("slow push-in", "truck left + pan right"), never vague ones ("orbit").
3. **Scene by scene**: what happens over time, with `[0s-1.5s]`, `[1.5s-3s]`… marks
   matched to the actual duration configured in the workflow (the instance node of subgraph
   105 stores the seconds in `widgets_values[3]`; default is 5 s ≈ 124 frames at 24 fps).
   Dialogue must be written verbatim: `She says: "…"` (with lip sync).

## Rules that save generations

- Write what the camera sees, not what it means: "neon reflected on the wet jacket"
  beats "melancholic urban atmosphere".
- On-screen text: quote it exactly, in quotation marks.
- No background music: end the prompt with `non_diegetic_music: N/A`. Never request a
  soundtrack in one line and forbid it in another (contradiction = failure).
- When cutting to a new shot, name the new shot size and the already-established subject
  (keeps faces consistent).
- Describe the video's audio: H3 generates sound; specify ambience, music, and effects per
  scene, or disable it with the rule above.

## Mistakes the manual warns about (avoid them)

- A single undifferentiated paragraph → use the three blocks.
- Uploaded files without a declared role → "@image1 is the reference for X".
- Requesting music while forbidding BGM at the same time.
- Wanting a single take but writing "Shot 1 / Shot 2" → narrate in one continuous paragraph.
- Requesting facial consistency without a tagged reference image.
- A prompt that's too short with no files: minimum is subject appearance + scene + action + style.

## Template for the local i2v workflow (image → video, ~5 s)

```
@image1 is the first frame: <what the image locks in: character / product / scene>.
[Core idea] <subject + place + action>, <style: cinematic commercial, etc.>;
<a continuous take with a slow push-in | hard cuts synced to the rhythm>.
[Process] [0s-1.5s] … [1.5s-3s] … [3s-4s] … [4s-5s] <final composition that holds>.
Audio: <music/ambience/effects per scene, or "non_diegetic_music: N/A">.
```

## Procedure on this installation (portable ComfyUI)

1. Workflow: `user/default/workflows/video_minimax_h3_i2v.json`. Work on a copy,
   never on the user's original.
2. Upload the image with `upload_file` and point the `LoadImage` node (slot `114.image`) to
   the uploaded filename.
3. **Subgraph trap**: `set_workflow_slot` with `105/104.prompt` only updates the
   inner definition. The prompt that actually runs is in `widgets_values[0]`
   of instance node 105 (its `type` is a UUID). Edit it with a Python script
   (`python_embeded/python.exe`) and keep both in sync. Details in the
   "Local Workflow Editing via comfy-cli MCP" section of the root AGENTS.md.
4. Validate with `validate_workflow`, run with `run_workflow` (`wait=False`), and poll with
   `job(action="wait", timeout_seconds=110)` until it completes.
5. The video comes out at `output/video/<filename_prefix>_00001_.mp4`; read it with ReadMediaFile
   to verify it before considering it good.

ARGUMENTS: description of the desired video and path of the input image (if any)
