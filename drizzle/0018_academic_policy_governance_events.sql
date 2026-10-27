CREATE TABLE `academic_policy_governance_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `eventId` varchar(36) NOT NULL,
  `authorityId` varchar(160) NOT NULL,
  `sequence` int NOT NULL,
  `eventType` enum('source_manifest_reviewed','policy_attestation_recorded','policy_published','policy_suspended','policy_revoked','signer_registered','signer_revoked','signing_key_rotated') NOT NULL,
  `subjectId` varchar(160) NOT NULL,
  `subjectVersion` varchar(64),
  `scope` json NOT NULL,
  `sourceManifestSha256` varchar(64),
  `actorPrincipalId` varchar(160) NOT NULL,
  `reviewerPrincipalId` varchar(160) NOT NULL,
  `actorKeyId` varchar(160) NOT NULL,
  `reviewerKeyId` varchar(160) NOT NULL,
  `actorSignature` varchar(128) NOT NULL,
  `reviewerSignature` varchar(128) NOT NULL,
  `requestKey` varchar(128) NOT NULL,
  `occurredAt` timestamp NOT NULL,
  `previousEventHash` varchar(64) NOT NULL,
  `eventHash` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `academic_policy_governance_events_id` PRIMARY KEY(`id`),
  CONSTRAINT `academic_policy_governance_event_id_unique` UNIQUE(`eventId`),
  CONSTRAINT `academic_policy_governance_authority_sequence_unique` UNIQUE(`authorityId`,`sequence`),
  CONSTRAINT `academic_policy_governance_authority_request_unique` UNIQUE(`authorityId`,`requestKey`),
  CONSTRAINT `academic_policy_governance_authority_hash_unique` UNIQUE(`authorityId`,`eventHash`)
);
--> statement-breakpoint
CREATE INDEX `academic_policy_governance_authority_created_idx` ON `academic_policy_governance_events` (`authorityId`,`createdAt`);
