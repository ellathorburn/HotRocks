CREATE TABLE `session_intervals` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`temperature_c_tenths` integer,
	`started_at` text,
	`ended_at` text,
	CONSTRAINT `fk_session_intervals_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
	CONSTRAINT "session_intervals_non_negative_position" CHECK("position" >= 0),
	CONSTRAINT "session_intervals_positive_duration" CHECK("duration_seconds" > 0),
	CONSTRAINT "session_intervals_rest_has_no_temperature" CHECK("kind" <> 'rest' OR "temperature_c_tenths" IS NULL)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `rest_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `interval_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
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
	`rest_seconds` integer DEFAULT 0 NOT NULL,
	`interval_count` integer DEFAULT 0 NOT NULL,
	`round_count` integer NOT NULL,
	`rating` integer,
	`note` text,
	`entry_method` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `fk_sessions_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`),
	CONSTRAINT "sessions_positive_elapsed" CHECK("elapsed_seconds" > 0),
	CONSTRAINT "sessions_elapsed_covers_parts" CHECK("elapsed_seconds" >= "heat_seconds" + "cold_seconds"),
	CONSTRAINT "sessions_non_negative_rest" CHECK("rest_seconds" >= 0),
	CONSTRAINT "sessions_non_negative_interval_count" CHECK("interval_count" >= 0),
	CONSTRAINT "sessions_positive_round_count" CHECK("round_count" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_sessions`(`id`, `user_id`, `created_at`, `updated_at`, `venue_id`, `venue_name_snapshot`, `started_at`, `ended_at`, `timezone_name`, `elapsed_seconds`, `heat_seconds`, `cold_seconds`, `round_count`, `rating`, `note`, `entry_method`, `revision`, `deleted_at`) SELECT `id`, `user_id`, `created_at`, `updated_at`, `venue_id`, `venue_name_snapshot`, `started_at`, `ended_at`, `timezone_name`, `elapsed_seconds`, `heat_seconds`, `cold_seconds`, `round_count`, `rating`, `note`, `entry_method`, `revision`, `deleted_at` FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sessions_user_started_idx` ON `sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `sessions_venue_idx` ON `sessions` (`venue_id`);--> statement-breakpoint
CREATE INDEX `session_intervals_session_idx` ON `session_intervals` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_intervals_user_idx` ON `session_intervals` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_intervals_session_position_idx` ON `session_intervals` (`session_id`,`position`);