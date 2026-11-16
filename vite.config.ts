import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "compact-html-indent",
      apply: "build",
      transformIndexHtml: {
        order: "post",
        handler: (html) =>
          html.replace(
            /<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|^[\t ]+/gim,
            (match) => (match.startsWith("<") ? match : ""),
          ),
      },
    },
  ],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/crates/**",
        "**/target/**",
        "**/.reference/**",
      ],
    },
  },
  build: {
    target: "es2020",
    // Blockly is intentionally one lazy offline editor chunk; see ADR-027.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: { main: "index.html", auxiliary: "auxiliary.html", automationBar: "automation-bar.html" },
    },
  },
});
