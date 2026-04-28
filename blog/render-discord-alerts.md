# Render Webhooks + Discord: What the Docs Don't Tell You

Render is my favorite cloud for side projects and early-stage startups.
It's the infra platform every backend engineer wanted: custom domains, env vars, canary deploys, Postgres, Redis — all with zero ops overhead.
It's the Supabase of clouds.

You'll probably graduate to AWS or GCP one day.
But for anything you're actually shipping right now, Render just works.

We wanted deploy notifications in our `#alerts` Discord channel — a green embed when a deploy succeeds, red when something blows up.
Render has webhooks.
They have an example repo.
They even have a blog post about it.

But those three resources evolved independently.
Connecting them isn't obvious, and once we got it working, we hit a subtle rate-limiting bug that took a full day to diagnose.

We're open-sourcing our fork so you don't have to.

**→ [buildwithgrove/webhook-discord-bot](https://github.com/buildwithgrove/webhook-discord-bot)**

---

## Table of Contents

- [What Render Actually Gives You](#what-render-actually-gives-you)
- [The Architecture](#the-architecture)
- [What We Customized](#what-we-customized)
- [The Gotcha — Cloudflare Error 1015](#the-gotcha--cloudflare-error-1015)
- [Getting Started](#getting-started)

---

## What Render Actually Gives You

Before we get into what we built, here's a map of what Render provides — because the naming is confusing:

- **[Deploy hooks](https://render.com/docs/deploy-hooks)** — URLs that *trigger* deploys. Not what we want.
- **[Webhooks](https://render.com/docs/webhooks)** — push events to *your* endpoint when things happen. This is what we want.
- **[The example repo](https://github.com/render-examples/webhook-receiver)** — a working starting point for a webhook receiver.
- **[The blog post](https://render.com/blog/new-render-webhooks-and-metrics-streams)** — overview of the webhook feature.

The docs are good individually.
The confusion is in the seams: the example repo doesn't show how to configure the Render service, the blog post predates some webhook fields, and the spec page has all the detail but no end-to-end story.

This post is that end-to-end story.

---

## The Architecture

<!-- TODO: Insert infra diagram -->
<!--
Suggested diagram:
Render Service Event
  → Render Webhook Infrastructure
    → POST /webhook (webhook-discord-bot, running on Render)
      → Cloudflare Worker proxy
        → Discord API
          → #alerts channel
-->

Here's how data flows end-to-end:

```
Render Service Event
  → Render Webhook (POST /webhook)
    → Webhook receiver (Express on Render)
      → Validate signature (HMAC-SHA256 via standard-webhooks)
        → Fetch enriched data from Render API
          → Build Discord embed
            → Cloudflare Worker proxy
              → Discord API → #alerts
```

A few things worth calling out:

**Verify the signature.** Render signs every webhook with HMAC-SHA256. We use the [`standardwebhooks`](https://github.com/standard-webhooks/standard-webhooks) library rather than rolling our own — easy to get wrong, easy to get right with a library.

**Return 200 immediately, process async.** Render will retry delivery if your endpoint is slow. The bot responds synchronously, then processes the event in the background. This prevents spurious retries while letting the bot do its work.

**The webhook payload is minimal by design.** Render sends just enough to identify the event. The rich context (commit messages, failure reasons, instance counts) comes from follow-up calls to the Render API.

---

## What We Customized

The example repo gets you 80% of the way.
Here's what we added.

### 60+ Event Types, Not Just Deploys

The default example handles basic deploy events.
We extended it to cover everything Render sends:

- **Deploy lifecycle**: build started, pre-deploy, image pull, commit ignored, deploy ended
- **Service availability**: server available, server failed, restarted, suspended, resumed
- **Autoscaling**: instance count changed, autoscaling started/ended, config changed
- **Postgres**: 20+ events — backups, PITR, HA failover, credential rotation, upgrades, WAL archiving, disk autoscaling
- **Key-Value store**: available, config restart, unhealthy
- **Jobs & cron**: job run ended, cron job events
- **Maintenance windows**: started, ended, mode changes
- **Persistent disks**: created, updated, deleted

Each event has a color and an emoji, chosen to make the channel scannable at a glance:

| Category | Color | Emoji |
|---|---|---|
| Deploy success | Green | 🟢 |
| Deploy failed | Red | 🔴 |
| In-progress | Yellow | 🟡 |
| Postgres | Blue | 🐘 |
| Scaling | Teal | 📊 |
| Maintenance | Orange | 🔧 |
| Server failed | Pink | 💥 |

### Rich Deploy Embeds

A successful deploy notification includes:

- Commit message (first line, truncated to 256 chars)
- Short SHA (`abc1234` format)
- Branch name
- Trigger type (`github_push`, `manual`, etc.)
- **"View Logs" button** → direct link to the Render dashboard for that deploy

<!-- TODO_IN_THIS_PR: Add screenshot of Discord #alerts showing a real deploy embed
     What: A screenshot of the #alerts channel with a successful deploy notification
     Why: Visual proof that makes the "rich embeds" section concrete for readers -->

### Three-Layer Data Enrichment

The webhook payload alone is minimal — just the event type, service ID, and status.
We make up to three Render API calls to enrich each notification:

1. `GET /services/{serviceId}` — service name and dashboard URL
2. `GET /events/{id}` — event-specific details (failure reason, scaling deltas, version)
3. `GET /services/{serviceId}/deploys/{deployId}` — commit, branch, trigger type, Docker image

If any of these fail, we fall back gracefully — the notification still goes through, just with less detail.

---

## The Gotcha — Cloudflare Error 1015

This is the part the docs don't tell you about.

After deploying, the bot would intermittently fail to connect to Discord at startup:

```
Discord login timed out after 30s — gateway WebSocket may be blocked
```

Or the health check would return:

```json
{
  "discordReady": false,
  "tokenValid": false,
  "botUser": { "error": 429 }
}
```

With an HTML body containing Cloudflare's Error 1015: **"You are being rate limited."**

The token was valid — we could confirm that locally with a `curl` to `discord.com/api/v10/users/@me`. The problem was specifically on Render's network.

**Root cause**: Render's starter tier shares outbound IPs across tenants.
Discord is protected by Cloudflare.
If any tenant on that shared IP makes too many invalid or unauthenticated requests to Discord's API, Cloudflare bans the IP — and your bot is collateral damage.

From Discord's docs:

> *"IP addresses that make too many invalid HTTP requests are automatically and temporarily restricted from accessing the Discord API."*

Redeploying (which assigns a fresh IP) was a temporary fix.
The real fix was routing Discord REST calls through an IP we control.

### The Fix: A 15-Line Cloudflare Worker

```typescript
// discord-proxy/src/index.ts
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
```

Deploy this as a Cloudflare Worker (free tier: 100k requests/day — more than enough), then set one env var:

```
DISCORD_API_PROXY=https://your-worker.workers.dev
```

The discord.js client routes all REST calls through the Worker.
The gateway WebSocket (`client.login`) still connects directly — it's a single persistent connection and never triggers rate limits.

**Why it works**: Cloudflare Workers have their own outbound IPs, separate from Render's shared pool.
Even if another Render tenant gets banned from Discord, your Worker IP stays clean.

---

## Getting Started

<!-- TODO_IN_THIS_PR: Walk through these steps on a fresh machine to verify they're complete and correct
     What: End-to-end smoke test of the Getting Started section
     Why: Steps were written from memory — need to confirm nothing is missing before publishing -->

<!-- TODO_IMPROVE: Make this section fully copy-pastable — one command per block, no inline decision points
     What: Replace prose like "or create a new Web Service" with a concrete choice (use render.yaml)
     Why: Readers should be able to follow top-to-bottom without stopping to think -->

**Fork the repo:**

```bash
git clone https://github.com/buildwithgrove/webhook-discord-bot
cd webhook-discord-bot
pnpm install
```

**Create a Discord bot:**

- `discord.com/developers/applications` → New Application → Bot → copy the token
- Under OAuth2 → URL Generator: select `bot` scope + `Send Messages` and `Embed Links` permissions
- Invite the bot to your server
- Right-click your `#alerts` channel → Copy Channel ID

**Deploy the Cloudflare Worker:**

```bash
cd discord-proxy
npx wrangler deploy
```

Note the Worker URL (e.g. `https://discord-proxy.yourname.workers.dev`).

**Deploy to Render:**

Use the `render.yaml` in the repo, or create a new Web Service pointed at your fork.

Set these environment variables:

| Variable | Where to find it |
|---|---|
| `DISCORD_TOKEN` | Discord Developer Portal → Bot |
| `DISCORD_CHANNEL_ID` | Right-click channel in Discord |
| `RENDER_WEBHOOK_SECRET` | Render Dashboard → Webhooks (after creating the webhook) |
| `RENDER_API_KEY` | Render Dashboard → Account Settings → API Keys |
| `DISCORD_API_PROXY` | Your Cloudflare Worker URL |

**Register the webhook on Render:**

- Render Dashboard → your project → Webhooks → Add Webhook
- URL: `https://your-service.onrender.com/webhook`
- Copy the signing secret → set as `RENDER_WEBHOOK_SECRET` on your service

**Verify it's working:**

```bash
curl https://your-service.onrender.com/health
```

You should see `"discordReady": true`.
Trigger a deploy on any service and watch `#alerts`.

---

## Wrapping Up

Render makes this kind of integration genuinely easy.
A real HTTPS endpoint, env vars, a webhook registration UI — done.

The rough edge is the gap between the example repo, the blog post, and the webhook spec.
Each is useful; none tells the full story.
Hopefully this post fills that gap.

A big thank you to the Render team for building a platform that actually removes friction for developers.
From the webhook infrastructure to the example repo to the support conversation that helped us debug this — it was all genuinely helpful.
Keep shipping.

If you're building on Render and want a production-ready Discord alert setup — including the Cloudflare fix — the fork is at **[buildwithgrove/webhook-discord-bot](https://github.com/buildwithgrove/webhook-discord-bot)**.
PRs welcome.

<!-- TODO_IDEA: Make the repo agent-friendly — add an AGENTS.md or llms.txt describing the architecture,
     event types, and how to extend it so AI coding tools can help contributors without reading all 500 lines
     Why: Agents are increasingly used to set up infra; a well-described repo is easier to fork and customize -->
