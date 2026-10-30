ALTER TABLE `datasets` ADD `kind` varchar(16) DEFAULT 'file' NOT NULL;--> statement-breakpoint
ALTER TABLE `datasets` ADD `source_url` varchar(600);--> statement-breakpoint
ALTER TABLE `datasets` ADD `refresh_seconds` int unsigned DEFAULT 0 NOT NULL;