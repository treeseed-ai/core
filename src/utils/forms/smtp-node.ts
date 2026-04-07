import nodemailer from 'nodemailer';
import { getSmtpConfig } from './config';

interface EmailMessage {
	to: string[];
	subject: string;
	text: string;
	replyTo?: string;
}

export async function sendEmailWithNode(message: EmailMessage) {
	const smtp = getSmtpConfig();

	if (!smtp.host || !smtp.port || !smtp.from) {
		throw new Error('SMTP is not fully configured for local delivery.');
	}

	const transporter = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.port === 465,
		auth: smtp.username
			? {
					user: smtp.username,
					pass: smtp.password,
				}
			: undefined,
	});

	await transporter.sendMail({
		from: smtp.from,
		to: message.to.join(', '),
		subject: message.subject,
		text: message.text,
		replyTo: message.replyTo || smtp.replyTo || undefined,
	});
}
