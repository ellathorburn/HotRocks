CREATE TABLE `profiles` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL UNIQUE,
	`temperature_unit` text NOT NULL,
	`timezone_name` text NOT NULL,
	`default_strava_sport_type` text NOT NULL,
	`default_post_to_strava` integer NOT NULL,
	`strava_description_template` text NOT NULL,
	`onboarding_completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `round_parts` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`session_id` text NOT NULL,
	`round_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`temperature_c_tenths` integer,
	`started_at` text,
	`ended_at` text,
	CONSTRAINT `fk_round_parts_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_round_parts_round_id_rounds_id_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON DELETE CASCADE,
	CONSTRAINT "round_parts_positive_duration" CHECK("duration_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `fk_rounds_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session_drafts` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_photos` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`session_id` text NOT NULL,
	`storage_path` text NOT NULL,
	`thumbnail_path` text,
	`local_uri` text,
	`position` integer NOT NULL,
	`width` integer,
	`height` integer,
	`uploaded_at` text,
	`deleted_at` text,
	CONSTRAINT `fk_session_photos_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`venue_id` text,
	`venue_name_snapshot` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`timezone_name` text NOT NULL,
	`elapsed_seconds` integer NOT NULL,
	`heat_seconds` integer DEFAULT 0 NOT NULL,
	`cold_seconds` integer DEFAULT 0 NOT NULL,
	`round_count` integer NOT NULL,
	`rating` integer,
	`note` text,
	`entry_method` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT `fk_sessions_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`),
	CONSTRAINT "sessions_positive_elapsed" CHECK("elapsed_seconds" > 0),
	CONSTRAINT "sessions_elapsed_covers_parts" CHECK("elapsed_seconds" >= "heat_seconds" + "cold_seconds"),
	CONSTRAINT "sessions_positive_round_count" CHECK("round_count" > 0)
);
--> statement-breakpoint
CREATE TABLE `strava_exports` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`session_id` text NOT NULL UNIQUE,
	`requested_action` text NOT NULL,
	`status` text NOT NULL,
	`strava_activity_id` integer,
	`payload_snapshot` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`last_error_code` text,
	`posted_at` text,
	CONSTRAINT `fk_strava_exports_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sync_outbox` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`user_id` text PRIMARY KEY,
	`pull_cursor` text,
	`last_synced_at` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`last_used_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `round_parts_session_idx` ON `round_parts` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `round_parts_round_position_idx` ON `round_parts` (`round_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `round_parts_round_kind_idx` ON `round_parts` (`round_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `rounds_session_position_idx` ON `rounds` (`session_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_photos_position_idx` ON `session_photos` (`session_id`,`position`);--> statement-breakpoint
CREATE INDEX `sessions_user_started_idx` ON `sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `sessions_venue_idx` ON `sessions` (`venue_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sync_outbox_aggregate_idx` ON `sync_outbox` (`user_id`,`aggregate_type`,`aggregate_id`);--> statement-breakpoint
CREATE INDEX `sync_outbox_pending_idx` ON `sync_outbox` (`user_id`,`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `venues_user_recent_idx` ON `venues` (`user_id`,`last_used_at`);