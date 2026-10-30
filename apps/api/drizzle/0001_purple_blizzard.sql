CREATE TABLE `email_verification_codes` (
	`id` varchar(32) NOT NULL,
	`email` varchar(190) NOT NULL,
	`salt` varchar(32) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`purpose` enum('register') NOT NULL DEFAULT 'register',
	`attempts` int unsigned NOT NULL DEFAULT 0,
	`consumed_at` timestamp,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_verification_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`user_agent` varchar(255),
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `email_codes_email_idx` ON `email_verification_codes` (`email`,`purpose`,`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);