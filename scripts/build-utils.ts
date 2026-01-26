/**
 * Shared build utilities for reducing duplication across build scripts.
 */

import { existsSync, statSync } from "node:fs";
import type { BuildArtifact } from "bun";

/**
 * Options for writing build output.
 */
export type WriteBuildOutputOptions = {
	/**
	 * The build output from Bun.build().
	 */
	output: BuildArtifact;
	/**
	 * The target file path to write the output to.
	 */
	targetPath: string;
	/**
	 * Optional name for error messages (e.g., "popup", "web").
	 */
	name?: string;
};

/**
 * Writes build output to a file, including sourcemap if available.
 *
 * @param options - Options for writing the output.
 * @throws If output is missing or file cannot be written.
 */
export async function writeBuildOutput(options: WriteBuildOutputOptions): Promise<void> {
	const { output, targetPath, name = "build" } = options;

	if (!output) {
		console.error(`${name} build succeeded but no output file was generated`);
		process.exit(1);
	}

	await Bun.write(targetPath, output);

	if (output.sourcemap) {
		await Bun.write(`${targetPath}.map`, output.sourcemap);
	}
}

/**
 * Options for validating build output files.
 */
export type ValidateBuildFilesOptions = {
	/**
	 * Array of file paths to validate.
	 */
	files: string[];
	/**
	 * Whether to check file size (must be > 0).
	 */
	checkSize?: boolean;
};

/**
 * Validates that build output files exist and optionally checks their size.
 *
 * @param options - Options for validation.
 * @throws If any file is missing or empty (if checkSize is true).
 */
export function validateBuildFiles(options: ValidateBuildFilesOptions): void {
	const { files, checkSize = true } = options;

	for (const file of files) {
		if (!existsSync(file)) {
			console.error(`Build failed: ${file} was not created`);
			process.exit(1);
		}

		if (checkSize) {
			const stats = statSync(file);
			if (stats.size === 0) {
				console.error(`Build failed: ${file} is empty`);
				process.exit(1);
			}
		}
	}
}

/**
 * Handles build result errors and exits if build failed.
 *
 * @param result - The build result from Bun.build().
 * @param name - Optional name for error messages (e.g., "popup", "web").
 * @throws If build was not successful.
 */
export function handleBuildResult(
	result: { success: boolean; logs?: unknown[] },
	name: string = "build",
): void {
	if (!result.success) {
		console.error(`${name} build failed:`, result.logs);
		process.exit(1);
	}
}
