export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const target = `https://discord.com${url.pathname}${url.search}`;

		const headers = new Headers(request.headers);
		headers.set("Host", "discord.com");

		return fetch(target, {
			method: request.method,
			headers,
			body: request.body,
		});
	},
};
