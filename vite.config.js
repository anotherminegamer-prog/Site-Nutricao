import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleNewsRequest } from "./server/news-core.js";

const newsMiddleware = async (req, res) => {
  const topic = new URL(req.url, "http://localhost").searchParams.get("topic") || "";
  const { status, body } = await handleNewsRequest(topic);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const newsDevApi = () => ({
  name: "news-dev-api",
  configureServer(server) {
    server.middlewares.use("/api/news", newsMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use("/api/news", newsMiddleware);
  },
});

export default defineConfig({
  plugins: [react(), newsDevApi()],
});
