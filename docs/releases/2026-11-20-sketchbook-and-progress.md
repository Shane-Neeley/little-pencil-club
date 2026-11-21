# Faster Sketchbook and safer progress

Site v8 went live November 20, 2026 at 4:08 p.m. Pacific. Sites confirmed public deployment `appgdep_6b00e0fcb54c8191af90c81050263ab8`. GitHub commit `9f292f1acff1b9b6fb8294f60c5886ab8e705d95` and Sites commit `bed6a1afe87b8046981e30625b37461f169773a9` have the same source tree. [Open Little Pencil Club](https://little-pencil-club.fort-rock.chatgpt.site/).

Sketchbook paints previews near the viewport, keeps a finished checkmark through a stale tab save, and updates the current Sketchbook when a delayed import finishes. The finish screen distinguishes a saved checkmark from unsaved ink.

All 17 product tests passed in each of Chromium and WebKit. The 57 seeded commands and the four local paper-photo fork tests also passed. The published scripts matched the reviewed source byte for byte. A fresh Chromium context at phone width verified that Pencil Basics retained its checkmark after a stale save and reload on the live site. [Experiment, changed files, and benchmark](../2026-11-20-engineering-experiment.md).
