CREATE TABLE `ai_rate_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`surface` enum('lesson','assistant','learning_draft') NOT NULL,
	`minuteBucket` int NOT NULL,
	`minuteCount` int NOT NULL DEFAULT 0,
	`dayKey` varchar(16) NOT NULL,
	`dayCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_rate_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_rate_limits_owner_surface_unique` UNIQUE(`openId`,`surface`)
);
