import { defineConfig } from "vite";

export default defineConfig({
  root: "example",
  server: {
    fs: {
      allow: [".."],
    },
  },
});
