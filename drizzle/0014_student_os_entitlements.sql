CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`plan` enum('free','premium') NOT NULL DEFAULT 'free',
	`status` enum('active','trial','past_due','canceled','expired') NOT NULL DEFAULT 'active',
	`provider` enum('none','paystack','hubtel','manual') NOT NULL DEFAULT 'none',
	`providerCustomerId` varchar(191),
	`providerSubscriptionId` varchar(191),
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
	`lastVerifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_owner_unique` ON `subscriptions` (`openId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_provider_subscription_unique` ON `subscriptions` (`provider`,`providerSubscriptionId`);
--> statement-breakpoint
CREATE INDEX `subscriptions_status_period_idx` ON `subscriptions` (`status`,`currentPeriodEnd`);
