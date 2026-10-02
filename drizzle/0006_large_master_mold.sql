ALTER TABLE `users` ADD `workspaceSchemaVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `workspaceRevision` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `workspaceUpdatedAt` timestamp;