import createClient from '@/../utils/supabase/server-client';
const supabase = createClient;
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  const { to, script, from } = await req.json();

  if (!to || !script || !from) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Replace with your real credentials
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_SENDER, // Your Gmail address
      pass: process.env.EMAIL_PASS,   // App password (NOT your login pass)
    },
  });

  const mailOptions = {
    from: `"FalconX" <${process.env.EMAIL_SENDER}>`,
    to,
    subject: 'Install FalconX Tracking Code',
    html: `
      <p>Hi there,</p>
      <p>Please install the following tracking script on the <code>&lt;head&gt;</code> of your business website to enable affiliate tracking:</p>
      <pre style="background:#f4f4f4;padding:10px;border-radius:6px;">${script}</pre>
      <p>Once installed, FalconX will automatically track affiliate-driven sales and manage payouts.</p>
      <p>– The FalconX Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[❌ Email Error]', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}