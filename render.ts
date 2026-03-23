interface WebhookData {
  id: string;
  serviceId: string;
  serviceName?: string;
  status?: string;
}

export interface WebhookPayload {
  type: string;
  timestamp: Date;
  data: WebhookData;
}

export interface RenderService {
  id: string;
  name: string;
  dashboardUrl: string;
}

export interface RenderEvent {
  id: string;
  type: string;
  details: any;
}

export interface RenderCommit {
  id: string;
  message: string;
  createdAt: string;
}

export interface RenderDeploy {
  id: string;
  commit?: RenderCommit;
  branch?: string;
  trigger?: string;
  status?: string;
  createdAt?: string;
  finishedAt?: string;
  imageUrl?: string;
}

// Maps webhook types to Discord embed color and label
export const webhookMeta: Record<
  string,
  { color: number; label: string; emoji: string }
> = {
  // Deploy lifecycle
  build_started: { color: 0x3498db, label: "Build Started", emoji: "🔨" },
  build_ended: { color: 0x3498db, label: "Build Ended", emoji: "🔨" },
  deploy_started: { color: 0x3498db, label: "Deploy Started", emoji: "🚀" },
  deploy_ended: { color: 0x3498db, label: "Deploy Ended", emoji: "🚀" },
  pre_deploy_started: {
    color: 0x9b59b6,
    label: "Pre-Deploy Started",
    emoji: "⏳",
  },
  pre_deploy_ended: { color: 0x9b59b6, label: "Pre-Deploy Ended", emoji: "⏳" },
  image_pull_failed: {
    color: 0xff5c88,
    label: "Image Pull Failed",
    emoji: "❌",
  },
  commit_ignored: { color: 0x95a5a6, label: "Commit Ignored", emoji: "⏭️" },
  branch_deleted: { color: 0x95a5a6, label: "Branch Deleted", emoji: "🗑️" },

  // Service availability
  server_available: { color: 0x2ecc71, label: "Server Available", emoji: "✅" },
  server_failed: { color: 0xff5c88, label: "Server Failed", emoji: "💥" },
  server_hardware_failure: {
    color: 0xff0000,
    label: "Hardware Failure",
    emoji: "🔥",
  },
  server_restarted: { color: 0xf39c12, label: "Server Restarted", emoji: "🔄" },
  service_suspended: {
    color: 0xe74c3c,
    label: "Service Suspended",
    emoji: "⛔",
  },
  service_resumed: { color: 0x2ecc71, label: "Service Resumed", emoji: "▶️" },

  // Scaling
  instance_count_changed: {
    color: 0x1abc9c,
    label: "Instance Count Changed",
    emoji: "📊",
  },
  autoscaling_started: {
    color: 0x1abc9c,
    label: "Autoscaling Started",
    emoji: "📈",
  },
  autoscaling_ended: {
    color: 0x1abc9c,
    label: "Autoscaling Ended",
    emoji: "📉",
  },
  autoscaling_config_changed: {
    color: 0x1abc9c,
    label: "Autoscaling Config Changed",
    emoji: "⚙️",
  },

  // Job
  job_run_ended: { color: 0x9b59b6, label: "Job Run Ended", emoji: "🏃" },

  // Cron
  cron_job_run_started: {
    color: 0x9b59b6,
    label: "Cron Job Started",
    emoji: "⏰",
  },
  cron_job_run_ended: { color: 0x9b59b6, label: "Cron Job Ended", emoji: "⏰" },

  // Config
  plan_changed: { color: 0xf39c12, label: "Plan Changed", emoji: "💰" },

  // Maintenance
  maintenance_started: {
    color: 0xf39c12,
    label: "Maintenance Started",
    emoji: "🔧",
  },
  maintenance_ended: {
    color: 0x2ecc71,
    label: "Maintenance Ended",
    emoji: "🔧",
  },
  maintenance_mode_enabled: {
    color: 0xf39c12,
    label: "Maintenance Mode Enabled",
    emoji: "🚧",
  },
  maintenance_mode_uri_updated: {
    color: 0xf39c12,
    label: "Maintenance Mode URI Updated",
    emoji: "🔗",
  },

  // Redeploy
  zero_downtime_redeploy_started: {
    color: 0x3498db,
    label: "Zero Downtime Redeploy Started",
    emoji: "🔄",
  },
  zero_downtime_redeploy_ended: {
    color: 0x3498db,
    label: "Zero Downtime Redeploy Ended",
    emoji: "🔄",
  },

  // Render Postgres
  postgres_available: {
    color: 0x2ecc71,
    label: "Postgres Available",
    emoji: "🐘✅",
  },
  postgres_backup_completed: {
    color: 0x2ecc71,
    label: "Postgres Backup Completed",
    emoji: "💾✅",
  },
  postgres_backup_failed: {
    color: 0xe74c3c,
    label: "Postgres Backup Failed",
    emoji: "💾❌",
  },
  postgres_backup_started: {
    color: 0x3498db,
    label: "Postgres Backup Started",
    emoji: "💾⏳",
  },
  postgres_cluster_leader_changed: {
    color: 0xf39c12,
    label: "Postgres Leader Changed",
    emoji: "👑",
  },
  postgres_created: {
    color: 0x2ecc71,
    label: "Postgres Created",
    emoji: "🐘✨",
  },
  postgres_credentials_created: {
    color: 0x2ecc71,
    label: "Postgres Credentials Created",
    emoji: "🔑",
  },
  postgres_credentials_deleted: {
    color: 0x95a5a6,
    label: "Postgres Credentials Deleted",
    emoji: "🔑🗑️",
  },
  postgres_disk_size_changed: {
    color: 0xf39c12,
    label: "Postgres Disk Size Changed",
    emoji: "💾📊",
  },
  postgres_ha_status_changed: {
    color: 0xf39c12,
    label: "Postgres HA Status Changed",
    emoji: "🛡️",
  },
  postgres_pitr_checkpoint_completed: {
    color: 0x2ecc71,
    label: "Postgres PITR Checkpoint Completed",
    emoji: "🕒✅",
  },
  postgres_pitr_checkpoint_failed: {
    color: 0xe74c3c,
    label: "Postgres PITR Checkpoint Failed",
    emoji: "🕒❌",
  },
  postgres_pitr_checkpoint_started: {
    color: 0x3498db,
    label: "Postgres PITR Checkpoint Started",
    emoji: "🕒⏳",
  },
  postgres_restarted: {
    color: 0xf39c12,
    label: "Postgres Restarted",
    emoji: "🐘🔄",
  },
  postgres_restore_failed: {
    color: 0xe74c3c,
    label: "Postgres Restore Failed",
    emoji: "🕒❌",
  },
  postgres_restore_succeeded: {
    color: 0x2ecc71,
    label: "Postgres Restore Succeeded",
    emoji: "🕒✅",
  },
  postgres_unavailable: {
    color: 0xe74c3c,
    label: "Postgres Unavailable",
    emoji: "🐘❌",
  },
  postgres_upgrade_failed: {
    color: 0xe74c3c,
    label: "Postgres Upgrade Failed",
    emoji: "🐘🆙❌",
  },
  postgres_upgrade_started: {
    color: 0x3498db,
    label: "Postgres Upgrade Started",
    emoji: "🐘🆙⏳",
  },
  postgres_upgrade_succeeded: {
    color: 0x2ecc71,
    label: "Postgres Upgrade Succeeded",
    emoji: "🐘🆙✅",
  },
  postgres_read_replica_stale: {
    color: 0xf39c12,
    label: "Postgres Read Replica Stale",
    emoji: "🐘🕰️",
  },
  postgres_read_replicas_changed: {
    color: 0xf39c12,
    label: "Postgres Read Replicas Changed",
    emoji: "🐘👥",
  },
  postgres_wal_archive_failed: {
    color: 0xe74c3c,
    label: "Postgres WAL Archive Failed",
    emoji: "📦❌",
  },
  postgres_disk_autoscaling_enabled_changed: {
    color: 0xf39c12,
    label: "Postgres Disk Autoscaling Changed",
    emoji: "💾⚙️",
  },

  // Render Key Value
  key_value_available: {
    color: 0x2ecc71,
    label: "Key Value Available",
    emoji: "🔑✅",
  },
  key_value_config_restart: {
    color: 0xf39c12,
    label: "Key Value Restarted",
    emoji: "🔑🔄",
  },
  key_value_unhealthy: {
    color: 0xe74c3c,
    label: "Key Value Unhealthy",
    emoji: "🔑⚠️",
  },

  // Persistent disks
  disk_created: { color: 0x2ecc71, label: "Disk Created", emoji: "💾✨" },
  disk_updated: { color: 0xf39c12, label: "Disk Updated", emoji: "💾📝" },
  disk_deleted: { color: 0x95a5a6, label: "Disk Deleted", emoji: "💾🗑️" },

  // Other
  pipeline_minutes_exhausted: {
    color: 0xe74c3c,
    label: "Pipeline Minutes Exhausted",
    emoji: "📉",
  },
};
