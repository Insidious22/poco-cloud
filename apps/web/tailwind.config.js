/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080b10",
        panel: "#0d121a",
        panelSoft: "#111827",
        line: "#202938",
        cyanGlow: "#22d3ee",
        signal: "#5eead4",
        danger: "#fb7185",
        amberSoft: "#fbbf24"
      },
      boxShadow: {
        glow: "0 0 40px rgba(34, 211, 238, 0.14)"
      }
    }
  },
  plugins: []
};
