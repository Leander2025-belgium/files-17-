import { proxyRequest } from "../server/ov-proxy.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("X-OVFlow-Proxy", "1");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const result = await proxyRequest(req.query?.url);
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  return res.status(result.status).send(result.body);
}
