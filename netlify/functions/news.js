import { handleNewsRequest } from "../../server/news-core.js";

export default async (req) => {
  const topic = new URL(req.url).searchParams.get("topic") || "";
  const { status, body, cache } = await handleNewsRequest(topic);
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache },
  });
};

export const config = { path: "/api/news" };
