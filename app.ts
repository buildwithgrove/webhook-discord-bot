import express, {NextFunction, Request, Response} from "express";
import {Webhook, WebhookUnbrandedRequiredHeaders, WebhookVerificationError} from "standardwebhooks"
import {RenderDeploy, RenderEvent, RenderService, WebhookPayload, webhookMeta} from "./render";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    MessageActionRowComponentBuilder
} from "discord.js";

const app = express();
const port = process.env.PORT || 3001;
const renderWebhookSecret = process.env.RENDER_WEBHOOK_SECRET || '';
if (!renderWebhookSecret ) {
    console.error("Error: RENDER_WEBHOOK_SECRET is not set.");
    process.exit(1);
}


const renderAPIURL = process.env.RENDER_API_URL || "https://api.render.com/v1"

// To create a Render API key, follow instructions here: https://render.com/docs/api#1-create-an-api-key
const renderAPIKey = process.env.RENDER_API_KEY || '';
if (!renderAPIKey ) {
    console.error("Error: RENDER_API_KEY is not set.");
    process.exit(1);
}

const discordToken = process.env.DISCORD_TOKEN || '';
if (!discordToken ) {
    console.error("Error: DISCORD_TOKEN is not set.");
    process.exit(1);
}
const discordChannelID = process.env.DISCORD_CHANNEL_ID || '';
if (!discordChannelID ) {
    console.error("Error: DISCORD_CHANNEL_ID is not set.");
    process.exit(1);
}

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
    console.log(`Discord client setup! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
console.log(`Attempting Discord login (token length: ${discordToken.length})...`)

const loginTimeout = setTimeout(() => {
    console.error(`Discord login timed out after 30s — gateway WebSocket may be blocked`);
}, 30_000);

client.login(discordToken).then(() => {
    clearTimeout(loginTimeout);
    console.log(`Discord login promise resolved`);
}).catch(err => {
    clearTimeout(loginTimeout);
    console.error(`unable to connect to Discord: ${err}`);
});

client.on('error', err => {
    console.error(`Discord client error: ${err}`);
});
client.on('warn', msg => {
    console.warn(`Discord client warning: ${msg}`);
});
client.on('debug', msg => {
    // Only log gateway-related debug messages
    if (msg.includes('Gateway') || msg.includes('Shard') || msg.includes('WS')) {
        console.log(`[discord-debug] ${msg}`);
    }
});

app.get("/health", (req: Request, res: Response) => {
    res.json({ discordReady: client.isReady(), uptime: process.uptime() });
});

app.post("/webhook", express.raw({type: 'application/json'}), (req: Request, res: Response, next: NextFunction) => {
    try {
        validateWebhook(req);
    } catch (error) {
        return next(error)
    }

    const payload: WebhookPayload = JSON.parse(req.body)

    res.status(200).send({}).end()

    // handle the webhook async so we don't timeout the request
    handleWebhook(payload)
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    if (err instanceof WebhookVerificationError) {
        res.status(400).send({}).end()
    } else {
        res.status(500).send({}).end()
    }
});

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

function validateWebhook(req: Request) {
    const headers: WebhookUnbrandedRequiredHeaders = {
        "webhook-id": req.header("webhook-id") || "",
        "webhook-timestamp": req.header("webhook-timestamp") || "",
        "webhook-signature": req.header("webhook-signature") || ""
    }

    const wh = new Webhook(renderWebhookSecret);
    wh.verify(req.body, headers);
}

async function handleWebhook(payload: WebhookPayload) {
    try {
        let meta = webhookMeta[payload.type]
        if (!meta) {
            console.log(`unhandled webhook type ${payload.type} for service ${payload.data.serviceId}`)
            return
        }

        // Override emoji/color for deploy events based on status
        if (payload.type === "deploy_started") {
            meta = { ...meta, color: 0xf1c40f, emoji: "🟡" }
        } else if (payload.type === "deploy_ended") {
            const status = payload.data.status?.toLowerCase()
            if (status === "succeeded") {
                meta = { ...meta, color: 0x2ecc71, emoji: "🟢" }
            } else if (status === "failed" || status === "canceled") {
                meta = { ...meta, color: 0xe74c3c, emoji: "🔴" }
            }
        }

        let service: RenderService;
        try {
            service = await fetchServiceInfo(payload)
        } catch (error) {
            console.warn(`Could not fetch service info for ${payload.data.serviceId}: ${error}`);
            // Fallback to data in payload if API call fails
            service = {
                id: payload.data.serviceId,
                name: payload.data.serviceName || payload.data.serviceId,
                dashboardUrl: `https://dashboard.render.com` // Generic fallback
            }
        }

        const event = await fetchEventInfo(payload)

        // For deploy/build events, fetch deploy details for commit metadata
        let deploy: RenderDeploy | undefined
        const deployId = event.details?.deployId
        if (deployId && isDeployEvent(payload.type)) {
            try {
                deploy = await fetchDeployInfo(payload.data.serviceId, deployId)
                // TODO_REMOVE_LATER: Remove once deploy response shape is confirmed
                console.log(`Deploy info for ${deployId}:\n${JSON.stringify(deploy, null, 2)}`)
            } catch (error) {
                console.warn(`Could not fetch deploy info for ${deployId}: ${error}`)
            }
        }

        console.log(`sending discord message for ${service.name} (${payload.type})`)

        if (payload.type === "server_failed") {
            await sendServerFailedMessage(service, event.details.reason)
        } else {
            await sendGenericMessage(payload, service, event, meta, deploy)
        }
    } catch (error) {
        console.error(error)
    }
}

async function sendServerFailedMessage(service: RenderService, failureReason: any) {
    const channel = await client.channels.fetch(discordChannelID);
    if (!channel ){
        throw new Error(`unable to find specified Discord channel ${discordChannelID}`);
    }

    const isSendable = channel.isSendable()
    if (!isSendable) {
        throw new Error(`specified Discord channel ${discordChannelID} is not sendable`);
    }

    let description = "Failed for unknown reason"
    if (failureReason.nonZeroExit) {
        description = `Exited with status ${failureReason.nonZeroExit}`
    } else if (failureReason.oomKilled) {
        description = `Out of Memory`
    } else if (failureReason.timedOutSeconds) {
        description = `Timed out ` + failureReason.timedOutReason
    } else if (failureReason.unhealthy) {
        description = failureReason.unhealthy
    }

    const embed = new EmbedBuilder()
        .setColor(`#FF5C88`)
        .setTitle(`${service.name} Failed`)
        .setDescription(description)
        .setURL(service.dashboardUrl)

    const logs = new ButtonBuilder()
        .setLabel("View Logs")
        .setURL(`${service.dashboardUrl}/logs`)
        .setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
        .addComponents(logs);

    await channel.send({embeds: [embed], components: [row]})
    console.log(`discord message sent successfully to channel ${discordChannelID}`)
}

async function sendGenericMessage(
    payload: WebhookPayload,
    service: RenderService,
    event: RenderEvent,
    meta: { color: number; label: string; emoji: string },
    deploy?: RenderDeploy,
) {
    if (!client.isReady()) {
        throw new Error(`Discord client is not ready (isReady=false). Cannot send message.`);
    }
    const channel = await client.channels.fetch(discordChannelID);
    if (!channel) {
        throw new Error(`unable to find specified Discord channel ${discordChannelID}`);
    }
    if (!channel.isSendable()) {
        throw new Error(`specified Discord channel ${discordChannelID} is not sendable`);
    }

    console.log(`[debug] channel fetched, building embed`)
    const description = buildDescription(payload, event)

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.emoji} ${service.name} — ${meta.label}`)
        .setDescription(description)
        .setURL(service.dashboardUrl)
        .setTimestamp(new Date(payload.timestamp))

    // Add deploy metadata fields when available
    if (deploy) {
        if (deploy.commit?.message) {
            // First line of commit message (often the PR title)
            const commitTitle = deploy.commit.message.split("\n")[0].substring(0, 256)
            embed.addFields({ name: "Commit", value: commitTitle })
        }
        if (deploy.commit?.id) {
            const shortSha = deploy.commit.id.substring(0, 7)
            embed.addFields({ name: "SHA", value: `\`${shortSha}\``, inline: true })
        }
        if (deploy.branch) {
            embed.addFields({ name: "Branch", value: `\`${deploy.branch}\``, inline: true })
        }
        if (deploy.trigger) {
            embed.addFields({ name: "Trigger", value: deploy.trigger, inline: true })
        }
        if (deploy.imageUrl) {
            embed.addFields({ name: "Image", value: `\`${deploy.imageUrl}\`` })
        }
    }

    const logs = new ButtonBuilder()
        .setLabel("View Logs")
        .setURL(`${service.dashboardUrl}/logs`)
        .setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
        .addComponents(logs);

    console.log(`[debug] sending to Discord...`)
    await channel.send({embeds: [embed], components: [row]})
    console.log(`discord message sent successfully to channel ${discordChannelID}`)
}


function buildDescription(payload: WebhookPayload, event: RenderEvent): string {
    const parts: string[] = []

    // Include status when present (build_ended, deploy_ended, etc.)
    if (payload.data.status) {
        parts.push(`**Status:** ${payload.data.status.toUpperCase()}`)
    }

    const d = event.details || {}

    // Scaling details
    if (d.fromInstances !== undefined && d.toInstances !== undefined) {
        parts.push(`Scaled from **${d.fromInstances}** → **${d.toInstances}** instances`)
    }

    // Postgres / Disk scaling
    if (d.fromSizeGB !== undefined && d.toSizeGB !== undefined) {
        parts.push(`Size changed from **${d.fromSizeGB}GB** → **${d.toSizeGB}GB**`)
    }

    // Maintenance / Upgrade details
    if (d.version) {
        parts.push(`**Version:** ${d.version}`)
    }

    // Failure reason (for events other than server_failed which has its own handler)
    if (d.reason) {
        if (typeof d.reason === "string") {
            parts.push(`**Reason:** ${d.reason}`)
        } else if (d.reason.nonZeroExit) {
            parts.push(`**Reason:** Exited with status ${d.reason.nonZeroExit}`)
        } else if (d.reason.oomKilled) {
            parts.push(`**Reason:** Out of Memory`)
        } else if (d.reason.timedOutSeconds) {
            parts.push(`**Reason:** Timed out (${d.reason.timedOutReason || d.reason.timedOutSeconds + "s"})`)
        }
    }

    if (parts.length === 0) {
        // Fallback for events with no specific details handled yet
        if (payload.type.includes("started")) parts.push("_Started_")
        if (payload.type.includes("ended")) parts.push("_Ended_")
        if (payload.type.includes("available")) parts.push("_Available_")
        if (payload.type.includes("failed")) parts.push("_Failed_")
    }

    return parts.length > 0 ? parts.join("\n") : `Event received for ${payload.data.serviceId}`
}

// fetchEventInfo fetches the event that triggered the webhook
// some events have additional information that isn't in the webhook payload
// for example, deploy events have the deploy id
async function fetchEventInfo(payload: WebhookPayload): Promise<RenderEvent> {
    const res = await fetch(
        `${renderAPIURL}/events/${payload.data.id}`,
        {
            method: "get",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${renderAPIKey}`,
            },
        },
    )
    if (res.ok) {
        return res.json()
    } else {
        throw new Error(`unable to fetch event info; received code :${res.status.toString()}`)
    }
}

async function fetchServiceInfo(payload: WebhookPayload): Promise<RenderService> {
    const id = payload.data.serviceId;
    let endpoint = "services";
    if (id.startsWith("pg-")) {
        endpoint = "postgres";
    } else if (id.startsWith("kv-")) {
        endpoint = "key-values";
    }

    const res = await fetch(
        `${renderAPIURL}/${endpoint}/${id}`,
        {
            method: "get",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${renderAPIKey}`,
            },
        },
    )
    if (res.ok) {
        return res.json()
    } else {
        throw new Error(`unable to fetch service info for ${id}; received code :${res.status.toString()}`)
    }
}


const DEPLOY_EVENT_TYPES = new Set([
    "deploy_started", "deploy_ended",
    "build_started", "build_ended",
    "pre_deploy_started", "pre_deploy_ended",
])

function isDeployEvent(type: string): boolean {
    return DEPLOY_EVENT_TYPES.has(type)
}

async function fetchDeployInfo(serviceId: string, deployId: string): Promise<RenderDeploy> {
    const res = await fetch(
        `${renderAPIURL}/services/${serviceId}/deploys/${deployId}`,
        {
            method: "get",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${renderAPIKey}`,
            },
        },
    )
    if (res.ok) {
        return res.json()
    } else {
        throw new Error(`unable to fetch deploy info for ${deployId}; received code: ${res.status}`)
    }
}

process.on('SIGTERM', () => {
    console.debug('SIGTERM signal received: closing HTTP server')
    server.close(() => {
        console.debug('HTTP server closed')
    })
})
