CREATE TABLE `push_delivery_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`reminderId` int,
	`kind` enum('reminder','test') NOT NULL,
	`status` enum('accepted','failed','expired') NOT NULL,
	`responseCode` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_delivery_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `push_delivery_history_device_created_idx` ON `push_delivery_history` (`deviceId`,`createdAt`);