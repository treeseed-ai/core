import type { FormRuntimeCapabilities } from '../../types/forms';

interface EmailMessage {
	to: string[];
	subject: string;
	text: string;
	replyTo?: string;
}

interface SendEmailOptions {
	smtp: {
		host: string;
		port: number;
		username: string;
		password: string;
		from: string;
		replyTo: string;
	};
	siteUrl: string;
}

export async function sendEmail(
	message: EmailMessage,
	runtime: FormRuntimeCapabilities,
	options: SendEmailOptions,
) {
	if (runtime.isCloudflareRuntime) {
		const { sendEmailWithCloudflareSockets } = await import('./smtp-cloudflare');
		return sendEmailWithCloudflareSockets(message, options);
	}

	throw new Error('Email delivery requires Cloudflare runtime bindings in this docs deployment.');
}
