ALTER TABLE `push_reminders` ADD `deliveryAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `push_reminders` ADD `nextAttemptAt` timestamp;--> statement-breakpoint
ALTER TABLE `push_reminders` ADD `retiredAt` timestamp;--> statement-breakpoint
CREATE INDEX `push_reminders_retry_idx` ON `push_reminders` (`nextAttemptAt`,`sentAt`,`retiredAt`);