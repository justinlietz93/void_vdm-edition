# GPT‑5.1 Manual Testing Protocol – Void Genesis IDE

**Status:** v1 (manual test plan)  
**Scope:** End‑to‑end validation of GPT‑5.1 behavior inside Void Genesis IDE, focusing on:

- Context window behavior and truncation of large user messages.
- Availability and correct usage of built‑in tools (file read/edit, terminal, etc.) in **Agent** mode.
- Regression checks against the original “directory‑only tools + tiny prefix” failure mode.

This document is meant to be followed **manually** inside a running build or dev instance of the IDE.

---

## 1. Prerequisites

You must execute this test suite in **both** of the following environments and treat each run as a separate test pass:

1. **Built IDE bundle** from the builder:

   - Location: [`void-builder/VSCode-win32-x64/`](../../void-builder/VSCode-win32-x64)
   - Launch the main `.exe` from that directory.

2. **Direct dev instance** of the editor fork:

   - Repo: [`void_genesis_ide/`](../..)
   - Recommended Node: `20.18.2` (per [`.nvmrc`](../.nvmrc))
   - Typical commands from an external PowerShell / Windows Terminal using `nvm-windows`:

     ```powershell
     nvm use 20.18.2
     cd C:\git\Void-Genesis\Void-Genesis\void_genesis_ide
     npm ci
     npm run precommit      # optional but recommended
     scripts\code.bat
     ```

The tests are **faster to iterate** in a dev instance launched from [`scripts/code.bat`](../scripts/code.bat), but **all scenarios must also be validated in the built bundle** under [`void-builder/VSCode-win32-x64/`](../../void-builder/VSCode-win32-x64) before considering GPT‑5.1 behavior acceptable for release.

---

## 2. Environment Assumptions

- The IDE is running on **Windows 11**.
- The workspace root opened in the IDE is:

  ```text
  C:\git\Void-Genesis\Void-Genesis
  ```

- The editor fork directory:

  - [`void_genesis_ide/`](../..)

- The builder directory:

  - [`void-builder/`](../../void-builder)

- GPT‑5.1 is configured as an **OpenAI provider model** in Void settings:

  - Provider: `openAI`
  - Model name: any string matching `gpt-5.1*` (e.g., `gpt-5.1`, `gpt-5.1-mini`, etc.)

Internally, GPT‑5.1 must route through the OpenAI provider with:

- Large `contextWindow` and reasonable `reservedOutputTokenSpace`.
- `specialToolFormat = 'openai-style'` so tools are sent via the JSON `tools` field.
- `supportsSystemMessage = 'developer-role'` so system instructions are honored.

These are implemented in [`modelCapabilities.ts`](../src/vs/workbench/contrib/void/common/modelCapabilities.ts).

---

## 3. High-Level Test Matrix

You should execute the following **scenarios**:

1. **Basic connectivity and model selection**
   - Confirm GPT‑5.1 can be selected and answers simple questions.

2. **Large paste behavior (no tools)**
   - Verify that GPT‑5.1 sees *deep content* from large pasted files, not just an early prefix.

3. **Agent mode – tool visibility & usage**
   - Validate that Agent mode exposes the **full tool set** (read/edit files, run commands, etc.).
   - Confirm GPT‑5.1 actually calls these tools using OpenAI tool calling.

4. **Regression: original “directory‑only” illusion**
   - Specifically test for the prior failure mode where only directory listing tools were visible, and file content was truncated to a tiny prefix.

Each scenario below has detailed steps and expected observations.

---

## 4. Scenario 1 – Basic Connectivity & Model Selection

**Goal:** Confirm that GPT‑5.1 is configured and reachable through the IDE.

### Steps

1. Open the IDE (builder bundle or dev instance).
2. Open the Void Agent / chat panel.
3. In **Chat** mode (not Agent yet), ensure the OpenAI provider is selected.
4. Select the GPT‑5.1 model:

   - Use the model dropdown.
   - Choose the entry that corresponds to your GPT‑5.1 deployment.

5. In the chat box, send a simple prompt:

   ```text
   Test message: Please respond with the text "GPT-5.1 is online." and nothing else.
   ```

### Expected

- GPT‑5.1 responds with exactly:

  ```text
  GPT-5.1 is online.
  ```

- No errors about missing API keys or invalid model IDs.
- This validates:
  - Provider routing (`openAI`) is correct.
  - Model name is accepted and reachable.

---

## 5. Scenario 2 – Large Paste Behavior (Normal Chat Mode)

**Goal:** Verify that GPT‑5.1 no longer truncates pasted content to a tiny prefix due to misconfigured context window / output reservation.

### Steps

1. Ensure you are in **Chat** mode (not Agent).
2. Open a large but text-only file in the workspace, for example:
   - [`void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts`](../src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts)
   - Or any TypeScript/JavaScript file with **at least a few thousand lines / tens of thousands of characters**.
3. Select the entire file (`Ctrl+A` inside the editor) and copy.
4. In the GPT‑5.1 chat:
   - Paste the full file into the message box.
   - After the pasted content, add a question that references the **end** of the file, for example:

     ```text
     Above is the full content of a file.

     1. What is the name of the last exported function or value in this file?
     2. Briefly describe what that last function/value does.
     ```

5. Send the message.

### Expected

- GPT‑5.1 answers with information clearly derived from the **bottom** of the file (not just from the first hundreds of lines).
- It should identify the last export or at least a construct near the end, and describe its role.
- You should **not** see behavior like:
  - “I can only see the beginning of your file.”
  - Answers that only mention top‑of‑file constructs.

If GPT‑5.1 fails to reference end-of-file content or keeps acting as if the file is very short, that suggests a remaining truncation problem.

---

## 6. Scenario 3 – Agent Mode Tool Availability & Usage

**Goal:** Confirm that in **Agent** mode, GPT‑5.1 receives and uses the full suite of tools (not just directory listing) via **OpenAI-native tool calling**.

### Steps

1. Ensure GPT‑5.1 is selected (as in Scenario 1).
2. Switch the chat to **Agent** mode.
3. Provide a task that *requires* tools, for example:

   ```text
   I am working in the Void Genesis IDE repo.

   1. Use tools to list the contents of the `void_genesis_ide` folder.
   2. Then, use tools to open and read the first 100 lines of
      `void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts`.
   3. Summarize how GPT-5.1 models are currently handled, including any generic fallbacks.
   ```

4. Observe the conversation:

   - The agent should first use a directory/listing tool (`ls_dir` or equivalent) to explore the folder.
   - Then it should use a **file read** tool (`read_file`) to load the target file.
   - Finally, it should provide a summary answer.

### Expected

From a user-visible point of view:

- The agent reports that it is:
  - Listing directories under `void_genesis_ide`.
  - Reading contents of `modelCapabilities.ts`.
- It returns a coherent summary mentioning:
  - `openAIModelOptions` entries.
  - The generic fallback for `gpt-*` or `chatgpt` model names.
  - `specialToolFormat: 'openai-style'`.

From a behavioral point of view:

- You should see **multiple tools** available and used:
  - Directory listing.
  - File read.
  - Potentially others (search, etc.).
- You should **not** see the illusion that “only directory-level tools exist.”
- You should **not** see transport errors from OpenAI such as:

  ```text
  400 Invalid parameter: messages with role 'tool' must be a response to a preceeding message with 'tool_calls'.
  ```

Internally, this confirms that:

- GPT‑5.1 has `specialToolFormat = 'openai-style'`.
- Tools are not serialized into the system message as XML and then truncated away.
- Tools are attached natively in the request payload, as defined in:
  - [`sendLLMMessage.impl.ts`](../src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts)
  - [`prompts.ts`](../src/vs/workbench/contrib/void/common/prompt/prompts.ts)

---

## 7. Scenario 4 – Regression Test: Original “Directory‑Only” Failure Mode

**Goal:** Explicitly test for the **prior bug**:

- GPT‑5.1 appeared to have only directory tools and no file/terminal tools.
- Pasted user content was truncated to a tiny prefix.

### Steps

1. Switch to **Agent** mode with GPT‑5.1.
2. Paste a **medium/large** file directly into the Agent chat (e.g., a 5–10k line TypeScript file).
3. Ask a compound question that requires both:
   - Understanding content *near the end* of the file.
   - Using tools to inspect a second, related file. Example:

   ```text
   Here is the content of file A (pasted above).

   1. Based on this file, tell me what the last function does.
   2. Then, use tools to open and read the file that defines the tool capabilities registry
      (modelCapabilities.ts) and describe how GPT-5.1 is configured there.
   ```

4. Observe:

   - Does the agent **use file tools** or does it only appear to use directory listing?
   - Does it summarize content close to the end of the pasted file A, or only very early content?

### Expected

- GPT‑5.1 should:
  - Correctly interpret content near the *end* of the pasted file.
  - Use `read_file` (or similar) to open `modelCapabilities.ts`.
  - Provide a summary that mentions:
    - `getModelCapabilities()`.
    - The generic GPT‑5.1/OpenAI fallback behavior.
- You should no longer see:
  - Responses that only reference directory structure.
  - Statements that imply the model only sees an extremely small prefix of the file.

Any reappearance of “directory-only” behavior is a strong signal that something is still wrong in:

- Model capabilities context window / reserved output logic.
- OpenAI vs XML tool formatting.
- Message truncation weights and budgets.

---

## 8. Scenario 5 – Multi-Turn History With Tools

**Goal:** Ensure that with multiple turns of chat **and** several tool calls, GPT‑5.1 still maintains enough context to reason about earlier content and subsequent edits.

### Steps

1. In Agent mode with GPT‑5.1, start a conversation:

   1. Turn 1:
      - Paste a medium file from `void_genesis_ide/src/vs/workbench/contrib/void/...`.
      - Ask: “Summarize the main responsibilities of this file.”

   2. Turn 2:
      - Instruct the agent to:
        - Use tools to locate all references to `getModelCapabilities` in the codebase.
        - Summarize where it is used.

   3. Turn 3:
      - Ask it to propose a small, **concrete** refactor (no actual edit yet) to improve readability in `convertToLLMMessageService.ts`, then:
        - Use tools to open that file.
        - Point out where the refactor would apply.

2. Observe across all three turns:

   - Does GPT‑5.1 remember the earlier file summary?
   - Does it still have access to all necessary tools?
   - Does it reference accurate locations in `convertToLLMMessageService.ts` or `modelCapabilities.ts`?

### Expected

- The conversation remains coherent across turns.
- Tools are called across multiple messages without disappearing.
- There is no abrupt degradation into:
  - “I can’t see the file anymore.”
  - “I only see directory structure” symptoms.

---

## 9. How to Report Findings / Failures

When you run these tests, it is useful to capture for each scenario:

1. **Scenario ID**: (e.g., S2 – Large Paste Behavior).
2. **Environment**:
   - Builder bundle vs dev instance.
   - Node version (for dev).
3. **Inputs**:
   - Which file you pasted (path + approximate size).
   - Exact text of the user prompts.
4. **Observations**:
   - GPT‑5.1 outputs that show whether it saw full context.
   - Tool calls (describe observed behavior; you can paraphrase tool names and actions).
5. **Verdict**:
   - `PASS` – behavior matches expectations.
   - `FAIL` – truncation or tool availability issues observed.
   - `INCONCLUSIVE` – unclear behavior; needs deeper inspection.

If any scenario fails, that should trigger a **DEBUG → PLAN → CODE** loop focused on:

- Re-examining:
  - [`modelCapabilities.ts`](../src/vs/workbench/contrib/void/common/modelCapabilities.ts)
  - [`convertToLLMMessageService.ts`](../src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts)
  - [`sendLLMMessage.impl.ts`](../src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts)
- Adjusting context budgets or tool formatting as needed.
- Re-running the affected scenarios until they pass.

---

## 10. Maintenance of This Document

Whenever you:

- Add new GPT‑5.1 variants or aliases.
- Change context window or `reservedOutputTokenSpace` in [`modelCapabilities.ts`](../src/vs/workbench/contrib/void/common/modelCapabilities.ts).
- Change truncation or tool formatting logic in [`convertToLLMMessageService.ts`](../src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts).

You should:

1. Re-run **at least** Scenarios 1–4.
2. Update expected outcomes here if behavior legitimately changes.
3. Attach a short note in the commit message referencing this file (e.g., “Updated GPT‑5.1 testing protocol to cover new alias `gpt-5.1-math`.”).

This document is part of the **manual verification harness** for Void Genesis IDE’s GPT‑5.1 integration and should be kept in sync with any capability or message-building changes.