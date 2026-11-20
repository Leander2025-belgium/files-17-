import { proxyRequest } from "../../server/ov-proxy.mjs";

export async function handler(event) {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "X-OVFlow-Proxy": "1" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  const result = await proxyRequest(event.queryStringParameters?.url);
  return { statusCode: result.status, headers: { ...cors, ...result.headers }, body: result.body };
}
