# Welcome to Void.

<div align="center">
	<img
		src="./src/vs/workbench/browser/parts/editor/media/slice_of_void.png"
	 	alt="Void Welcome"
		width="300"
	 	height="300"
	/>
</div>

Void is the open-source Cursor alternative.

Use AI agents on your codebase, checkpoint and visualize changes, and bring any model or host locally. Void sends messages directly to providers without retaining your data.

This repo contains the full sourcecode for Void. If you're new, welcome!

- 🧭 [Website](https://voideditor.com)

- 👋 [Discord](https://discord.gg/RSNjgaugJs)

- 🚙 [Project Board](https://github.com/orgs/voideditor/projects/2)


## Contributing

1. To get started working on Void, check out our Project Board! You can also see [HOW_TO_CONTRIBUTE](https://github.com/voideditor/void/blob/main/HOW_TO_CONTRIBUTE.md).

2. Feel free to attend a casual weekly meeting in our Discord channel!


## Reference

Void is a fork of the [vscode](https://github.com/microsoft/vscode) repository. For a guide to the codebase, see [VOID_CODEBASE_GUIDE](https://github.com/voideditor/void/blob/main/VOID_CODEBASE_GUIDE.md).

## Repositories and Source of Truth

Void Genesis IDE is developed in two coordinated repositories inside the wider Void monorepo:

- Editor fork (canonical source of truth): [`void_genesis_ide/`](void_genesis_ide:1)
- Builder fork (build pipeline only): [`void-builder/`](void-builder:1)

**Policy:**

- All long-lived code and configuration for the IDE (including Void Agent, Crux integration glue, and workbench customizations) lives in [`void_genesis_ide/`](void_genesis_ide:1). This is the repo you edit, commit, and push.
- [`void-builder/vscode/`](void-builder/vscode:1) is an **ephemeral build workspace** created by the builder. It is populated from your remote fork and may be regenerated at any time. Do **not** treat it as canonical or make long-lived edits there.
- Built desktop bundles (e.g. Windows binaries) are produced under paths like [`void-builder/VSCode-win32-x64/`](void-builder/VSCode-win32-x64:1).

For the authoritative development workflow and more detail on how changes in this repo flow into built binaries, see [`DEV_WORKFLOW.md`](void_genesis_ide/DEV_WORKFLOW.md:1).

## Note
Work is temporarily paused on the Void IDE (this repo) while we experiment with a few novel AI coding ideas for Void. Stay alerted with new releases in our Discord channel.

## Support
You can always reach us in our Discord server or contact us via email: hello@voideditor.com.
