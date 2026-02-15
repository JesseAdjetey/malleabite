
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'large-title': ['var(--font-large-title)', { lineHeight: '1.2', fontWeight: '700' }],
        'title1': ['var(--font-title1)', { lineHeight: '1.25', fontWeight: '700' }],
        'title2': ['var(--font-title2)', { lineHeight: '1.3', fontWeight: '700' }],
        'title3': ['var(--font-title3)', { lineHeight: '1.35', fontWeight: '600' }],
        'headline': ['var(--font-headline)', { lineHeight: '1.4', fontWeight: '600' }],
        'ios-body': ['var(--font-body)', { lineHeight: '1.5', fontWeight: '400' }],
        'callout': ['var(--font-callout)', { lineHeight: '1.45', fontWeight: '400' }],
        'subheadline': ['var(--font-subheadline)', { lineHeight: '1.4', fontWeight: '400' }],
        'footnote': ['var(--font-footnote)', { lineHeight: '1.35', fontWeight: '400' }],
        'caption1': ['var(--font-caption1)', { lineHeight: '1.3', fontWeight: '400' }],
        'caption2': ['var(--font-caption2)', { lineHeight: '1.2', fontWeight: '400' }],
      },
      colors: {
        separator: 'hsl(var(--separator))',
        'grouped-bg': 'hsl(var(--grouped-bg))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        "purple": {
          "50": "#F5F3FF",
          "100": "#EDE9FE",
          "200": "#DDD6FE",
          "300": "#C4B5FD",
          "400": "#A78BFA",
          "500": "#8B5CF6",
          "600": "#7C3AED",
          "700": "#6D28D9",
          "800": "#5B21B6",
          "900": "#4C1D95",
          "950": "#2E1065"
        },
        "timegeist": {
          "primary": "#8664A0",
          "secondary": "#6B46C1",
          "accent": "#9F7AEA",
          "light": "#E9D8FD",
          "dark": "#322659"
        }
      },
      borderRadius: {
        'xl-ios': 'var(--radius-xl)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'pulse-border': {
          '0%, 100%': { borderColor: 'rgba(134, 100, 160, 0.3)' },
          '50%': { borderColor: 'rgba(134, 100, 160, 0.8)' }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(134, 100, 160, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(134, 100, 160, 0.8)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-border': 'pulse-border 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite'
      },
      backdropFilter: {
        'none': 'none',
        'blur': 'blur(8px)',
      },
    }
  },
  plugins: [
    require("tailwindcss-animate"),
    require("tailwind-scrollbar")({ nocompatible: true })
  ],
};
export default config;
