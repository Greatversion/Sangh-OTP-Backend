if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const twilio = require('twilio');
const { parseBody } = require('../lib/helpers');

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio credentials not configured');
  return twilio(sid, token);
}

function getVerifyServiceSid() {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error('Twilio Verify Service SID not configured');
  return sid;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const phone = (body.phone || '').trim();

    if (!phone || !/^\+\d{7,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Valid phone number in E.164 format is required' });
    }

    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();

    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({ to: phone, channel: 'sms' });

    return res.status(200).json({
      success: true,
      status: verification.status,
    });
  } catch (err) {
    console.error('send-otp error:', err);
    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
};
