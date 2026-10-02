CREATE TABLE `push_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`endpoint` varchar(2048) NOT NULL,
	`p256dh` varchar(256) NOT NULL,
	`auth` varchar(128) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_devices_endpoint_unique` UNIQUE(`endpoint`)
);
--> statement-breakpoint
CREATE TABLE `push_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`dedupeKey` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`targetUrl` varchar(512) NOT NULL,
	`fireAt` timestamp NOT NULL,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskUid` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `push_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_schedules_taskUid_unique` UNIQUE(`taskUid`)
);
--> statement-breakpoint
CREATE INDEX `push_reminders_due_idx` ON `push_reminders` (`fireAt`,`sentAt`);--> statement-breakpoint
CREATE INDEX `push_reminders_device_idx` ON `push_reminders` (`deviceId`);--> statement-breakpoint
CREATE INDEX `push_reminders_dedupe_idx` ON `push_reminders` (`deviceId`,`dedupeKey`);