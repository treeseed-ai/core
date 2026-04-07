declare module 'cloudflare:sockets' {
	export interface Socket {
		readable: ReadableStream<Uint8Array>;
		writable: WritableStream<Uint8Array>;
		startTls(): Socket;
		close(): Promise<void>;
	}

	export interface SocketOptions {
		secureTransport?: 'off' | 'on' | 'starttls';
	}

	export function connect(address: { hostname: string; port: number }, options?: SocketOptions): Socket;
}
