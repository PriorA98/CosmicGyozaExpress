# Delivery Results

Last updated: 2026-05-30 JST

## Purpose

Delivery result is the emotional payoff after flight and landing.

It should confirm:

- the package was accepted;
- the recipient feels cared for;
- mistakes did not ruin the delivery;
- package condition changes flavor, not progression.

## Completion Rule

Every main campaign delivery is accepted.

The player can get a bumpy result, but not a rejected delivery. This preserves the cozy tone and prevents landing from becoming a perfection gate.

## Result Inputs

Result scene should receive:

- mission id;
- delivery item id;
- recipient id;
- package condition value;
- package condition label;
- route crash count;
- landing incident count;
- duration, if tracked;
- landing result category;
- memory/reward id.

Only some of these need to be visible to the player.

## Package Condition Labels

Use warm labels:

- Perfect.
- Slightly shaken.
- Emotionally rotated.
- Warm but confused.
- Still delicious.
- Dramatically rearranged.
- Basically fine.

Do not convert these into letter grades, stars, medals, or moral judgments.

## Landing Result Categories

Use internal result categories for logic:

- `soft`
- `bumpy`
- `incident-recovered`

Player-facing copy should be warmer:

- `soft landing`
- `cozy touchdown`
- `spirited delivery`
- `still warm delivery`
- `moon-approved snack arrival`

Avoid `perfect score`, `bad landing`, or `failed attempt`.

## Tea Moon Result Tone

Tea Moon recipient:

- Sleepy Moon Rabbit.

Delivery item:

- hot tea and moon mochi.

Reaction direction:

- short;
- grateful;
- sleepy;
- lightly absurd;
- accepts imperfect delivery warmly.

Example result lines:

- `The tea is still warm enough to make the moon blink slowly.`
- `The mochi has shifted emotionally, but the rabbit accepts its journey.`
- `Sleepy Moon Rabbit says the landing sounded like a tiny cupboard, which is apparently comforting.`

## Save Effects

On first completion:

- add `tea-moon` to completed missions;
- keep or add next unlock when Phase 3/galaxy map exists;
- add Tea Moon memory reward;
- update delivery stats;
- store best mission result if this run is better by chosen future criteria.

For Phase 2, minimum save requirement:

- mission completion persists after reload.

## Memory Reward

Tea Moon should grant one simple reward:

- a memory postcard;
- a sticker;
- or a dashboard charm placeholder.

The reward can be represented as saved id plus result-screen text in Phase 2. A full collection screen can wait.

## Result Scene Actions

Phase 2 result scene should offer:

- continue/replay;
- return to title or map-lite;
- retry Tea Moon if map is not implemented yet.

The full galaxy map can wait, but the player should not be stranded after result.
