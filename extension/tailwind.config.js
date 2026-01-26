/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./extension/popup.html", "./extension/popup.ts", "./extension/popup.js"],
	theme: {
		extend: {
			keyframes: {
				fadeIn: {
					"0%": { opacity: "0", transform: "translateY(-4px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
			},
			animation: {
				fadeIn: "fadeIn 0.2s ease-in",
			},
		},
	},
	plugins: [],
};
