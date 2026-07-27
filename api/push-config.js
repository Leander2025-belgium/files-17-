import { handler as netlifyHandler } from "../netlify/functions/push-config.js";
import { runNetlifyHandler } from "./_adapter.js";

export default function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
