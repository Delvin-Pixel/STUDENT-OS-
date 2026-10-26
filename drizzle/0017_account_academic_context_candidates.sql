CREATE TABLE `academic_context_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`candidateId` varchar(36) NOT NULL,
	`requestKey` varchar(128) NOT NULL,
	`countryCode` varchar(2) NOT NULL DEFAULT 'GH',
	`educationLevel` enum('JHS','SHS','TERTIARY') NOT NULL,
	`enrollmentMode` enum('institutional','remedial','private_candidate','transfer') NOT NULL,
	`institutionId` varchar(160),
	`curriculumId` varchar(160) NOT NULL,
	`curriculumVersion` varchar(64) NOT NULL,
	`academicYear` varchar(80),
	`yearOrLevel` varchar(80),
	`termOrSemester` varchar(80),
	`programId` varchar(160),
	`qualificationId` varchar(160),
	`dataOrigin` enum('learner_declared') NOT NULL DEFAULT 'learner_declared',
	`authorityStatus` enum('unverified') NOT NULL DEFAULT 'unverified',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `academic_context_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_context_candidates_owner_key_unique` UNIQUE(`openId`,`requestKey`),
	CONSTRAINT `academic_context_candidates_candidate_unique` UNIQUE(`candidateId`)
);
--> statement-breakpoint
CREATE INDEX `academic_context_candidates_owner_recent_idx` ON `academic_context_candidates` (`openId`,`id`);