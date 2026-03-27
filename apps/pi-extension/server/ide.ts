/**
 * IDE integration — opens review files and plan diffs in external IDEs
 * Node.js equivalent of packages/server/ide.ts
 */

import { spawn } from "node:child_process";
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

function runCommand(
	command: string,
	args: string[],
): Promise<{ ok: true } | { error: string }> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			detached: true,
			stdio: "ignore",
		});
		proc.on("error", (err) => {
			if (err.message.includes("ENOENT") || err.message.includes("not found")) {
				resolve({ error: VSCODE_CLI_NOT_FOUND_ERROR });
			} else {
				resolve({ error: err.message });
			}
		});
		proc.on("spawn", () => {
			proc.unref();
			resolve({ ok: true });
		});
	});
}

function runEditorCommand(
	command: string,
	filePath: string,
): Promise<{ ok: true } | { error: string }> {
	try {
		const parts = splitCommand(command);
		const [executable, ...args] = parts;
		return runCommand(executable, [...args, filePath]);
	} catch (err) {
		return Promise.resolve({
			error:
				err instanceof Error ? err.message : "Failed to parse editor command",
		});
	}
}

/** Open a file in the preferred local editor */
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

/** Open two files in VS Code's diff viewer */
export function openEditorDiff(
	oldPath: string,
	newPath: string,
): Promise<{ ok: true } | { error: string }> {
	return runCommand("code", ["--diff", oldPath, newPath]);
}
