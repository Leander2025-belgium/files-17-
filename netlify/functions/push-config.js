const { json } = require("./push-utils");

exports.handler = async () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  return json(200, {
    vapidPublicKey: publicKey,
    configured: Boolean(publicKey && process.env.VAPID_PRIVATE_KEY)
  });
};
