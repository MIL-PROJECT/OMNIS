CREATE TABLE `ai_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`feature` text NOT NULL,
	`input_summary` text NOT NULL,
	`output_summary` text NOT NULL,
	`confidence` real,
	`fallback_used` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `communication_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`status` text NOT NULL,
	`uptime_pct` real NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `communication_systems` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`uptime_pct` real NOT NULL,
	`today_incident_count` integer NOT NULL,
	`remarks` text,
	`display_order` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `communication_systems_code_unique` ON `communication_systems` (`code`);--> statement-breakpoint
CREATE TABLE `directives` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`issuer` text NOT NULL,
	`issued_at` text NOT NULL,
	`expires_at` text,
	`pinned` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `duty_roster` (
	`id` text PRIMARY KEY NOT NULL,
	`duty_date` text NOT NULL,
	`shift_type` text NOT NULL,
	`user_id` text NOT NULL,
	`position` text NOT NULL,
	`start_time` text,
	`end_time` text
);
--> statement-breakpoint
CREATE TABLE `incident_events` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`note` text,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_no` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`system_id` text,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`description` text NOT NULL,
	`reported_by` text NOT NULL,
	`assigned_to` text,
	`department` text,
	`reported_at` text NOT NULL,
	`assigned_at` text,
	`started_at` text,
	`resolved_at` text,
	`closed_at` text,
	`cause` text,
	`action_summary` text,
	`ai_category` text,
	`ai_priority` text,
	`ai_confidence` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incidents_ticket_no_unique` ON `incidents` (`ticket_no`);--> statement-breakpoint
CREATE TABLE `maintenance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`event_type` text NOT NULL,
	`note` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `maintenance_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_no` text NOT NULL,
	`title` text NOT NULL,
	`maintenance_type` text NOT NULL,
	`priority` text NOT NULL,
	`system_id` text,
	`status` text NOT NULL,
	`department` text NOT NULL,
	`assignee_id` text,
	`scheduled_date` text NOT NULL,
	`due_date` text,
	`started_at` text,
	`completed_at` text,
	`progress` integer NOT NULL,
	`description` text,
	`result` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `maintenance_tasks_task_no_unique` ON `maintenance_tasks` (`task_no`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`rank_name` text,
	`unit_name` text,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`active` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);