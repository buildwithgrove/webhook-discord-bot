# Grove Webhook Discord Bot <!-- omit in toc -->

Sends Discord notifications for [Render webhook events](https://render.com/docs/webhooks) via [Grove's Discord Bot](https://discord.com/developers/applications/1483579696548548748/information).

Built on top of the [Render Webhook Discord Bot template](https://render.com/templates/webhook-discord-bot). Grove's webhook is configured [here](https://dashboard.render.com/webhook/whk-d6ssrpua2pns738ei740).

- [Supported Webhook Events](#supported-webhook-events)
- [Adding a New Webhook Event](#adding-a-new-webhook-event)
- [Prerequisites](#prerequisites)
- [Deploy to Render](#deploy-to-render)
- [Developing](#developing)
- [Building](#building)

## Supported Webhook Events

| Category | Events |
|---|---|
| **Deploy Lifecycle** | `build_started`, `build_ended`, `deploy_started`, `deploy_ended`, `pre_deploy_started`, `pre_deploy_ended`, `image_pull_failed`, `commit_ignored`, `branch_deleted` |
| **Service Availability** | `server_available`, `server_failed`, `server_hardware_failure`, `server_restarted`, `service_suspended`, `service_resumed` |
| **Scaling** | `instance_count_changed`, `autoscaling_started`, `autoscaling_ended`, `autoscaling_config_changed` |
| **Jobs / Cron** | `job_run_ended`, `cron_job_run_started`, `cron_job_run_ended` |
| **Config** | `plan_changed` |
| **Maintenance** | `maintenance_started`, `maintenance_ended`, `maintenance_mode_enabled`, `maintenance_mode_uri_updated` |
| **Zero Downtime Redeploy** | `zero_downtime_redeploy_started`, `zero_downtime_redeploy_ended` |
| **Render Postgres** | `postgres_available`, `postgres_unavailable`, `postgres_restarted`, `postgres_created`, `postgres_backup_started`, `postgres_backup_completed`, `postgres_backup_failed`, `postgres_cluster_leader_changed`, `postgres_credentials_created`, `postgres_credentials_deleted`, `postgres_disk_size_changed`, `postgres_disk_autoscaling_enabled_changed`, `postgres_ha_status_changed`, `postgres_pitr_checkpoint_started`, `postgres_pitr_checkpoint_completed`, `postgres_pitr_checkpoint_failed`, `postgres_restore_succeeded`, `postgres_restore_failed`, `postgres_upgrade_started`, `postgres_upgrade_succeeded`, `postgres_upgrade_failed`, `postgres_read_replica_stale`, `postgres_read_replicas_changed`, `postgres_wal_archive_failed` |
| **Render Key Value** | `key_value_available`, `key_value_config_restart`, `key_value_unhealthy` |
| **Persistent Disks** | `disk_created`, `disk_updated`, `disk_deleted` |
| **Other** | `pipeline_minutes_exhausted` |

Unrecognized event types are logged and ignored.

## Adding a New Webhook Event

Add a single entry to the `webhookMeta` map in `render.ts`:

```ts
export const webhookMeta = {
    // ...existing entries
    new_event_type: { color: 0x3498DB, label: "New Event", emoji: "🆕" },
}
```

The generic handler in `app.ts` picks it up automatically — no other changes needed unless the event requires custom formatting (see `server_failed` for an example).

## Discord Bot Permissions

The bot is managed via the [Discord Developer Portal](https://discord.com/developers/applications/1483579696548548748/information).

**Required OAuth2 settings:**

- **Scope:** `bot`
- **Permissions:** `SendMessages` and `ViewChannels`
- **Requires OAuth2 Code Grant:** Leave **disabled** — this is only needed for apps that use user OAuth2 tokens (e.g., "Login with Discord"). This bot only needs the bot token.

**If the bot gets a `Missing Access` (50001) error:**

1. Verify the bot's role has `View Channel` and `Send Messages` in the target channel's permission settings
2. If the channel was deleted/recreated, update `DISCORD_CHANNEL_ID` with the new channel ID
3. Re-invite the bot using the install link from **OAuth2 > Installation** in the Developer Portal

## Prerequisites

- [Sign up for a Render account](https://dashboard.render.com/register) (Professional plan or higher required for [webhooks](https://render.com/docs/webhooks))
- [View and upgrade your plan](https://dashboard.render.com/billing/update-plan) in the Render Dashboard

## Deploy to Render

1. Use the button below to deploy to Render </br>
<a href="https://render.com/deploy?repo=https://github.com/buildwithgrove/webhook-discord-bot/tree/main"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render"></a>

2. Follow [Render webhook instructions](https://render.com/docs/webhooks) to create a webhook with the URL: `https://webhook-discord-bot-ruv6-ruv6.onrender.com/webhook`
3. Follow [instructions](https://render.com/docs/api#1-create-an-api-key) to create a Render API Key
4. Follow [instructions](https://discord.com/developers/docs/quick-start/getting-started#step-1-creating-an-app) to create a Discord App and copy the token
5. Navigate to the installation settings for your app and
   - add `bot` scope
   - add `SendMessages` and `ViewChannels` permissions
6. Set the following env vars
    - `RENDER_WEBHOOK_SECRET` environment variable to the secret from the webhook created in step 2
    - `RENDER_API_KEY` to the key created in step 3
    - `DISCORD_TOKEN` to the token created in step 4
    - `DISCORD_CHANNEL_ID` to the channel id you want messages sent to

## Developing

Once you've created a project and installed dependencies with `pnpm install`, start a development server:

```bash
pnpm run dev
```

## Building

```bash
pnpm run build
```
