import { handler as netlifyHandler } from '../netlify/functions/lightning.js';
import { runNetlifyHandler } from './_adapter.js';
export default function handler(req,res){ return runNetlifyHandler(req,res,netlifyHandler); }
