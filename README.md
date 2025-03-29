# Pillar Shooter Arena

A fast-paced 3D First-Person Shooter (FPS) game built with Three.js, running directly in your web browser. Test your aim and speed by destroying all red targets before time runs out!

## Features

- **3D First-Person Perspective:** Immersive view with a visible weapon model (low-poly optimized).
- **Target Shooting:** Destroy 10 uniquely labelled red pillars scattered among 1000 obstacles.
- **Dynamic Environment:** Features randomly generated pillars and various other shapes (cubes, spheres, pyramids, trees) for cover and complexity.
- **Responsive Controls:** WASD for movement, mouse aiming via Pointer Lock, left-click to shoot.
- **Resource Management:** Limited ammo (20 bullets) requires careful shooting.
- **Time Pressure:** Complete the objective within a 5-minute countdown timer.
- **Visual Effects:** Includes muzzle flash, gun recoil, particle-based target destruction ('glass breaking'), and screen flash on target hits.
- **Performance Optimized:** Designed to run smoothly on standard hardware using low-poly models and basic materials.
- **Modern UI:** Displays ammo count, target progress, and remaining time.
- **SEO Friendly:** Basic meta tags included for better discoverability and sharing.

## How to Play

1.  **Open `index.html`** in your web browser (requires hosting, see below).
2.  **Click** the screen to lock the pointer and start the game.
3.  Use **WASD** keys to move around the arena.
4.  Use the **Mouse** to aim the crosshair.
5.  **Left-Click** to shoot at the **Red Cylinder** targets. Use ammo wisely!
6.  Destroy all **10 Red Targets** before the 5-minute timer runs out to win!
7.  Press **Esc** to pause/unpause or end the game early.

## Running the Game

This game uses JavaScript modules (`type="module"`) and fetches resources via CDN. For security and functionality, browsers require it to be served over HTTP/HTTPS, not opened directly from the local filesystem (`file:///`).

**To Run Locally:**

- Use a simple local web server. Examples:
  - **VS Code:** Install the "Live Server" extension and click "Go Live".
  - **Python:** Navigate to the project directory in your terminal and run `python -m http.server`.
  - **Node.js:** Install `http-server` (`npm install -g http-server`) and run `http-server` in the project directory.
- Open the provided local URL (e.g., `http://127.0.0.1:5500` or `http://localhost:8000`) in your browser.

## Technology Stack

- HTML5
- CSS3
- JavaScript (ES6 Modules)
- Three.js (r134 via CDN)

## Development Note

This game was developed iteratively with significant assistance from a Generative AI model. The AI helped generate, refine, debug, and explain the code from the initial concept through to the final version presented here.
