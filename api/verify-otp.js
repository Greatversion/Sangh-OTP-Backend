const twilio = require('twilio');
const admin = require('firebase-admin');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, otp } = req.body;

  if (!phone || typeof phone !== 'string' || phone.trim().length < 10) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }
  if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
    return res.status(400).json({ error: 'OTP is required' });
  }

  try {
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: phone.trim(), code: otp.trim() });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({
        error: 'Invalid or expired OTP',
        status: verificationCheck.status,
      });
    }

    const normalizedPhone = phone.trim();

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByPhoneNumber(normalizedPhone);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        firebaseUser = await admin.auth().createUser({
          phoneNumber: normalizedPhone,
        });
      } else {
        throw err;
      }
    }

    const customToken = await admin.auth().createCustomToken(firebaseUser.uid);

    return res.status(200).json({
      success: true,
      customToken,
      uid: firebaseUser.uid,
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({
      error: err.message || 'Verification failed',
    });
  }
};
