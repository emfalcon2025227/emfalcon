import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "firebase", "@firebase/app", "@firebase/firestore"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "firebase/app",
      "firebase/firestore",
      "firebase/auth",
      "lucide-react",
    ],
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
});
