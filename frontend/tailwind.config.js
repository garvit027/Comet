
export default {
  content: ["./index.html", "./src*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#0B1126",
        canvas: "#F4F6FA",
        primary: { DEFAULT: "#4F46E5", hover: "#4338CA", light: "#5B46F6" },
        border: "#E2E8F0",
      },
      fontFamily: {
        sans: ["Inter", "Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,0.04)",
      },
    },
  },
  plugins: [],
};
