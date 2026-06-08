if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const twilio = require('twilio');
const admin = require('firebase-admin');
const { parseBody, getFirebaseCredential } = require('../lib/helpers');

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

function ensureFirebaseAdmin() {
  if (!admin.apps.length) {
    const cred = getFirebaseCredential();
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: cred.projectId,
        clientEmail: cred.clientEmail,
        privateKey: cred.privateKey,
      }),
    });
  }
  return admin;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const phone = (body.phone || '').trim();
    const otp = (body.otp || '').trim();

    if (!phone || !/^\+\d{7,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Valid phone number in E.164 format is required' });
    }
    if (!otp || !/^\d{4,8}$/.test(otp)) {
      return res.status(400).json({ error: 'Valid OTP is required (4-8 digits)' });
    }

    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();

    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to: phone, code: otp });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const fbAdmin = ensureFirebaseAdmin();

    let firebaseUser;
    try {
      firebaseUser = await fbAdmin.auth().getUserByPhoneNumber(phone);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        firebaseUser = await fbAdmin.auth().createUser({ phoneNumber: phone });
      } else {
        throw err;
      }
    }

    const customToken = await fbAdmin.auth().createCustomToken(firebaseUser.uid);

    return res.status(200).json({
      success: true,
      customToken,
      uid: firebaseUser.uid,
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
};
