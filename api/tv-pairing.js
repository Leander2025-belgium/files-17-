import { handler as netlifyHandler } from "../netlify/functions/tv-pairing.js";
import { runNetlifyHandler } from "./_adapter.js";

export default async function handler(req, res) {
  await runNetlifyHandler(req, res, netlifyHandler);
}
