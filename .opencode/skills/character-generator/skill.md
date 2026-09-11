---
name: character-generator
description: Generates consistent characters for animation, video production, storytelling, and AI-generated media.
---

The skill creates:

A Character Reference Sheet.
Individual images for each character pose.
Optional facial expression assets.
Production-ready character assets that can later be used for AI video generation.

The primary goal is to maintain visual character consistency across multiple generated images.

Objective

Given a character description, generate a reusable character asset package containing the same character in multiple poses.

The character must maintain:

Visual identity.
Facial features.
Hairstyle.
Skin tone.
Clothing.
Accessories.
Body proportions.
Apparent age.
Artistic style.
Visual palette.
Level of detail.

The pose may change, but the character's identity must remain consistent.

Input

The skill receives a CharacterDefinition object.

{
  "name": "Alex",
  "age": 28,
  "gender": "male",
  "appearance": {
    "hair": "short dark brown hair",
    "eyes": "green",
    "skin": "light skin",
    "body": "athletic"
  },
  "clothing": {
    "top": "dark blue jacket",
    "bottom": "black jeans",
    "shoes": "white sneakers"
  },
  "accessories": [
    "black watch"
  ],
  "personality": [
    "confident",
    "friendly"
  ],
  "art_style": "cinematic realistic",
  "poses": [
    "standing",
    "walking",
    "running",
    "sitting",
    "waving",
    "jumping"
  ]
}
Output

The skill should produce an asset structure similar to:

characters/
└── alex/
    ├── reference/
    │   └── character-reference.png
    │
    ├── poses/
    │   ├── standing.png
    │   ├── walking.png
    │   ├── running.png
    │   ├── sitting.png
    │   ├── waving.png
    │   └── jumping.png
    │
    └── metadata.json
Resolution
Character Reference Sheet

Preferred resolution:

2048 × 2048 px

Aspect ratio:

1:1

The character should be shown full-body.

Individual Pose Assets

Each pose should preferably be generated at:

2048 × 2048 px

Aspect ratio:

1:1

The character should occupy approximately 70–90% of the image.

Leave enough space around the character to prevent cropping.

Phase 1 — Character Reference Sheet

Before generating individual poses, create a character reference sheet.

The reference should contain:

Front view.
3/4 view.
Side view.
Back view.
Full body.
Neutral facial expression.
Complete clothing.
All important accessories.

Example:

        FRONT       3/4       SIDE       BACK

          O          O          O          O
         /|\        /|\        /|\        /|\
         / \        / \        / \        / \

The reference image should use a clean, neutral background.

Avoid complex environments.

Do not include objects that could be confused with parts of the character.

Phase 2 — Identity Lock

After generating the reference sheet, create a structured description of the character.

Example:

{
  "identity": {
    "face": "oval face",
    "eyes": "green almond-shaped eyes",
    "hair": "short dark brown hair",
    "nose": "medium straight nose",
    "skin": "light skin"
  },

  "body": {
    "height": "tall",
    "build": "athletic",
    "proportions": "realistic"
  },

  "clothing": {
    "jacket": "dark blue jacket",
    "pants": "black jeans",
    "shoes": "white sneakers"
  },

  "accessories": [
    "black watch"
  ]
}

This information should be treated as immutable during pose generation.

Phase 3 — Pose Generation

Generate one independent image for each pose.

Each generation should use:

Character Reference
        +
Identity Description
        +
Pose Description
        +
Visual Style

Never rely exclusively on text to reconstruct the character.

Pose Prompt Template

Use the following structure:

Generate a full-body image of the exact same character shown in the
reference image.

CHARACTER IDENTITY:
{identity_description}

CLOTHING:
{clothing_description}

STYLE:
{art_style}

POSE:
{pose_description}

CAMERA:
Full-body shot, eye-level camera, centered composition.

COMPOSITION:
The entire body must be visible from head to feet.
No cropping.
Natural anatomy.
Natural body proportions.

CONSISTENCY:
Preserve the exact same:
- face
- hairstyle
- eye color
- skin tone
- body proportions
- clothing
- shoes
- accessories
- age
- visual style

Only change the character's pose.

BACKGROUND:
Simple neutral background.

OUTPUT:
High-resolution, clean silhouette, production-ready character asset.
Supported Poses

The skill should support at least:

standing
walking
running
sitting
lying
jumping
waving
pointing
looking_back
arms_crossed
hands_in_pockets
thinking
talking
laughing
angry
surprised
scared

The skill should also support custom poses.

Example:

{
  "pose": "The character is running toward the camera while looking over his shoulder."
}
Pose Rules

Each generated pose must:

Maintain realistic anatomy.
Maintain consistent body proportions.
Maintain identical clothing.
Maintain all accessories.
Maintain recognizable facial features.
Avoid distorted hands.
Avoid extra fingers.
Avoid duplicated limbs.
Avoid clothing changes.
Avoid age changes.
Avoid style changes.

The pose should be the primary visual element that changes.

Negative Constraints

When the image generation model supports negative prompts, use:

different character,
different face,
different hairstyle,
different clothing,
different shoes,
different body proportions,
different age,
deformed anatomy,
extra arms,
extra legs,
extra fingers,
missing fingers,
duplicate limbs,
cropped body,
cut off feet,
cut off head,
distorted face,
blurred face,
low resolution,
text,
logo,
watermark,
busy background
Character Consistency

Character consistency has priority over visual variation.

If there is a conflict:

Character Identity > Pose > Composition > Background

Never modify the character's identity to achieve a requested pose.

Background

Individual character assets should preferably use:

plain neutral background

or:

transparent background

when supported correctly by the generation model.

Do not initially generate the character inside complex environments.

Environments should be generated as independent assets.

Asset Separation

The skill should treat the following as independent assets:

Character
Pose
Expression
Environment
Props
Camera
Lighting

Do not combine all these elements into a single image during the initial character creation process.

Example:

Character
    +
Pose
    +
Environment
    +
Camera
    =
Scene

This allows the character to be reused across multiple scenes.

Expressions

Facial expressions should preferably be generated independently from poses.

Example:

expressions/
├── neutral.png
├── happy.png
├── sad.png
├── angry.png
├── surprised.png
└── scared.png

Expressions must not modify:

Facial identity.
Apparent age.
Hairstyle.
Body proportions.
Character identity.
Metadata

Create a metadata.json file.

Example:

{
  "character_id": "alex",
  "name": "Alex",
  "version": "1.0",
  "reference_image": "reference/character-reference.png",

  "identity": {
    "age": 28,
    "hair": "short dark brown hair",
    "eyes": "green",
    "skin": "light",
    "body": "athletic"
  },

  "clothing": {
    "top": "dark blue jacket",
    "bottom": "black jeans",
    "shoes": "white sneakers"
  },

  "poses": [
    "standing",
    "walking",
    "running",
    "sitting",
    "waving",
    "jumping"
  ],

  "resolution": {
    "width": 2048,
    "height": 2048
  }
}
Generation Workflow

The agent must follow this workflow:

USER
 │
 ▼
Character Definition
 │
 ▼
Generate Character Reference
 │
 ▼
Validate Identity
 │
 ├── FAIL ──► Regenerate Reference
 │
 ▼
Lock Character Identity
 │
 ▼
Generate Pose 01
 │
 ▼
Validate Consistency
 │
 ├── FAIL ──► Regenerate Pose
 │
 ▼
Generate Pose 02
 │
 ▼
Validate Consistency
 │
 ├── FAIL ──► Regenerate Pose
 │
 ▼
...
 │
 ▼
Generate Metadata
 │
 ▼
Character Asset Package
Validation

After every generated image, validate the following.

Identity
[ ] Same face
[ ] Same hairstyle
[ ] Same eye color
[ ] Same skin tone
[ ] Same apparent age
Body
[ ] Same proportions
[ ] Same body type
[ ] Correct anatomy
[ ] No duplicated limbs
Clothing
[ ] Same clothes
[ ] Same colors
[ ] Same shoes
[ ] Same accessories
Pose
[ ] Requested pose is correct
[ ] Full body is visible
[ ] No cropping
Quality
[ ] High resolution
[ ] Sharp image
[ ] Clean silhouette
[ ] No text
[ ] No watermark
Important Rule

Do not generate all poses as a single image when the goal is to create reusable animation assets.

Use:

Character Reference Sheet
        │
        ├── Pose 01
        ├── Pose 02
        ├── Pose 03
        ├── Pose 04
        ├── Pose 05
        └── Pose N

The Character Reference Sheet is used to maintain identity.

The individual pose images are the reusable production assets.

Recommended Asset Architecture

For an AI movie or video generation system:

PROJECT
│
├── characters/
│   └── alex/
│       ├── reference/
│       │   └── character-reference.png
│       │
│       ├── poses/
│       │   ├── standing.png
│       │   ├── walking.png
│       │   ├── running.png
│       │   └── jumping.png
│       │
│       ├── expressions/
│       │   ├── neutral.png
│       │   ├── happy.png
│       │   └── angry.png
│       │
│       ├── wardrobe/
│       │
│       └── metadata.json
│
├── environments/
│   ├── city/
│   ├── office/
│   └── forest/
│
├── props/
│   ├── car/
│   ├── phone/
│   └── laptop/
│
└── scenes/
    ├── scene-001/
    ├── scene-002/
    └── scene-003/
Agent Instructions

The agent must treat the character as a reusable production asset, not as an isolated image.

Each character must have persistent identity.

Before generating a new image:

Retrieve the character reference.
Retrieve metadata.json.
Retrieve the locked character attributes.
Apply only the requested changes.
Generate the new pose.
Validate consistency.
Save the asset using a descriptive filename.

Never reconstruct the character from scratch when a reference already exists.

Consistency Reviewer

The generation pipeline should include a dedicated Consistency Reviewer agent.

Its responsibility is to compare every generated pose against the Character Reference.

Example:

Character Reference
        │
        ▼
Pose Generator
        │
        ▼
Generated Pose
        │
        ▼
Consistency Reviewer
        │
        ├── PASS ──► Save Asset
        │
        └── FAIL ──► Regenerate Pose

The reviewer should evaluate:

Identity similarity
Face similarity
Hair consistency
Clothing consistency
Body proportions
Color consistency
Accessory consistency
Anatomical correctness
Pose correctness

The reviewer should return:

{
  "status": "PASS",
  "score": 0.94,
  "identity_consistency": 0.97,
  "clothing_consistency": 0.95,
  "pose_accuracy": 0.91,
  "issues": []
}

If the score is below the configured threshold:

status = FAIL

the pose must be regenerated.

Success Criteria

The skill is successful when:

✓ Character Reference exists
✓ One independent image exists per pose
✓ All images maintain character identity
✓ All images maintain clothing
✓ All images maintain body proportions
✓ Poses are clearly different
✓ Full body is visible
✓ Images have sufficient resolution
✓ Assets can be reused in future scenes
✓ metadata.json exists
✓ Every pose passes consistency validation
Design Principle

The core principle of this skill is:

ONE CHARACTER
      │
      ▼
ONE IMMUTABLE IDENTITY
      │
      ├──────────────┬──────────────┐
      ▼              ▼              ▼
    Pose           Pose           Pose
      │              │              │
      ▼              ▼              ▼
   Asset           Asset           Asset
      │              │              │
      └──────────────┼──────────────┘
                     ▼
                  SCENES
                     │
                     ▼
                  VIDEO

The character identity should remain stable while poses, expressions, environments, camera angles, lighting, and scenes can change independently.