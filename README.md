# Character Builder — static HTML/CSS/JS

Converted from the Clojure/ClojureScript **OrcPub2** project, in two steps:

| Folder | Edition | Source content |
|---|---|---|
| `step1-2014-srd51/` | D&D 5e (2014) | The repo's own data (SRD 5.1): spells, weapons, armor, gear, tools, skills |
| `step2-2024-srd52/` | D&D 5.5 (2024) | SRD 5.2.1 PDF: classes, species, backgrounds, feats, spells, equipment, weapon mastery |

Each folder is self-contained. **Open `index.html` in any modern browser** (no server, no build step, works from `file://`).
Host it anywhere that serves static files.

## What it does
Origin (species/background) → Class (multiclass, subclass, level-ups with ability increases or feats) → Abilities (standard array, point buy, 4d6, manual)
→ Spells (cantrips, prepared/known/spellbook, always-prepared domain/oath/patron spells, slots incl. multiclass and Pact Magic)
→ Equipment (starting packages, inventory, equipped armor/weapons feed AC and attacks) → Details.
A live summary shows HP, AC, ability scores, a "still to do" list and rules warnings. The sheet view tracks current HP, spell slots and limited-use features,
and prints cleanly (use *Print → Save as PDF*). Spell and equipment browsers are included. Characters are saved in your browser (`localStorage`); use Export/Import JSON to back up or move them.

## What changed in the 2024 edition (data + engine rules)
Ability score increases come from the **background** (+2/+1 or +1/+1/+1) instead of species; **origin feats**; **weapon mastery** (picks per class, shown on attacks);
fixed prepared-spell tables per class; level-4/8/12/16 feat-or-ASI slots plus an **Epic Boon** at 19; Fighting Style as a feat; 2024 species lineages (elf, gnome, tiefling, goliath, dragonborn);
half-casters round up when multiclassing; starting equipment as A/B packages.

## Not ported (needs a server, or was outside the builder)
Accounts, e-mail, Datomic storage, parties, server-side PDF form filling, and the monster / encounter / homebrew tools. Magic items and monsters are not included in either pack.

## Known limitations
* **2014 class and race text is condensed.** The repo's own class data was incomplete (many features come from separate code paths), so feature descriptions for classes/races/subclasses were written as short summaries; spells, weapons, armor, gear lists come straight from the repo. The 2014 gear list has no prices (the repo has none). The Warlock invocation list is a subset.
* **2024 text is the SRD verbatim** (classes, subclasses, species, feats, spells). The SRD includes only one subclass per class and four backgrounds.
* Prerequisites (multiclassing scores, invocation/feat prerequisites) are shown but **not enforced**. Swap-on-rest options (e.g. High Elf cantrip, Circle of the Land terrain) are changed by editing the choice.
* Some features are descriptive only, not automated (e.g. Rage damage, Sneak Attack dice, Extra Attack). Automated: proficiencies, HP, AC (incl. Unarmored Defense), speed, senses, resistances, spell slots/DC/attack, always-prepared spells, attacks with mastery, limited-use counters.
* Tested in headless Chromium (Chrome engine) only; engine results were checked by hand against rules examples. Not tested in Safari/Firefox or on phones.

## Licenses
* Spell/equipment/skill data in `step1-2014-srd51/` was extracted from the OrcPub2 repo, which is under the **Eclipse Public License 2.0** (see `LICENSE-OrcPub2-EPL-2.0.txt`). Keep that license and notice with anything derived from those files; check the EPL's terms for how you redistribute modified versions.
* SRD 5.1 and SRD 5.2.1 content is © Wizards of the Coast LLC, licensed **CC-BY-4.0** (https://creativecommons.org/licenses/by/4.0/legalcode). The required attribution is shown in each app's footer and on the About page. This project is not affiliated with Wizards of the Coast.

## `tools/`
The Python used to produce the data packs (a small Clojure reader, the SRD 5.2.1 PDF parsers, and the pack builders). Reference only: paths are hard-coded to the original working directories.
