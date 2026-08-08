import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const projectPath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: projectPath("./github-pages"),
  base: "/coordinatez-axis-demo/",
  publicDir: projectPath("./public"),
  plugins: [react()],
  define: {
    __BRIEF_API_URL_B64__: JSON.stringify(process.env.BRIEF_API_URL_B64 ?? ""),
  },
  build: {
    outDir: projectPath("./docs"),
    emptyOutDir: true,
  },
});
