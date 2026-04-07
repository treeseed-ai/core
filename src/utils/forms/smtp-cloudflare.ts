interface EmailMessage {
	to: string[];
	subject: string;
	text: string;
	replyTo?: string;
}

interface SmtpConfig {
	host: string;
	port: number;
	username: string;
	password: string;
	from: string;
	replyTo: string;
}

interface SocketContext {
	socket: {
		readable: ReadableStream<Uint8Array>;
		writable: WritableStream<Uint8Array>;
		startTls?(): {
			readable: ReadableStream<Uint8Array>;
			writable: WritableStream<Uint8Array>;
		};
	};
	reader: ReadableStreamDefaultReader<Uint8Array>;
	writer: WritableStreamDefaultWriter<Uint8Array>;
}

async function createSocketContext(port: number, host: string): Promise<SocketContext> {
	const { connect } = await import('cloudflare:sockets');
	const socket = connect(
		{ hostname: host, port },
		{
			secureTransport: port === 465 ? 'on' : 'off',
		},
	);

	return {
		socket,
		reader: socket.readable.getReader(),
		writer: socket.writable.getWriter(),
	};
}

async function readSmtpResponse(reader: ReadableStreamDefaultReader<Uint8Array>) {
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\r\n').filter(Boolean);
		const lastLine = lines.at(-1);
		if (lastLine && /^\d{3} /.test(lastLine)) {
			return {
				code: Number.parseInt(lastLine.slice(0, 3), 10),
				raw: buffer,
			};
		}
	}

	throw new Error('SMTP connection closed unexpectedly.');
}

async function sendCommand(context: SocketContext, command: string) {
	await context.writer.write(new TextEncoder().encode(`${command}\r\n`));
	return readSmtpResponse(context.reader);
}

function normalizeBody(text: string) {
	return text
		.replace(/\r?\n/g, '\r\n')
		.split('\r\n')
		.map((line) => (line.startsWith('.') ? `.${line}` : line))
		.join('\r\n');
}

function toEnvelopeAddress(value: string) {
	const match = value.match(/<([^>]+)>/);
	return (match?.[1] ?? value).trim();
}

function buildMessage({ to, subject, text, replyTo }: EmailMessage, from: string) {
	const headers = [
		`From: ${from}`,
		`To: ${to.join(', ')}`,
		`Subject: ${subject}`,
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset=UTF-8',
		`Date: ${new Date().toUTCString()}`,
	];

	if (replyTo) {
		headers.push(`Reply-To: ${replyTo}`);
	}

	return `${headers.join('\r\n')}\r\n\r\n${normalizeBody(text)}\r\n.`;
}

async function upgradeToTls(context: SocketContext): Promise<SocketContext> {
	if (typeof context.socket.startTls !== 'function') {
		throw new Error('SMTP socket does not support STARTTLS upgrade.');
	}

	const secureSocket = context.socket.startTls();
	return {
		socket: secureSocket,
		reader: secureSocket.readable.getReader(),
		writer: secureSocket.writable.getWriter(),
	};
}

function assertResponse(response: { code: number; raw: string }, acceptedCodes: number[]) {
	if (!acceptedCodes.includes(response.code)) {
		throw new Error(`SMTP command failed: ${response.raw}`);
	}
}

export async function sendEmailWithCloudflareSockets(
	message: EmailMessage,
	{ smtp, siteUrl }: { smtp: SmtpConfig; siteUrl: string },
) {
	const envelopeFrom = toEnvelopeAddress(smtp.from);

	if (!smtp.host || !smtp.port || !smtp.from || !envelopeFrom) {
		throw new Error('SMTP is not fully configured for Cloudflare-compatible delivery.');
	}

	let context = await createSocketContext(smtp.port, smtp.host);

	assertResponse(await readSmtpResponse(context.reader), [220]);
	assertResponse(await sendCommand(context, `EHLO ${new URL(siteUrl).hostname}`), [250]);

	if (smtp.port === 587) {
		assertResponse(await sendCommand(context, 'STARTTLS'), [220]);
		context = await upgradeToTls(context);
		assertResponse(await sendCommand(context, `EHLO ${new URL(siteUrl).hostname}`), [250]);
	}

	if (smtp.username) {
		assertResponse(await sendCommand(context, 'AUTH LOGIN'), [334]);
		assertResponse(await sendCommand(context, btoa(smtp.username)), [334]);
		assertResponse(await sendCommand(context, btoa(smtp.password)), [235]);
	}

	assertResponse(await sendCommand(context, `MAIL FROM:<${envelopeFrom}>`), [250]);

	for (const recipient of message.to) {
		assertResponse(await sendCommand(context, `RCPT TO:<${recipient}>`), [250, 251]);
	}

	assertResponse(await sendCommand(context, 'DATA'), [354]);
	assertResponse(await sendCommand(context, buildMessage(message, smtp.from)), [250]);
	await sendCommand(context, 'QUIT');
	await context.writer.close();
}
