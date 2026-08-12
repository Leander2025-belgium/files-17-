export async function handler(){
  const appId = process.env.GOOGLE_CAST_APP_ID || process.env.VITE_GOOGLE_CAST_APP_ID || '';
  const receiverUrl = process.env.GOOGLE_CAST_RECEIVER_URL || '';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      configured: Boolean(appId),
      appId: appId || null,
      receiverUrl: receiverUrl || null
    })
  };
}
