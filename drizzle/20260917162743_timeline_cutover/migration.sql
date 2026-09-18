-- Timeline cutover: convert round parts into ordered session intervals, then
-- remove the round tables and the round_count column.
--
-- Expo migrations run inside one transaction with foreign keys enabled, where
-- `PRAGMA foreign_keys=OFF` is a no-op. Rebuilding `sessions` therefore
-- cascades deletes to every child table, so children are copied aside first
-- and restored after the rebuild.
INSERT INTO `session_intervals` (
	`id`, `user_id`, `created_at`, `updated_at`, `session_id`, `position`,
	`kind`, `duration_seconds`, `temperature_c_tenths`, `started_at`, `ended_at`
)
SELECT
	rp.`id`, rp.`user_id`, rp.`created_at`, rp.`updated_at`, rp.`session_id`,
	ROW_NUMBER() OVER (PARTITION BY rp.`session_id` ORDER BY r.`position`, rp.`position`) - 1,
	rp.`kind`, rp.`duration_seconds`, rp.`temperature_c_tenths`, rp.`started_at`, rp.`ended_at`
FROM `round_parts` rp
INNER JOIN `rounds` r ON r.`id` = rp.`round_id`
WHERE NOT EXISTS (
	SELECT 1 FROM `session_intervals` si WHERE si.`session_id` = rp.`session_id`
);--> statement-breakpoint
UPDATE `sessions`
SET `interval_count` = (
	SELECT count(*) FROM `session_intervals` si WHERE si.`session_id` = `sessions`.`id`
)
WHERE `interval_count` = 0;--> statement-breakpoint
DELETE FROM `session_drafts` WHERE json_extract(`payload_json`, '$.schemaVersion') = 1;--> statement-breakpoint
CREATE TABLE `__backup_session_intervals` AS SELECT * FROM `session_intervals`;--> statement-breakpoint
CREATE TABLE `__backup_session_photos` AS SELECT * FROM `session_photos`;--> statement-breakpoint
CREATE TABLE `__backup_strava_exports` AS SELECT * FROM `strava_exports`;--> statement-breakpoint
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
	`rating` integer,
	`note` text,
	`entry_method` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `fk_sessions_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`),
	CONSTRAINT "sessions_positive_elapsed" CHECK("elapsed_seconds" > 0),
	CONSTRAINT "sessions_elapsed_covers_intervals" CHECK("elapsed_seconds" >= "heat_seconds" + "cold_seconds" + "rest_seconds"),
	CONSTRAINT "sessions_non_negative_rest" CHECK("rest_seconds" >= 0),
	CONSTRAINT "sessions_non_negative_interval_count" CHECK("interval_count" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_sessions`(`id`, `user_id`, `created_at`, `updated_at`, `venue_id`, `venue_name_snapshot`, `started_at`, `ended_at`, `timezone_name`, `elapsed_seconds`, `heat_seconds`, `cold_seconds`, `rest_seconds`, `interval_count`, `rating`, `note`, `entry_method`, `revision`, `deleted_at`) SELECT `id`, `user_id`, `created_at`, `updated_at`, `venue_id`, `venue_name_snapshot`, `started_at`, `ended_at`, `timezone_name`, `elapsed_seconds`, `heat_seconds`, `cold_seconds`, `rest_seconds`, `interval_count`, `rating`, `note`, `entry_method`, `revision`, `deleted_at` FROM `sessions`;--> statement-breakpoint
DROP TABLE `round_parts`;--> statement-breakpoint
DROP TABLE `rounds`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sessions_user_started_idx` ON `sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `sessions_venue_idx` ON `sessions` (`venue_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `session_intervals` SELECT * FROM `__backup_session_intervals`;--> statement-breakpoint
INSERT OR IGNORE INTO `session_photos` SELECT * FROM `__backup_session_photos`;--> statement-breakpoint
INSERT OR IGNORE INTO `strava_exports` SELECT * FROM `__backup_strava_exports`;--> statement-breakpoint
DROP TABLE `__backup_session_intervals`;--> statement-breakpoint
DROP TABLE `__backup_session_photos`;--> statement-breakpoint
DROP TABLE `__backup_strava_exports`;
