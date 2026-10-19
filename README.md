# ESCAPE — The Office Escape

A small, playable 2.5D psychological-thriller game built with HTML5 Canvas and vanilla JavaScript. It runs on desktop and mobile browsers; no package install or build step is required.

## Run it

**Quick start:** open `index.html` in a modern browser.

**Recommended local server:**

1. Extract the ZIP.
2. Open a terminal in the `the-office-escape` folder.
3. Run `python -m http.server 8000` (or `python3 -m http.server 8000`).
4. Visit `http://localhost:8000`.

On a phone, put the folder on any static web host and open the hosted URL. Touch controls appear automatically on narrower screens. No account, API key, or third-party runtime is needed. The font uses Google Fonts when online and falls back to system fonts offline.

## Controls

- **Move:** WASD or arrow keys
- **Interact:** E or Space
- **Pause / resume:** Escape
- **Mobile:** analog on-screen joystick and INTERACT button
- **Background ambience:** tap “AMBIENCE OFF” to enable the original generated ambient drone (no external music track required)

## Objective / puzzle route

1. Explore the office and inspect the crumpled note for the code **0419**.
2. Search the desk drawer for the fuse.
3. Use the fuse on the supply cabinet interaction to get the security badge (the cabinet is designed as a simple gated search interaction).
4. Install the fuse in the fuse box to restore power. This awakens the pursuing shadow.
5. Use the security terminal with the badge and enter **0419**.
6. Reach and interact with the emergency exit.

The shadow pursues you after power is restored. If it catches you, mental stability drains; wrong terminal codes and certain unsettling objects also reduce stability. At zero, the run ends. Escape to win.

## Files

- `index.html` — game shell and HUD
- `style.css` — responsive UI, title screen, touch controls
- `game.js` — movement, collision, camera, map, interactions, inventory, puzzle logic, enemy AI, sanity and win/lose states

## Notes

This is a compact playable prototype, not a finished commercial release. The world and player are drawn at runtime with Canvas primitives (no external art assets). Ambient drone audio is synthesized in the browser with the Web Audio API. A future version could replace the primitive props with sprite sheets, add authored sound/music, and move to Godot if richer 3D scenes are desired.
