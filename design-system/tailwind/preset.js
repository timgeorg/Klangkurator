/**
 * Klangkurator Tailwind preset (Tailwind CSS 3).
 *
 * Maps the design tokens in ../tokens/tokens.css to Tailwind theme keys.
 * Load fonts.css, tokens.css and base.css before the Tailwind layers; this
 * preset only names the variables, it does not define them.
 *
 *   // tailwind.config.ts
 *   import klangkurator from "./design-system/tailwind/preset.js";
 *   export default { presets: [klangkurator], content: [...], plugins: [...] };
 *
 * Color keys keep the shadcn/ui names (background, primary, muted, …) so
 * shadcn components work unchanged; Klangkurator roles are added beside them.
 */

const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;

/** @type {import("tailwindcss").Config} */
export default {
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: c("border"),
        input: c("input"),
        ring: c("ring"),
        background: c("background"),
        foreground: c("foreground"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        secondary: { DEFAULT: c("secondary"), foreground: c("secondary-foreground") },
        destructive: { DEFAULT: c("destructive"), foreground: c("destructive-foreground") },
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        accent: { DEFAULT: c("accent"), foreground: c("accent-foreground") },
        popover: { DEFAULT: c("popover"), foreground: c("popover-foreground") },
        card: { DEFAULT: c("card"), foreground: c("card-foreground") },
        signal: {
          DEFAULT: c("signal"),
          foreground: c("signal-foreground"),
          text: c("signal-text"),
          soft: c("signal-soft"),
        },
        success: c("success"),
        warning: c("warning"),
        info: c("info"),
        data: {
          1: c("data-1"),
          2: c("data-2"),
          3: c("data-3"),
          4: c("data-4"),
          5: c("data-5"),
        },
        waveform: { DEFAULT: c("waveform"), played: c("waveform-played") },
        sunken: c("surface-sunken"),
        scrim: "rgb(10 10 11 / <alpha-value>)",
        sidebar: {
          DEFAULT: c("sidebar-background"),
          foreground: c("sidebar-foreground"),
          muted: c("sidebar-muted"),
          primary: c("sidebar-primary"),
          "primary-foreground": c("sidebar-primary-foreground"),
          accent: c("sidebar-accent"),
          "accent-foreground": c("sidebar-accent-foreground"),
          border: c("sidebar-border"),
          ring: c("sidebar-ring"),
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        "display-sm": ["2.5rem", { lineHeight: "1.06", letterSpacing: "-0.015em" }],
        display: ["3.5rem", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        "display-lg": ["4.5rem", { lineHeight: "1", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius-control)",
        sm: "calc(var(--radius-control) - 2px)",
        chip: "var(--radius-chip)",
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
      },
      spacing: {
        rail: "var(--space-rail)",
        "rail-collapsed": "var(--space-rail-collapsed)",
        player: "var(--space-player)",
        "player-bar": "var(--space-player-bar)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        cut: "var(--dur-cut)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s var(--ease-out)",
        "accordion-up": "accordion-up 0.2s var(--ease-out)",
      },
    },
  },
};
