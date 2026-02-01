import { EmailNotificationOptions } from '@/types/notification.type';

import logger from '../logger';
import config from '../../config/config';
import nodemailer from 'nodemailer';

/**
 * Sends an email using SMTP
 */
export async function sendEmail(options: EmailNotificationOptions) {
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
