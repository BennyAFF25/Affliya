import { renderNettmarkEmail } from "../../../utils/email/renderNettmarkEmail";
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
    from: `"Nettmark" <${process.env.EMAIL_SENDER}>`,
    to,
    subject: 'Install your Nettmark tracking code',
    html: renderNettmarkEmail({
      previewText: "Your Nettmark tracking code installation instructions.",
      badge: { text: "Tracking setup", tone: "info" },
      heading: "Install your tracking code",
      body: "Add the following script inside the <head> section of your business website to enable affiliate attribution.\n\n" + String(script) + "\n\nOnce installed, Nettmark can track eligible affiliate-driven activity according to your offer settings.",
      cta: { label: "Open Nettmark", href: "https://www.nettmark.com" },
      footerNote: "Only install tracking code you recognise and have authorised for your site.",
    }),
  };

  try {
    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[❌ Email Error]', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}