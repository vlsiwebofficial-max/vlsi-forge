module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0E14",
        surface: "#13171E",
        surface2: "#1A1F28",
        border: "#1E2530",
        primary: "#4A8FE8",
        accent: "#3B7ACC",
        muted: "#7A8FA8",
        textcolor: "#E8EDF4",
        success: "#22C55E",
        error: "#EF4444",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
        heading: ["'Space Grotesk'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
