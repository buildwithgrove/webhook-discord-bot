export default {
	async fetch(request: Request): Promise<Response> {
		// TODO_TECHDEBT: Require a shared secret header before proxying Discord API requests.
		//       Why: The Worker URL is public; without auth, anyone can use our quota or trigger
		//       rate limits that break legitimate bot traffic.
		//       How: Compare a request header against a Worker secret and configure the app to send it.
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
