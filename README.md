
# Simple MacOS Web |  <img src="https://media.tenor.com/2yzvgWyZK7kAAAAi/animation-pixel-art.gif" alt="Cynthia" height="75" align="center">

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E.svg?style=flat&logo=javascript&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-E34F26.svg?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Variables-1572B6.svg?style=flat&logo=css3&logoColor=white)
![Security](https://img.shields.io/badge/Security-Strict_CSP-2496ED.svg?style=flat&logo=springsecurity&logoColor=white)

> A high-performance, browser-based operating system simulation built entirely from scratch without relying on any front-end frameworks. It faithfully replicates the macOS desktop environment, complete with an in-memory Virtual File System, hardware-accelerated window management, and a suite of fully functional integrated applications. Designed as a comprehensive technical showcase, it pushes the limits of Vanilla JavaScript and DOM manipulation to deliver a fluid, 60fps native-like experience.


<table align="center" style="border: none; background-color: transparent;">
  <tr style="border: none; background-color: transparent;">
    <td align="center" width="50%" style="border: none; background-color: transparent;">
      <img src="assets/img/demo1.png" alt="WebOS Dark Mode" style="border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%;">
    </td>
    <td align="center" width="50%" style="border: none; background-color: transparent;">
      <img src="assets/img/demo2.png" alt="WebOS Light Mode" style="border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%;">
    </td>
  </tr>
</table>

<p align="center">
  <img src="assets/icon/readme_icon/es0.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es1.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es2.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es3.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es4.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es5.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es6.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es7.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es8.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/readme_icon/es9.png" height="60" alt="macOS Folder Art" title="macOS Folder Art">
</p>
<br>

## Live Demo & Visual Analysis <img src="https://img.icons8.com/?size=100&id=72390&format=png&color=ffffff" width="30" valign="middle">

The interface is designed as a **Pixel-Perfect Glassmorphism Dashboard**, providing real-time feedback on algorithmic DOM manipulation and CSS3 hardware acceleration.

<p align="center">
  <video src="assets/WebOS_Demo.mp4" width="600" controls title="WebOS Live Demo"></video>
</p>
<br>

[**Try the Live Demo**](https://vor7rex.github.io/Web_MacOS/)<a href="https://pokemondb.net/pokedex/keldeo"><img src="https://img.pokemondb.net/sprites/black-white/anim/normal/keldeo-ordinary.gif" alt="Keldeo" height=50></a>
</a>

## System Architecture & Core Engineering <img src="https://img.icons8.com/?size=100&id=72653&format=png&color=000000" width="30" valign="middle">

Simple MacOS Web is built with a strict separation of concerns, relying entirely on native browser APIs to achieve 60fps performance without the overhead of heavy frameworks like React or Vue.

* **State Management & VFS:** A JSON-based Virtual File System tracks spatial coordinates, z-index layering, and app lifecycles. It drives the cross-environment drag-and-drop engine, enabling seamless file transfers between the Desktop, Finder, and Trash with dynamically generated 3D holograms.

* **Rendering Pipeline & GPU Acceleration:** UI updates bypass CPU layout thrashing. Window dragging, dock magnification, and FLIP-driven animations (Music App) leverage `transform` and `will-change` for pure GPU rasterization. The Zero-Lag Theme Engine uses a Double `requestAnimationFrame` lock, synchronizing CSS variable swaps with the monitor's V-Sync to eliminate flicker.

* **Spatial Collision & Trigonometric UI:** Multi-file selection is powered by a custom AABB (Axis-Aligned Bounding Box) collision engine with spatial DOM caching. Complex UI elements, like context menus and folder color selectors, are generated on the fly using radial math and trigonometry.

* **Hardened Security Sandbox:** Enforces a strict Content Security Policy (CSP). Includes an `eval()`-free custom mathematical lexer for the Calculator, and an XSS-proof Bash Terminal emulator that rigidly sanitizes all VFS inputs.

<br>

## Technologies

| **Core Stack** | **Implementation Details** |
| :--- | :--- |
| <img src="assets/icon/readme_icon/js.png" height="45" alt="JavaScript"> | Core OS engine (ES6+), Event throttling, DocumentFragments, AABB collision math |
| <img src="assets/icon/readme_icon/css.png" height="45" alt="CSS3"> | Glassmorphism (`backdrop-filter`), CSS Grid/Flexbox layouts, Dark/Light theming |
| <img src="assets/icon/readme_icon/html.png" height="45" alt="HTML5"> | Semantic structure, HTML5 Audio API for music playback, File API for uploads |
| <img src="assets/icon/readme_icon/leaflet.png" height="45" alt="Leaflet"> | Vector mapping and geospatial rendering in the Maps App (via CartoDB Voyager) |
<br>


## Algorithmic Core & Telemetry <img src="https://img.icons8.com/?size=100&id=2WP6HZwhbWw8&format=png&color=000000" width="30" valign="middle">

The engine continuously monitors and optimizes browser rendering pipelines to guarantee an uncompromising 60fps experience:

1. **Layout Thrashing Prevention:** Mathematical state operations are completely decoupled from DOM repaints. Window resizing and the Marquee Tool utilize independent `requestAnimationFrame` batches, ensuring layout calculations never block the main thread.

2. **JIT Memory Management:** Passive CPU drain is eliminated. Heavy spatial event listeners (e.g., `mousemove` for window dragging) are Just-In-Time attached on `mousedown` and surgically destroyed on `mouseup`, preventing garbage collection spikes.

3. **V-Sync Theme Engine:** Zero-flicker Dark/Light mode transitions. A Double `requestAnimationFrame` lock pauses UI threads, forces global CSS variable recalculation, and executes the repaint exactly when the GPU confirms the next frame buffer.

<br>


## App Ecosystem & Technical Deep Dive &nbsp;<img src="https://img.icons8.com/?size=100&id=9ZUExtqRFzfM&format=png&color=000000" width="25" valign="middle"> <img src="https://img.icons8.com/?size=100&id=VwNtH5f7bWpg&format=png&color=000000" width="25" valign="middle"> <img src="https://img.icons8.com/?size=100&id=41LOFTWPsRas&format=png&color=000000" width="25" valign="middle"> <img src="https://img.icons8.com/?size=100&id=MaTDxV1YwGaC&format=png&color=000000" width="25" valign="middle"> <img src="https://img.icons8.com/?size=100&id=a8NHl6SmDbn7&format=png&color=000000" width="25" valign="middle"> <img src="https://img.icons8.com/?size=100&id=pWWlJmbYuaWT&format=png&color=000000" width="25" valign="middle"> <img src="https://img.icons8.com/?size=100&id=zbKGUoX9KUZR&format=png&color=000000" width="25" valign="middle"> <img src="https://img.icons8.com/?size=100&id=dwpzsEh8wd05&format=png&color=000000" width="25" valign="middle">

| App | Description & Experience | Engineering Highlight |
| :--- | :--- | :--- |
| **Finder** <br> <img src="assets/icon/general/finder.png" width="32"> | Core file manager for VFS navigation and file preview. | **3D Radial Math:** Dynamic folder color selection via trigonometric UI rendering. |
| **Terminal** <br> <img src="assets/icon/general/terminal.png" width="32"> | Fully functional UNIX-like Bash shell emulator. | **Security:** Implements a custom input parser to neutralize XSS injection via VFS filenames. |
| **Music** <br> <img src="assets/icon/general/music.png" width="32"> | Professional HTML5 Audio player with Library and Artist views. | **FLIP Technique:** Smooth list reordering and 3D orbiting playlist creator at 60fps. |
| **Calendar** <br> <img src="assets/icon/general/calendar.png" width="32"> | Dynamic monthly view with event management and popups. | **Collision Logic:** Intelligent lane allocation to prevent overlapping of multi-day events. |
| **Reminders** <br> <img src="assets/icon/general/reminders.png" width="32"> | Task manager with custom lists and advanced inspector. | **State Sync:** Real-time synchronization between sidebar counters and task categories. |
| **Maps** <br> <img src="assets/icon/general/maps.png" width="32"> | Interactive GIS interface using CartoDB and OpenStreetMap. | **GIS Integration:** Managed Leaflet.js instance with asynchronous geocoding and smooth fly-to ops. |
| **Weather** <br> <img src="assets/icon/general/weather.png" width="32"> | Real-time weather dashboard for global metropolises. | **Live API Pipeline:** Fetches and parses WMO codes from Open-Meteo with dynamic icon mapping. |
| **Calculator** <br> <img src="assets/icon/general/calculator.png" width="32"> | High-precision mathematical engine (BODMAS compliant). | **Custom Lexer:** Token-based parser that executes math without using dangerous `eval()` calls. |
| **Clock** <br> <img src="assets/icon/general/clock.png" width="32"> | Analog and digital time tracking with time-zone support. | **GPU Sweep:** Trigonometric rotation logic synced to `Date.getMilliseconds()` for zero-jitter hands. |
| **Settings** <br> <img src="assets/icon/general/settings.png" width="32"> | OS-level configuration and real-time hardware telemetry. | **Telemetry API:** Leverages `navigator` and `performance` APIs to monitor CPU, RAM, and Battery. |
| **Screenshot** <br> <img src="assets/icon/general/screenshot.png" width="32"> | Full-screen DOM rasterization with Quick Look preview. | **DOM Canvas:** Uses `html2canvas` for visual buffer capturing and efficient Base64 RAM management. |
---

<br>

<table align="center" style="border: none; background-color: transparent;">
  <tr style="border: none; background-color: transparent;">
    <td align="center" width="50%" style="border: none; background-color: transparent;">
      <img src="assets/img/demo3.png" alt="WebOS Dark Mode" style="border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%;">
    </td>
    <td align="center" width="50%" style="border: none; background-color: transparent;">
      <img src="assets/img/demo4.png" alt="WebOS Light Mode" style="border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%;">
    </td>
  </tr>
</table>
<p align="center">
  <img src="assets/icon/folders/S1.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/Violet.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/blue.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/S2.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/Teal.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/Orange.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/S3.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/Red.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/Green.png" height="60" alt="macOS Folder" title="Folder Art">
  &nbsp;&nbsp;
  <img src="assets/icon/folders/S5.png" height="60" alt="macOS Folder" title="Folder Art">
</p>

<br>

## Component Interaction Contract & Data Flow <img src="https://img.icons8.com/?size=100&id=Y7dwtJXpy9FS&format=png&color=000000" width="30" valign="middle">

The operating system enforces strict inter-app communication protocols to prevent state mutation leaks and ensure DOM predictability:

* <img src="https://img.shields.io/badge/VFS_State-JSON_Tree-blue" valign="middle"> **Single Source of Truth:** The Virtual File System acts as the core state manager. File operations (CRUD) broadcast state changes globally, triggering targeted UI repaints only for active subscribers (e.g., open Finder windows, Desktop grid).

* <img src="https://img.shields.io/badge/Window_Manager-Z--Index_Router-orange" valign="middle"> **Z-Index Routing:** A centralized interceptor captures `mousedown` events across the viewport. It dynamically recalculates layer stacking, pushes the active instance to the top `z-index`, and manages focus states across the ecosystem.

* <img src="https://img.shields.io/badge/Event_Bus-Native_DOM-green" valign="middle"> **Native IPC Delegation:** Zero-dependency inter-process communication. Cross-environment events (e.g., dragging a file from the Desktop into the Trash) leverage native JS bubbling and capturing phases, bypassing the memory overhead of external state managers.

<br>    

## Quick Start <img src="https://img.icons8.com/?size=100&id=GZxgGaKN8jxz&format=png&color=000000" width="30" valign="middle"> 

The application requires absolutely no build tools, Node.js, or npm packages. It runs natively in any modern browser.

1. **Clone the infrastructure:**
    ```bash
    git clone [https://github.com/Vor7reX/Web_MacOS.git](https://github.com/Vor7reX/Web_MacOS.git)
    cd WebOS
2. **Launch the OS:**
   ```bash
    Simply double-click the `index.html` file. 
   ```

    *Note: For the best experience and to bypass local CORS restrictions (required for HTML5 Audio and fetching Map APIs), it is highly recommended to open the project using a local web server, such as the **Live Server** extension in VS Code.*

<br>

## Repository Structure <img src="https://img.icons8.com/?size=100&id=DNacFPxLaFAT&format=png&color=000000" width="30" valign="middle">
```text
WebOS/
├── index.html               # Main OS interface & Application DOM templates
├── assets/
│   ├── css/
│   │   └── style.css        # CSS Tokens, Glassmorphism, UI Layouts
│   ├── js/
│   │   └── script.js        # Core Engine, VFS, Window Manager & Apps Logic
│   ├── audio/               # MP3 tracks for the Music App database
│   ├── icon/                # App icons, weather symbols, and UI vectors
│   ├── img/                 # Default wallpapers and album covers
│   └── cursors/             # Custom macOS style SVG cursors
└── README.md                # System documentation
```
<br>

## Engineering Roadmap <img src="https://img.icons8.com/?size=100&id=9oL-oXzKjn-r&format=png&color=000000" width="30" valign="middle">

* **Non-Volatile VFS Storage:** Migrating the current RAM-based state tree to the browser's `IndexedDB`, enabling persistent file system structures, application states, and UI coordinates across sessions.
* **Touch Event Abstraction:** Upgrading the pointer collision engine to seamlessly bridge native `MouseEvent` and `TouchEvent` APIs, guaranteeing fluid, 60fps drag-and-drop on mobile devices and iPads.
* **Socket-Driven Multiplayer:** Implementing a bi-directional WebSocket layer to support real-time cursor telemetry and remote cross-instance file dropping between users over the internet.

<br>

## Open Source Integrations <img src="https://img.icons8.com/?size=100&id=ku2yYhOUyTv1&format=png&color=000000" width="30" valign="middle"><img src="https://img.icons8.com/?size=100&id=aianf4uyt1eQ&format=png&color=000000" width="30" valign="middle"><img src="https://img.icons8.com/?size=100&id=NsI6H56Z3Vc4&format=png&color=000000" width="30" valign="middle">

This OS relies on pure Vanilla JS for its core architecture, but gratefully acknowledges the following APIs and libraries for extending its ecosystem:

* **[Leaflet.js](https://leafletjs.com/)** - Vector GIS rendering and map interactions.
* **[html2canvas](https://html2canvas.hertzen.com/)** - Visual buffer capturing for DOM rasterization.
* **[Open-Meteo API](https://open-meteo.com/)** - Live WMO weather telemetry.
* **[Nominatim (OSM)](https://nominatim.openstreetmap.org/)** - Asynchronous global geocoding.

*Assets & Media:* All audio tracks are original compositions generated via AI to ensure a 100% royalty-free multimedia experience. All album cover artworks are original designs created by me :) 

<br>

## 📄 License & Attribution <img src="https://img.icons8.com/?size=100&id=80435&format=png&color=000000" width="30" valign="middle">&nbsp;<img src="https://img.icons8.com/?size=100&id=72507&format=png&color=000000" width="30" valign="middle">

This project is open-source and released under the **MIT License**.

You are free to use, modify, and distribute this software, provided that **you include the original copyright notice and give proper credit** to the author.

<p align="center">
  <i>Engineered to push the limits of Vanilla Web Development. Zero frameworks, pure DOM.</i><br>
</p>

---
<div align="left">
<p valign="middle">
Created by <b>Vor7reX</b>
<img src="https://archives.bulbagarden.net/media/upload/3/30/Spr_B2W2_Flannery.png" height="70" valign="middle" alt="Flannery">
</p>
</div>