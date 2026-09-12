# Contributing to Windows Dynamic Island

Thank you for your interest in contributing to Windows Dynamic Island. We welcome bug reports, feature requests, documentation improvements, and pull requests from developers of all skill levels.

---

## Prerequisites

To build and run Windows Dynamic Island locally, make sure you have installed:
1. **Node.js** (v18 or later) and `npm`
2. **Rust** (latest stable toolchain): `rustup default stable`
3. **C++ Build Tools**: Visual Studio Build Tools with C++ workload (required for Windows C++/Win32 compilation)
4. **WebView2 Runtime**: Standard on Windows 10 and 11

---

## Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/onlytrisdev/dynamic-island-windows.git
   cd dynamic-island-windows
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Run the application in development mode:**
   ```bash
   npm run tauri dev
   ```
   *This starts the Vite dev server with hot-module-replacement (HMR) and launches the native transparent Tauri window with Live Reload.*

---

## Architecture and Code Layout

- **`src-tauri/src/lib.rs`**: Core Rust Win32 backend:
  - Direct Win32 dynamic API bindings (`SetWindowPos`, `MonitorFromWindow`, `GetMonitorInfoW`, `GetDpiForWindow`).
  - WinRT System Media Transport Controls (SMTC) multi-session scoring engine and asynchronous thumbnail loader.
  - Native WASAPI audio monitoring and master endpoint volume controls.
  - Global hardware hooks (Volume, Mute, Caps Lock, Downloads monitor).
- **`src/`**: React 19 + TypeScript frontend:
  - `src/components/DynamicIsland/IslandContainer.tsx`: Central container managing squircle physics, spring transitions, boundary hitboxes, and tick-0 native window pre-sizing.
  - `src/components/DynamicIsland/views/AppleControlCenterView.tsx`: Full HUD combining music playback, concentric CPU/RAM/Battery rings, volume capsule, focus timer, and clipboard pill.
  - `src/components/DynamicIsland/views/SplitIslandView.tsx`: Dual-bubble physics when multiple activities are concurrent.
  - `src/utils/native.ts`: Type-safe IPC bridge interfacing Tauri commands with browser fallback stubs.

---

## Testing and Verification

Before submitting a PR, make sure both Rust backend tests and TypeScript frontend builds pass cleanly:

```bash
# 1. Run Rust unit tests
cargo test --manifest-path src-tauri/Cargo.toml --lib

# 2. Type-check and build frontend
npm run build

# 3. Compile native release binary
npx tauri build --no-bundle
```

---

## Pull Request Guidelines

1. **Branch Naming**: Use descriptive prefixes like `feat/`, `fix/`, `docs/`, or `perf/` (e.g., `feat/spotify-lyrics-support`).
2. **Commit Messages**: Keep commit messages concise, imperative, and descriptive.
3. **Zero Decorative Stubs**: Every button, slider, or toggle must trigger real OS state changes or system calls.
4. **Performance First**: Maintain 120 FPS frame timing and avoid blocking the Win32 message loop or Tao UI thread.

---

## License
By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
