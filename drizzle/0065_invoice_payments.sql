CREATE TABLE `invoicePayments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `invoiceId` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `method` enum('cash','check','bank_transfer','card','other') NOT NULL,
  `reference` varchar(128),
  `notes` text,
  `paidAt` timestamp NOT NULL DEFAULT (now()),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `invoicePayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `invoicePayments_owner_invoice_idx` ON `invoicePayments` (`userId`,`invoiceId`);
--> statement-breakpoint
CREATE INDEX `invoicePayments_paidAt_idx` ON `invoicePayments` (`paidAt`);
