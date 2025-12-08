# Void Genesis IDE – Local Development Workflow (Windows)

**Status:** Draft v1, generated from handoff context and current repo state  
**Scope:** How to develop, build, and test the custom Void Genesis IDE (editor fork) on **Windows 11** using:

- The canonical editor repo: [`void_genesis_ide/`](void_genesis_ide:1)  
- The builder repo: [`void-builder/`](void-builder:1)  
- The produced Windows bundle: [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1)  

This document is the authoritative description of **how code changes in `void_genesis_ide` flow into a runnable IDE binary** and how to run faster dev instances where feasible.

---

## 1. Repositories and Directories

### 1.1 Canonical editor fork (source of truth)

- Local path: [`void_genesis_ide/`](void_genesis_ide:1)  
- Remote: `https://github.com/justinlietz93/void_vdm-edition`

**Policy:**

- All long-lived code changes (especially Void agent logic and VS Code workbench customizations) are made in [`void_genesis_ide/`](void_genesis_ide:1).
- This repo is what you commit and push to your fork (`void_vdm-edition`).

Relevant subpaths:

- Void workbench / agent integration:
  - [`void_genesis_ide/src/vs/workbench/contrib/void`](void_genesis_ide/src/vs/workbench/contrib/void:1)
- Model capabilities (includes GPT‑5.1 config target):
  - [`void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1)
- Message building / truncation:
  - [`void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts`](void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts:1)
- Dev scripts:
  - [`void_genesis_ide/scripts/`](void_genesis_ide/scripts:1)
  - Key entrypoints:
    - Desktop dev: [`void_genesis_ide/scripts/code.bat`](void_genesis_ide/scripts/code.bat:1)
    - Web dev: [`void_genesis_ide/scripts/code-web.bat`](void_genesis_ide/scripts/code-web.bat:1)
    - Server dev: [`void_genesis_ide/scripts/code-server.bat`](void_genesis_ide/scripts/code-server.bat:1)

### 1.2 Builder fork (build orchestration)

- Local path: [`void-builder/`](void-builder:1)  
- Remote: `https://github.com/justinlietz93/void-builder-vdm-edition`

Key files:

- Dev build entrypoint (Windows):
  - [`void-builder/dev/build.ps1`](void-builder/dev/build.ps1:1) &mdash; thin PowerShell wrapper that prepends Git Bash to `PATH` and runs `./dev/build.sh`.
- Build helper script (documented upstream):
  - [`void-builder/dev/build.sh`](void-builder/dev/build.sh:1)
- Repo fetch / wiring (already customized to your fork):
  - [`void-builder/get_repo.sh`](void-builder/get_repo.sh:1)
- Preparation and JSON edits (Node-based, no `jq` dependency):
  - [`void-builder/prepare_vscode.sh`](void-builder/prepare_vscode.sh:1)
- CLI build script (Rust-based, currently fragile on PATH):
  - [`void-builder/build_cli.sh`](void-builder/build_cli.sh:1)
- Output bundle (Windows GUI IDE):
  - [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1)

**Important:** The directory [`void-builder/vscode/`](void-builder/vscode:1) is an **ephemeral build workspace**. It is populated/overwritten by the builder; it is **not** the canonical place to edit code.

---

## 2. High-Level Workflow Options

You have two primary ways to develop and test the Void Genesis IDE locally:

1. **Builder-Centric Workflow (Recommended, Production-Like)**  
   - Edit code in [`void_genesis_ide/`](void_genesis_ide:1).  
   - Commit and push to your GitHub fork.  
   - Use [`void-builder/dev/build.ps1`](void-builder/dev/build.ps1:1) to build a new Windows bundle under [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1).  
   - Launch the built IDE and test behavior (including Void Agent and GPT‑5.1).

2. **Direct Dev Workflow (Optional, Faster but Fragile)**  
   - Edit & build directly in [`void_genesis_ide/`](void_genesis_ide:1) using `npm` + VS Code dev scripts.  
   - Launch a dev instance via [`scripts/code.bat`](void_genesis_ide/scripts/code.bat:1).  
   - This route is **more fragile** due to upstream extension build complexity and is treated as **advanced / best effort**, not the primary path.

The Builder-Centric Workflow is authoritative for validating behavior before pushing changes that matter.

---

## 3. Prerequisites (Windows 11)

Baseline environment (per [`void-builder/docs/howto-build.md`](void-builder/docs/howto-build.md:1) and the existing build history):

- **OS:** Windows 11 (64-bit)
- **Shells:**
  - PowerShell (`pwsh` or `powershell.exe`)
  - Git Bash (`C:\Program Files\Git\bin\bash.exe`), used by [`dev/build.ps1`](void-builder/dev/build.ps1:1)
- **Tools and runtimes:**
  - Node.js 20.x (the builder/howto-build docs mention Node 20.14; your main repo currently uses Node 24 for some steps, but Node 20.x is the baseline for builder scripts).
  - npm (installed with Node).
  - Git.
  - Python 3.11.
  - 7-Zip (`7z`) and WiX Toolset for MSI packaging (optional but used by some builder targets).
- **Rust toolchain (for CLI build, medium priority):**
  - `rustup` and `cargo` installed system-wide (e.g., via `winget install -e --id Rustlang.Rustup`).
  - PATH visible in any shell you use to run [`void-builder/dev/build.ps1`](void-builder/dev/build.ps1:1).

If CLI build continues to be problematic, the GUI bundle is still usable (see Task 7/8 in the TODO list and the future `SKIP_CLI_BUILD` option).

### 3.1 Node version management for `void_genesis_ide`

[`void_genesis_ide`](void_genesis_ide:1) declares its expected Node version via [`.nvmrc`](void_genesis_ide/.nvmrc:1):

```text
20.18.2
```

**Discipline:**

- All Node-based dev commands for [`void_genesis_ide`](void_genesis_ide:1) (`npm ci`, `npm run compile`, [`scripts/code.bat`](void_genesis_ide/scripts/code.bat:1), etc.) should be run under **Node 20.18.2**, not a newer global Node.
- On Windows 11, the recommended mechanism is **nvm-windows** ([`CoreyButler.NVMforWindows`](https://github.com/coreybutler/nvm-windows)) which you can install via `winget`.

**Example setup flow (external PowerShell / Windows Terminal):**

```powershell
winget install -e --id CoreyButler.NVMforWindows
nvm install 20.18.2
nvm use 20.18.2
node -v   # v20.18.2

cd c:\git\Void-Genesis\Void-Genesis\void_genesis_ide
npm ci
npm run precommit
scripts\code.bat
```

If `nvm` is not visible in the **VS Code integrated terminal** (because VS Code was launched before nvm was installed or before `nvm use` was run), open a new external shell, perform `nvm use 20.18.2` there, and optionally re-launch VS Code from that shell:

```powershell
cd c:\git\Void-Genesis\Void-Genesis
code .
```

New VS Code terminals spawned from that instance will then inherit the Node 20.18.2 toolchain for all `void_genesis_ide` commands.

---

## 4. Builder-Centric Workflow (Recommended)

### 4.1 Conceptual flow

1. You edit and version control code in [`void_genesis_ide/`](void_genesis_ide:1).
2. Those changes are committed and pushed to your fork (`void_vdm-edition`).
3. [`void-builder/get_repo.sh`](void-builder/get_repo.sh:1) clones the latest `main` from that fork into [`void-builder/vscode/`](void-builder/vscode:1).
4. [`dev/build.sh`](void-builder/dev/build.sh:1) (called by [`dev/build.ps1`](void-builder/dev/build.ps1:1)) applies patches, runs Node/npm builds, and produces a Windows bundle in [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1).
5. You run the IDE from that bundle and exercise the Void Agent.

This keeps a clean separation:

- **Source of truth:** [`void_genesis_ide/`](void_genesis_ide:1) (and its GitHub remote).
- **Build workspace:** [`void-builder/vscode/`](void-builder/vscode:1) (ephemeral).
- **Runnable binaries:** [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1).

### 4.2 One-time setup

From the workspace root `c:/git/Void-Genesis/Void-Genesis` (already established):

1. Ensure both repos exist:

   - [`void_genesis_ide/`](void_genesis_ide:1) — cloned from `void_vdm-edition` (this was just recloned).
   - [`void-builder/`](void-builder:1) — cloned from `void-builder-vdm-edition`.

2. From `void-builder/`, verify you can run:

   ```powershell
   # In a PowerShell terminal, from c:/git/Void-Genesis/Void-Genesis
   cd .\void-builder
   powershell -ExecutionPolicy ByPass -File .\dev\build.ps1
   ```

   - This internally executes `bash ./dev/build.sh` as defined in [`void-builder/dev/build.ps1`](void-builder/dev/build.ps1:1).
   - On your machine, this has already successfully:
     - Cloned the editor fork.
     - Applied patches.
     - Built a GUI bundle under [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1).
   - The Rust CLI step in [`void-builder/build_cli.sh`](void-builder/build_cli.sh:1) may still fail until PATH for `rustup` is fully visible; this does **not** prevent the GUI from being built.

3. Confirm that the Windows bundle directory exists:

   - [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1)

   Inside you should find the final `.exe` (name typically based on `nameShort` in the built `product.json`).

### 4.3 Per-iteration workflow (edit → build → run → test)

Repeat this loop for development:

#### Step 1 — Edit code in `void_genesis_ide`

- Work in the canonical editor repo:

  ```powershell
  cd c:\git\Void-Genesis\Void-Genesis\void_genesis_ide
  ```

- Typical edit targets for Void Agent / GPT‑5.1 work:

  - Capabilities registry:  
    - [`void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1)
  - Message + tool construction:  
    - [`void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts`](void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts:1)
  - Other integrations under:  
    - [`void_genesis_ide/src/vs/workbench/contrib/void`](void_genesis_ide/src/vs/workbench/contrib/void:1)

You can optionally run partial builds/tests locally inside `void_genesis_ide` (see §5), but the authoritative binary is produced by the builder.

#### Step 2 — Commit and push to `void_vdm-edition`

Because [`void-builder/get_repo.sh`](void-builder/get_repo.sh:1) clones from the **remote**, not from the local `void_genesis_ide` checkout, your changes must be in the remote fork before a builder run can see them.

Typical sequence:

```powershell
cd c:\git\Void-Genesis\Void-Genesis\void_genesis_ide

git status
# review changes

git add path/to/changed/files
git commit -m "Describe the GPT-5.1 / agent change"
git push origin main  # or another branch if you prefer feature branches
```

You may prefer to work on feature branches (e.g., `feature/gpt51-capabilities`) and push those; in that case, ensure [`void-builder/get_repo.sh`](void-builder/get_repo.sh:1) is configured to fetch/checkout that branch, or temporarily adjust it as needed.

#### Step 3 — Run the builder

From the builder repo:

```powershell
cd c:\git\Void-Genesis\Void-Genesis\void-builder
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1
```

This:

1. Executes `bash ./dev/build.sh` as per [`void-builder/dev/build.ps1`](void-builder/dev/build.ps1:1).
2. `dev/build.sh`:
   - Runs [`void-builder/get_repo.sh`](void-builder/get_repo.sh:1) to clone your fork into [`void-builder/vscode/`](void-builder/vscode:1).
   - Applies patches via scripts under [`void-builder/patches/`](void-builder/patches:1).
   - Runs the VS Code/Void build: Node/npm, compilation, bundling.
   - Attempts CLI build via [`void-builder/build_cli.sh`](void-builder/build_cli.sh:1).

If the CLI build fails due to `rustup` PATH issues, you will still get a usable GUI bundle. Longer-term, Task 7/8 in the master TODO covers cleaning that up and/or adding a controlled skip flag.

#### Step 4 — Launch the built IDE

Once the build completes:

1. Navigate to:

   - [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1)

2. Locate the main executable. Its name is based on the product name/branding; typically something like:

   - `Code - OSS.exe`
   - or your Void-specific `nameShort` from the built product JSON.

3. Run that `.exe`.

This instance is the **built Void Genesis IDE** with your changes included. Use it to:

- Start Void Agent sessions.
- Select GPT‑5.1.
- Paste large files and exercise file/terminal tools.
- Validate truncation and tool availability behavior.

---

## 5. Direct Dev Workflow (Optional / Advanced)

The **direct dev workflow** uses the standard VS Code dev scripts inside [`void_genesis_ide/`](void_genesis_ide:1).

### 5.1 Caveats and risk classification

Per the prior session (see `handoff` docs and decision log):

- Running direct builds via `npm run compile` + [`scripts/code.bat`](void_genesis_ide/scripts/code.bat:1) has historically exposed:
  - TypeScript errors in upstream extensions under [`void_genesis_ide/extensions/`](void_genesis_ide/extensions:1).
  - Missing dev-only npm dependencies for language servers and webviews.
- Aggressively disabling large swaths of extensions in `build/gulpfile.extensions.js` was tried, then deprecated, because it diverges too far from upstream and is hard to maintain.

You should therefore treat the direct dev workflow as:

- **Best-effort** and **experimental**.
- Useful for local, fast iteration after the environment is stabilized.
- Not a replacement for the builder-based workflow when verifying behavior for release.

### 5.2 Commands and steps

All steps from:

```powershell
cd c:\git\Void-Genesis\Void-Genesis\void_genesis_ide
```

#### Step 1 — Install Node dependencies (initially)

Run once per clone or when `package-lock.json` changes significantly:

```powershell
npm ci
```

This will:

- Run the `preinstall` hook (`node build/npm/preinstall.js`).
- Install all dev and runtime dependencies as defined in [`void_genesis_ide/package.json`](void_genesis_ide/package.json:1).
- Run the `postinstall` hook (`node build/npm/postinstall.js`).

#### Step 2 — (Optional) Compile once

You can trigger a one-shot compile:

```powershell
npm run compile
```

This is equivalent to:

- `node ./node_modules/gulp/bin/gulp.js compile`

In many cases, `scripts/code.bat` will invoke `build/lib/preLaunch.js`, which ensures Electron and built-in extensions are in place and can trigger the necessary compilation. Running `npm run compile` first can surface compile errors earlier, but is not strictly required if `preLaunch.js` is successful.

#### Step 3 — Launch a desktop dev instance

Use the standard VS Code dev script for Windows:

```powershell
scripts\code.bat
```

[`scripts/code.bat`](void_genesis_ide/scripts/code.bat:1):

- Sets `NODE_ENV=development`, `VSCODE_DEV=1`, `VSCODE_CLI=1`.
- Runs `node build/lib/preLaunch.js` (unless `VSCODE_SKIP_PRELAUNCH` is set) to:
  - Ensure Electron is downloaded under `.build\electron`.
  - Compile the workbench and extensions as needed.
  - Manage built-in extensions.
- On subsequent runs, if `node_modules`, `out\main.js`, and `.build\electron/<nameShort>.exe` already exist, [`scripts/code.bat`](void_genesis_ide/scripts/code.bat:1) will set `VSCODE_SKIP_PRELAUNCH=1` and skip `preLaunch.js`, launching Electron directly for faster dev startup. To force a full prelaunch (for example after changing dependencies or pulling a large upstream update), clear `VSCODE_SKIP_PRELAUNCH` and/or remove those assets so that `preLaunch.js` runs again.
- Reads the short product name from [`void_genesis_ide/product.json`](void_genesis_ide/product.json:1), constructs:

  ```bat
  set CODE=".build\electron\%NAMESHORT%"
  ```

- Launches the Electron app:

  ```bat
  %CODE% . %DISABLE_TEST_EXTENSION% %*
  ```

If this fails due to extension build issues (missing npm modules, TS errors):

- Use the error logs to identify which extension(s) are problematic.
- Prefer **surgical fixes** (installing the missing dev dependency or adjusting a specific extension), not global disabling.
- Fall back to the builder-centric workflow to get a working binary if direct dev remains unstable.

#### Step 4 — Web/server dev variants (optional)

You can also experiment with web/server entrypoints:

- Web (serverless):

  ```powershell
  scripts\code-web.bat
  ```

  [`scripts/code-web.bat`](void_genesis_ide/scripts/code-web.bat:1):

  - Runs `npm run download-builtin-extensions`.
  - Resolves a Node runtime via `node build/lib/node.js` (downloading if needed).
  - Launches `scripts\code-web.js`.

- Server:

  ```powershell
  scripts\code-server.bat
  ```

  [`scripts/code-server.bat`](void_genesis_ide/scripts/code-server.bat:1):

  - Sets `NODE_ENV=development`, `VSCODE_DEV=1`.
  - Optionally runs `node build/lib/preLaunch.js`.
  - Resolves `NODE` and then launches `scripts\code-server.js`.

These variants are **not yet the primary focus** for Void Agent development but may be useful once desktop flows are stable.

### 5.3 Built-in extensions download and `VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD`

The `download-builtin-extensions` step is implemented by:

- [`void_genesis_ide/build/lib/builtInExtensions.ts`](void_genesis_ide/build/lib/builtInExtensions.ts:1)
- [`void_genesis_ide/build/lib/builtInExtensions.js`](void_genesis_ide/build/lib/builtInExtensions.js:1)

and wired from:

- [`"download-builtin-extensions": "node build/lib/builtInExtensions.js"`](void_genesis_ide/package.json:45)

When `npm run download-builtin-extensions` runs (for example from [`scripts/code-web.bat`](void_genesis_ide/scripts/code-web.bat:1)), it:

- Logs **“Synchronizing built-in extensions…”**.
- Reads the built-in extension lists from [`product.json`](void_genesis_ide/product.json:1).
- Downloads/updates extensions from:
  - Local VSIX paths, or
  - The configured marketplace (`extensionsGallery.serviceUrl`), or
  - GitHub fallbacks.

On some networks this step can hang or be very slow (e.g., blocked marketplace, firewall, or unreliable connectivity). To support **offline / constrained dev** without breaking production builds, the helper supports an explicit, opt-in escape hatch:

- Environment variable: `VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD`

Behavior:

- If **unset** (default) or set to anything other than `'1'` / `'true'`:
  - `npm run download-builtin-extensions` behaves as upstream:
    - Performs the full synchronization and download.
- If set to `'1'` or `'true'` in the environment of the Node process:
  - [`getBuiltInExtensions()`](void_genesis_ide/build/lib/builtInExtensions.ts:161) logs:

    > Skipping built-in extensions synchronization (VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD set).

  - Returns immediately without:
    - Reading/writing the control file under `~/.vscode-oss-dev/extensions/control.json`.
    - Downloading anything from marketplace or GitHub.
    - Modifying `.build/builtInExtensions/`.

#### 5.3.1 How to use the flag in dev

The desktop dev launcher [`scripts/code.bat`](void_genesis_ide/scripts/code.bat:1) now sets `VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD=1` by default if it is unset, so standard desktop dev runs skip the slow built-in extensions synchronization step. To force a full sync (for example when validating a new built-in extension), explicitly set `VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD=0` or `"false"` in the shell before calling `scripts\code.bat`.

From a **new terminal** (so you know which shells have the flag set) for other entrypoints or one-off manual runs:

- **PowerShell:**

  ```powershell
  $env:VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD = "1"

  cd c:\git\Void-Genesis\Void-Genesis\void_genesis_ide
  # Example: web dev entrypoint that triggers download-builtin-extensions
  scripts\code-web.bat
  ```

- **cmd.exe:**

  ```bat
  set VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD=1

  cd c:\git\Void-Genesis\Void-Genesis\void_genesis_ide
  rem Example: call the helper directly
  npm run download-builtin-extensions
  ```

Use this flag when:

- You are doing **local Void Agent / GPT‑5.1 development** and:
  - You do not require the very latest built-in extension set, or
  - Marketplace/GitHub access is unreliable or blocked.
- You want to avoid hangs at “Synchronizing built-in extensions…” during **dev** workflows.

Do **not** enable this flag for:

- Release / CI / official builder runs where you expect the full built-in extension set to be synchronized.

In other words:

- Treat `VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD` as a **dev-only performance and reliability knob**, not a permanent configuration for production builds.

---

## 6. How Changes Flow From `void_genesis_ide` Into the Built IDE

This section explicitly answers:

> “Does the agent modify the code that was built under `void-builder/vscode`? Would I then copy that and push it up to my `void-vdm-edition` repo?”

The discipline for this project is:

1. **Edit only in the canonical source repo:**  
   - [`void_genesis_ide/`](void_genesis_ide:1)

2. **Version control in that repo:**

   - Use Git branches, commits, and pushes from `void_genesis_ide`.

3. **Builder uses your remote fork:**

   - [`void-builder/get_repo.sh`](void-builder/get_repo.sh:1) clones `void_vdm-edition` into [`void-builder/vscode/`](void-builder/vscode:1).
   - This workspace is re-created or updated by the builder.
   - It should be treated as **throwaway**; do not make long-lived edits there.

4. **Build artifacts are produced under:**

   - [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1)

5. **You never “copy back” from `void-builder/vscode` to `void_genesis_ide`:**

   - If you ever prototype a fix in `void-builder/vscode`, you must **port it back** into `void_genesis_ide` and commit it there.
   - The canonical history remains in `void_genesis_ide` and its upstream fork `void_vdm-edition`.

In summary:

- **Yes**, the agent and IDE code you care about must live in `void_genesis_ide`.  
- **No**, you should not treat `void-builder/vscode` as the primary dev target or manually copy from there back into `void_genesis_ide`.  
- The correct flow is:

  ```text
  void_genesis_ide (edit + commit + push)
            ↓
     void_vdm-edition (GitHub remote)
            ↓
  void-builder (dev/build.ps1 → get_repo.sh → vscode/)
            ↓
  void-builder/VSCode-win32-x64 (Windows GUI bundle)
  ```

---

## 7. Recommended Usage Patterns

### 7.1 Validate structural / capability changes

When making changes to:

- [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1) (e.g., adding GPT‑5.1 entry).
- [`convertToLLMMessageService.ts`](void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts:1) (e.g., changing truncation or tool formatting).

Use this pattern:

1. Edit and unit-check locally in [`void_genesis_ide/`](void_genesis_ide:1).
2. (Optional) Run `npm run compile` to catch immediate TS errors.
3. Commit and push.
4. Run the builder via [`void-builder/dev/build.ps1`](void-builder/dev/build.ps1:1).
5. Launch the built IDE from [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1).
6. Manually test GPT‑5.1 behavior:
   - Paste large files.
   - Invoke file/terminal tools.
   - Verify truncation behavior and tool availability.

### 7.2 Fast iteration with direct dev (once stable)

Once the underlying extension/TS issues are reasonably stable:

1. Bring up a dev instance via:

   ```powershell
   cd c:\git\Void-Genesis\Void-Genesis\void_genesis_ide
   npm ci         # if not already done
   scripts\code.bat
   ```

2. Use this instance for:

   - Day-to-day debugging of TypeScript/JS/TSX changes in the workbench.
   - Quick iteration when the builder run would be too heavy.

3. Periodically still run the **builder-centric loop** to ensure that:

   - Your changes survive the full build pipeline.
   - There are no regressions introduced by patches or build-time transformations.

---

## 8. Future Enhancements (Planned)

Several improvements are anticipated (tracked in your TODO/decision logs):

1. **Local-source builder mode:**  
   - Optionally allow [`void-builder/dev/build.sh`](void-builder/dev/build.sh:1) to build against the local [`void_genesis_ide/`](void_genesis_ide:1) checkout instead of re-cloning from GitHub, for faster inner loops on a single machine.
   - This would require carefully updating [`void-builder/get_repo.sh`](void-builder/get_repo.sh:1) or adding a mode flag.

2. **Rust CLI build control:**  
   - Introduce a documented `SKIP_CLI_BUILD` option in [`void-builder/build_cli.sh`](void-builder/build_cli.sh:1) so that:
     - GUI builds don’t fail hard when the CLI cannot be built.
     - The choice is explicit and logged, not silent.

3. **Direct dev hardening:**  
   - Identify and address the specific extensions and TS projects that fail under `npm run compile` and `scripts\code.bat`.
   - Use surgical dependency fixes, not global disabling of extensions.

---

## 9. Summary

- **Primary workflow:** Use the **builder-centric loop**:
  - Edit & commit in [`void_genesis_ide/`](void_genesis_ide:1).
  - Push to `void_vdm-edition`.
  - Build via [`void-builder/dev/build.ps1`](void-builder/dev/build.ps1:1).
  - Run from [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1).

- **Secondary workflow:** Use **direct dev** via [`scripts/code.bat`](void_genesis_ide/scripts/code.bat:1) when the environment is stable, for faster local iteration.

- **Source-of-truth discipline:** Never treat [`void-builder/vscode/`](void-builder/vscode:1) as canonical; all permanent edits live in [`void_genesis_ide/`](void_genesis_ide:1).

This document is the baseline for subsequent work on GPT‑5.1 capabilities, tool integration, and agent behavior inside Void Genesis IDE. Any substantial change to the workflows described here should be reflected both in this file, in the `handoff` documentation (especially [`handoff/04_decision_log.md`](handoff/04_decision_log.md:1) and [`handoff/07_environment_spec.md`](handoff/07_environment_spec.md:1)), and in [`CRUX_INTEGRATION.md`](docs/crux_integration/CRUX_INTEGRATION.md:1) when it affects Crux × IDE integration.

---

## 10. Crux Service Lifecycle in Dev and Built IDEs

The Crux LLM provider service is managed by the IDE itself; you do **not** typically need to run it manually during local development.

- On startup, both:

  - The dev IDE launched via [`scripts/code.bat`](void_genesis_ide/scripts/code.bat:1), and
  - The built IDE launched from [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1),

  construct a [`CruxSupervisor`](void_genesis_ide/src/vs/workbench/contrib/void/electron-main/cruxSupervisor.ts:1) in [`CodeApplication.startup`](void_genesis_ide/src/vs/code/electron-main/app.ts:534) and call `startIfNeeded()`.

- Unless an external Crux URL is already configured, the supervisor:

  - Spawns a local Python process running `crux_providers.service.dev_server` from the Crux checkout directory (by default the sibling [`crux/`](crux:1), or [`void_genesis_ide/crux`](void_genesis_ide/crux:1) when configured as a nested submodule).
  - Waits for `GET /api/health` to return a JSON object where `ok === true`.
  - Sets `VOID_CRUX_HTTP_BASE_URL` in the IDE process environment so all Crux HTTP clients (for example, [`cruxBridge.ts`](void_genesis_ide/src/vs/workbench/contrib/void/electron-main/llmMessage/cruxBridge.ts:1)) see the same base URL.

- On normal IDE shutdown, `CruxSupervisor` attempts a graceful termination of the Crux child process before forcing a kill after a short timeout. See lifecycle details in [`cruxSupervisor.ts`](void_genesis_ide/src/vs/workbench/contrib/void/electron-main/cruxSupervisor.ts:1) and the conceptual overview in [`CRUX_IDE_INTEGRATION_SPEC.md`](docs/ai_ide/CRUX_IDE_INTEGRATION_SPEC.md:1).

### 10.1 Using an External Crux Instance (Advanced)

If you already run Crux separately (for example, as a long‑lived service for multiple tools), you can tell the IDE **not** to start its embedded Crux:

1. Start Crux externally and note its base URL, e.g. `http://127.0.0.1:8091`.
2. In the shell you use to launch the IDE, set either:

   ```bat
   set CRUX_HTTP_BASE_URL=http://127.0.0.1:8091
   ```

   or:

   ```bat
   set VOID_CRUX_HTTP_BASE_URL=http://127.0.0.1:8091
   ```

3. Then launch the IDE as usual:

   - Dev:

     ```bat
     cd c:\git\Void-Genesis\Void-Genesis\void_genesis_ide
     scripts\code.bat
     ```

   - Built bundle:

     ```bat
     cd c:\git\Void-Genesis\Void-Genesis\void-builder\VSCode-win32-x64
     .\Code.exe    REM or your Void-branded exe name
     ```

When these env vars are present, the IDE will:

- Use the provided base URL for all Crux `/api/chat`, `/api/models`, and `/api/health` calls.
- Skip spawning the local Python process.

This is useful when you want a single Crux instance serving multiple IDEs or when Crux runs in a dedicated, preconfigured environment.