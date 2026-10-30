CREATE TABLE `projects` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`name` varchar(80) NOT NULL,
	`type` enum('draft','template') NOT NULL DEFAULT 'draft',
	`canvas_json` json NOT NULL,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(32) NOT NULL,
	`email` varchar(190) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`display_name` varchar(60) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `projects_user_type_updated_idx` ON `projects` (`user_id`,`type`,`updated_at`);--> statement-breakpoint
CREATE INDEX `projects_user_updated_idx` ON `projects` (`user_id`,`updated_at`);