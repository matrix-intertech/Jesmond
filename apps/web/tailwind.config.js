/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        brand: {
          indigo: "rgb(var(--brand-indigo) / <alpha-value>)",
          purple: "rgb(var(--brand-purple) / <alpha-value>)",
          "bright-purple": "rgb(var(--brand-bright-purple) / <alpha-value>)",
          magenta: "rgb(var(--brand-magenta) / <alpha-value>)",
          "hot-pink": "rgb(var(--brand-hot-pink) / <alpha-value>)",
          orange: "rgb(var(--brand-orange) / <alpha-value>)",
          "orange-light": "rgb(var(--brand-orange-light) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
          lavender: "var(--surface-lavender)",
          pink: "var(--surface-pink)",
          orange: "var(--surface-orange)",
        },
        border: {
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },
        semantic: {
          success: "var(--success)",
          "success-bg": "var(--success-bg)",
          warning: "var(--warning)",
          "warning-bg": "var(--warning-bg)",
          error: "var(--error)",
          "error-bg": "var(--error-bg)",
          info: "var(--info)",
          "info-bg": "var(--info-bg)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        }
      }
    },
  },
  plugins: [],
}
