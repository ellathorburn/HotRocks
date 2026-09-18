-- Entries now last at least 30 seconds. Sessions and drafts saved during
-- testing with shorter entries are removed before the constraint is added, so
-- the copy into the rebuilt table cannot fail. The matching Supabase
-- migration removes the same sessions on the server.
DELETE FROM `sync_outbox`
WHERE `aggregate_type` = 'session'
	AND `aggregate_id` IN (
		SELECT `session_id` FROM `session_intervals` WHERE `duration_seconds` < 30
	);--> statement-breakpoint
DELETE FROM `sessions`
WHERE `id` IN (
	SELECT `session_id` FROM `session_intervals` WHERE `duration_seconds` < 30
);--> statement-breakpoint
DELETE FROM `session_drafts`
WHERE EXISTS (
	SELECT 1 FROM json_each(`payload_json`, '$.intervals')
	WHERE json_extract(value, '$.durationSeconds') < 30
);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_intervals` (
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
	CONSTRAINT "session_intervals_min_duration" CHECK("duration_seconds" >= 30),
	CONSTRAINT "session_intervals_rest_has_no_temperature" CHECK("kind" <> 'rest' OR "temperature_c_tenths" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_session_intervals`(`id`, `user_id`, `created_at`, `updated_at`, `session_id`, `position`, `kind`, `duration_seconds`, `temperature_c_tenths`, `started_at`, `ended_at`) SELECT `id`, `user_id`, `created_at`, `updated_at`, `session_id`, `position`, `kind`, `duration_seconds`, `temperature_c_tenths`, `started_at`, `ended_at` FROM `session_intervals`;--> statement-breakpoint
DROP TABLE `session_intervals`;--> statement-breakpoint
ALTER TABLE `__new_session_intervals` RENAME TO `session_intervals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `session_intervals_session_idx` ON `session_intervals` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_intervals_user_idx` ON `session_intervals` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_intervals_session_position_idx` ON `session_intervals` (`session_id`,`position`);