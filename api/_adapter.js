export async function runNetlifyHandler(req, res, netlifyHandler) {
  const event = {
    httpMethod: req.method,
    headers: req.headers || {},
    body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {})
  };

  const result = await netlifyHandler(event);
  const headers = result.headers || {};
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.status(result.statusCode || 200).send(result.body || "");
}
