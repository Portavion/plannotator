/**
 * IDE integration — opens review files and plan diffs in external IDEs
 */

import { access } from "node:fs/promises";

const VSCODE_CLI_NOT_FOUND_ERROR =
  "VS Code CLI not found. Run 'Shell Command: Install code command in PATH' from the VS Code command palette.";

function splitCommand(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && quote === '"' && i + 1 < command.length) {
        i++;
        current += command[i];
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    if (char === "\\" && i + 1 < command.length) {
      i++;
      current += command[i];
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error(`Invalid editor command: unmatched ${quote}`);
  }
  if (current) {
    parts.push(current);
  }
  if (parts.length === 0) {
    throw new Error("Invalid editor command: empty value");
  }

  return parts;
}

async function runCommand(command: string, args: string[]): Promise<{ ok: true } | { error: string }> {
  return new Promise((resolve) => {
    try {
      const proc = Bun.spawn([command, ...args], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
      proc.unref();
      resolve({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to run ${command}`;
      if (msg.includes("ENOENT") || msg.includes("not found")) {
        resolve({ error: VSCODE_CLI_NOT_FOUND_ERROR });
      } else {
        resolve({ error: msg });
      }
    }
  });
}

async function runEditorCommand(command: string, filePath: string): Promise<{ ok: true } | { error: string }> {
  try {
    const parts = splitCommand(command);
    const [executable, ...args] = parts;
    return runCommand(executable, [...args, filePath]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to parse editor command" };
  }
}

/**
 * Open a file in VS Code.
 *
 * Args:
 * - filePath: Absolute path to the file to open
 *
 * Returns `{ ok: true }` on success or `{ error: string }` on failure.
 */
export async function openEditorFile(
  filePath: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await access(filePath);
  } catch {
    return { error: `File not found: ${filePath}` };
  }

  const preferredEditor = process.env.VISUAL || process.env.EDITOR;
  if (preferredEditor) {
    return runEditorCommand(preferredEditor, filePath);
  }

  return runCommand("code", [filePath]);
}

/**
 * Open two files in VS Code's diff viewer.
 *
 * Args:
 * - oldPath: Absolute path to the base file
 * - newPath: Absolute path to the updated file
 *
 * Returns `{ ok: true }` on success or `{ error: string }` on failure.
 */
export async function openEditorDiff(
  oldPath: string,
  newPath: string
): Promise<{ ok: true } | { error: string }> {
  return runCommand("code", ["--diff", oldPath, newPath]);
}
