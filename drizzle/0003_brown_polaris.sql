ALTER TABLE `push_devices` ADD `openId` varchar(64);--> statement-breakpoint
CREATE INDEX `push_devices_owner_idx` ON `push_devices` (`openId`);