const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body;

  if (!phone || typeof phone !== 'string' || phone.trim().length < 10) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }

  try {
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: phone.trim(), channel: 'sms' });

    return res.status(200).json({
      success: true,
      status: verification.status,
      message: 'OTP sent successfully',
    });
  } catch (err) {
    console.error('Twilio send-otp error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to send OTP',
    });
  }
};
