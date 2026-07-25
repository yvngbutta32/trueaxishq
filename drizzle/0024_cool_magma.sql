ALTER TABLE `bookingCancelTokens` ADD CONSTRAINT `bookingCancelTokens_token_idx` UNIQUE(`token`);--> statement-breakpoint
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_requestToken_idx` UNIQUE(`requestToken`);--> statement-breakpoint
ALTER TABLE `userSessions` ADD CONSTRAINT `userSessions_tokenHash_idx` UNIQUE(`tokenHash`);--> statement-breakpoint
CREATE INDEX `auditLogs_userId_idx` ON `auditLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `automationLogs_userId_idx` ON `automationLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `automationLogs_automationId_idx` ON `automationLogs` (`automationId`);--> statement-breakpoint
CREATE INDEX `automations_userId_idx` ON `automations` (`userId`);--> statement-breakpoint
CREATE INDEX `bookingCancelTokens_userId_idx` ON `bookingCancelTokens` (`userId`);--> statement-breakpoint
CREATE INDEX `clientDocuments_userId_idx` ON `clientDocuments` (`userId`);--> statement-breakpoint
CREATE INDEX `clientDocuments_clientId_idx` ON `clientDocuments` (`clientId`);--> statement-breakpoint
CREATE INDEX `clientPulse_userId_idx` ON `clientPulse` (`userId`);--> statement-breakpoint
CREATE INDEX `clientPulse_clientId_idx` ON `clientPulse` (`clientId`);--> statement-breakpoint
CREATE INDEX `clientTags_userId_idx` ON `clientTags` (`userId`);--> statement-breakpoint
CREATE INDEX `clientTags_clientId_idx` ON `clientTags` (`clientId`);--> statement-breakpoint
CREATE INDEX `contractTemplates_userId_idx` ON `contractTemplates` (`userId`);--> statement-breakpoint
CREATE INDEX `contracts_userId_idx` ON `contracts` (`userId`);--> statement-breakpoint
CREATE INDEX `emailTemplates_userId_idx` ON `emailTemplates` (`userId`);--> statement-breakpoint
CREATE INDEX `expenses_userId_idx` ON `expenses` (`userId`);--> statement-breakpoint
CREATE INDEX `followUpRules_userId_idx` ON `followUpRules` (`userId`);--> statement-breakpoint
CREATE INDEX `intakeResponses_userId_idx` ON `intakeResponses` (`userId`);--> statement-breakpoint
CREATE INDEX `intakeResponses_formId_idx` ON `intakeResponses` (`formId`);--> statement-breakpoint
CREATE INDEX `notifications_userId_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `notifications_read_idx` ON `notifications` (`read`);--> statement-breakpoint
CREATE INDEX `portalMessages_userId_idx` ON `portalMessages` (`userId`);--> statement-breakpoint
CREATE INDEX `portalMessages_clientId_idx` ON `portalMessages` (`clientId`);--> statement-breakpoint
CREATE INDEX `recurringInvoices_userId_idx` ON `recurringInvoices` (`userId`);--> statement-breakpoint
CREATE INDEX `revenueGoals_userId_idx` ON `revenueGoals` (`userId`);--> statement-breakpoint
CREATE INDEX `securityEvents_ip_idx` ON `securityEvents` (`ip`);--> statement-breakpoint
CREATE INDEX `securityEvents_userId_idx` ON `securityEvents` (`userId`);--> statement-breakpoint
CREATE INDEX `services_userId_idx` ON `services` (`userId`);--> statement-breakpoint
CREATE INDEX `testimonials_userId_idx` ON `testimonials` (`userId`);--> statement-breakpoint
CREATE INDEX `timeEntries_userId_idx` ON `timeEntries` (`userId`);--> statement-breakpoint
CREATE INDEX `userApiKeys_userId_idx` ON `userApiKeys` (`userId`);--> statement-breakpoint
CREATE INDEX `userSessions_userId_idx` ON `userSessions` (`userId`);