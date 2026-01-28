/**
 * Terminal color utilities using ANSI escape codes.
 * Provides colored text output for CLI applications.
 */

const RESET = "\x1b[0m";

/**
 * Wraps text with ANSI color codes.
 */
function colorize(code: string, text: string): string {
	return `${code}${text}${RESET}`;
}

export const colors = {
	bold: (text: string) => colorize("\x1b[1m", text),
	red: (text: string) => colorize("\x1b[31m", text),
	green: (text: string) => colorize("\x1b[32m", text),
	yellow: (text: string) => colorize("\x1b[33m", text),
	blue: (text: string) => colorize("\x1b[34m", text),
	magenta: (text: string) => colorize("\x1b[35m", text),
	cyan: (text: string) => colorize("\x1b[36m", text),
	white: (text: string) => colorize("\x1b[37m", text),
};
