import nodemailer from 'nodemailer';

import config from '@/config/config';
import logger from '@/config/logger';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Sends an email using SMTP
 */
export async function sendEmail(options: EmailOptions) {
  // configure your SMTP transporter
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.auth.user,
      pass: config.smtp.auth.pass,
    },
  });

  const info = await transporter.sendMail({
    from: config.smtp.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    envelope: {
      from: config.smtp.from,
      to: options.to,
    },
  });

  logger.info(`[sendEmail] Message sent to ${options.to}: ${info.messageId}`);
  return info;
}
