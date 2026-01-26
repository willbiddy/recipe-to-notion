/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./extension/popup.html",
		"./extension/popup.tsx",
		"./extension/popup.js",
		"./public/index.html",
		"./public/web.tsx",
		"./public/web.js",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ["Nunito", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
			},
			colors: {
				primary: {
					50: "#fff7ed",
					100: "#ffedd5",
					200: "#fed7aa",
					300: "#fdba74",
					400: "#fb923c",
					500: "#f97316",
					600: "#ea580c",
					700: "#c2410c",
					800: "#9a3412",
					900: "#7c2d12",
					950: "#431407",
				},
				accent: {
					50: "#fffbeb",
					100: "#fef3c7",
					200: "#fde68a",
					300: "#fcd34d",
					400: "#fbbf24",
					500: "#f59e0b",
					600: "#d97706",
					700: "#b45309",
					800: "#92400e",
					900: "#78350f",
					950: "#451a03",
				},
				success: {
					50: "#f0fdf4",
					100: "#dcfce7",
					200: "#bbf7d0",
					300: "#86efac",
					400: "#4ade80",
					500: "#22c55e",
					600: "#16a34a",
					700: "#15803d",
					800: "#166534",
					900: "#14532d",
					950: "#052e16",
				},
				error: {
					50: "#fef2f2",
					100: "#fee2e2",
					200: "#fecaca",
					300: "#fca5a5",
					400: "#f87171",
					500: "#ef4444",
					600: "#dc2626",
					700: "#b91c1c",
					800: "#991b1b",
					900: "#7f1d1d",
					950: "#450a0a",
				},
			},
			boxShadow: {
				card: "0 20px 50px -12px rgba(251, 146, 60, 0.15), 0 0 0 1px rgba(251, 146, 60, 0.05)",
				button: "0 10px 25px -5px rgba(251, 146, 60, 0.4)",
				"button-sm": "0 4px 14px -2px rgba(251, 146, 60, 0.4)",
			},
			backgroundImage: {
				"gradient-radial-orange":
					"radial-gradient(circle at 20% 50%, rgba(251, 146, 60, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)",
			},
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
