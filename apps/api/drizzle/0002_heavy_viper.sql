CREATE TABLE `datasets` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`name` varchar(120) NOT NULL,
	`file_name` varchar(190) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size` int unsigned NOT NULL,
	`row_count` int unsigned NOT NULL,
	`columns_json` json NOT NULL,
	`preview_json` json NOT NULL,
	`storage_path` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `datasets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `datasets` ADD CONSTRAINT `datasets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `datasets_user_created_idx` ON `datasets` (`user_id`,`created_at`);