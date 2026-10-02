CREATE TABLE `assessment_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`ordinal` int NOT NULL,
	`prompt` text NOT NULL,
	`options` json NOT NULL,
	`correctOptionIndex` int NOT NULL,
	`explanation` text NOT NULL,
	CONSTRAINT `assessment_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_questions_session_ordinal_unique` UNIQUE(`sessionId`,`ordinal`)
);
--> statement-breakpoint
CREATE TABLE `assessment_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`questionOrdinal` int NOT NULL,
	`selectedOptionIndex` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessment_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_responses_session_question_unique` UNIQUE(`sessionId`,`questionOrdinal`)
);
--> statement-breakpoint
CREATE TABLE `assessment_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`sourceQuizId` varchar(128) NOT NULL,
	`topicId` varchar(128),
	`status` enum('in_progress','submitted','expired') NOT NULL DEFAULT 'in_progress',
	`questionSetHash` varchar(64) NOT NULL,
	`questionCount` int NOT NULL,
	`clientStartKey` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`submittedAt` timestamp,
	`finalScore` int,
	`correctCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessment_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_sessions_owner_start_unique` UNIQUE(`openId`,`clientStartKey`)
);
--> statement-breakpoint
CREATE TABLE `assessment_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`sessionId` int NOT NULL,
	`clientSubmitKey` varchar(128) NOT NULL,
	`score` int NOT NULL,
	`correctCount` int NOT NULL,
	`questionCount` int NOT NULL,
	`finalizedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessment_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_submissions_owner_key_unique` UNIQUE(`openId`,`clientSubmitKey`),
	CONSTRAINT `assessment_submissions_session_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE INDEX `assessment_sessions_owner_status_idx` ON `assessment_sessions` (`openId`,`status`);