CREATE TABLE `material_storage_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`fileCount` int NOT NULL DEFAULT 0,
	`storedBytes` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_storage_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `material_storage_usage_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `material_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`contentSha256` varchar(64) NOT NULL,
	`storageKey` varchar(1024) CHARACTER SET ascii COLLATE ascii_bin,
	`sizeBytes` int NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`status` enum('pending','stored') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_uploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `material_uploads_owner_hash_unique` UNIQUE(`openId`,`contentSha256`),
	CONSTRAINT `material_uploads_storage_key_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE INDEX `material_uploads_owner_status_idx` ON `material_uploads` (`openId`,`status`);