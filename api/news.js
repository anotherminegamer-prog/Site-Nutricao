import { handleNewsRequest } from "../server/news-core.js";

export default async function handler(req, res) {
  const topic = String(req.query?.topic || "");
  const { status, body, cache } = await handleNewsRequest(topic);
  res.setHeader("Cache-Control", cache);
  res.status(status).json(body);
}
