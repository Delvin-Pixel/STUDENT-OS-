START TRANSACTION;--> statement-breakpoint
UPDATE `push_delivery_history` AS history
INNER JOIN (
  SELECT `id` AS `duplicateId`, `keepId`
  FROM (
    SELECT
      `id`,
      FIRST_VALUE(`id`) OVER (
        PARTITION BY `deviceId`, `dedupeKey`
        ORDER BY CASE WHEN `sentAt` IS NOT NULL THEN 0 ELSE 1 END, `id` DESC
      ) AS `keepId`,
      ROW_NUMBER() OVER (
        PARTITION BY `deviceId`, `dedupeKey`
        ORDER BY CASE WHEN `sentAt` IS NOT NULL THEN 0 ELSE 1 END, `id` DESC
      ) AS `rowRank`
    FROM `push_reminders`
  ) AS `ranked`
  WHERE `rowRank` > 1
) AS `duplicates` ON history.`reminderId` = duplicates.`duplicateId`
SET history.`reminderId` = duplicates.`keepId`;--> statement-breakpoint
DELETE FROM `push_reminders`
WHERE `id` IN (
  SELECT `id` FROM (
    SELECT
      `id`,
      ROW_NUMBER() OVER (
        PARTITION BY `deviceId`, `dedupeKey`
        ORDER BY CASE WHEN `sentAt` IS NOT NULL THEN 0 ELSE 1 END, `id` DESC
      ) AS `rowRank`
    FROM `push_reminders`
  ) AS `ranked`
  WHERE `rowRank` > 1
);--> statement-breakpoint
DROP INDEX `push_reminders_dedupe_idx` ON `push_reminders`;--> statement-breakpoint
ALTER TABLE `push_reminders` ADD CONSTRAINT `push_reminders_device_dedupe_unique` UNIQUE(`deviceId`,`dedupeKey`);--> statement-breakpoint
COMMIT;
