import nodemailer from 'nodemailer';
import fs from 'node:fs';

let smtpPass = '';
if (fs.existsSync('.env')) {
  const env = fs.readFileSync('.env', 'utf-8');
  const match = env.match(/SMTP_PASS=(.*)/);
  if (match) smtpPass = match[1].trim();
}

console.log('Testing SMTP connection for jonesarock79703@gmail.com...');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'jonesarock79703@gmail.com',
    pass: smtpPass
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function main() {
  try {
    await transporter.verify();
    console.log('? Connection verified!');
    
    console.log('Sending test email to jonesarock79703@gmail.com...');
    const info = await transporter.sendMail({
      from: '"SmartWeight Systems" <jonesarock79703@gmail.com>',
      to: 'jonesarock79703@gmail.com',
      subject: '? SmartWeight Systems - Nodemailer Test Working!',
      html: '<h3>Hello Dharineesh!</h3><p>Your Nodemailer configuration with Gmail SMTP is now <strong>100% working</strong>.</p><p>You will now receive all demo and contact submissions from the website!</p>'
    });
    console.log('?? SUCCESS! Test email sent to your inbox. Message ID:', info.messageId);
  } catch (err) {
    console.error('? Error:', err.message);
  }
}

main();
