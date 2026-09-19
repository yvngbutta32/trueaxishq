CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`sku` varchar(64),
	`unit` varchar(16) NOT NULL DEFAULT 'each',
	`unitCost` decimal(12,2) NOT NULL DEFAULT '0',
	`unitPrice` decimal(12,2) NOT NULL DEFAULT '0',
	`reorderPoint` decimal(12,2) NOT NULL DEFAULT '0',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryItems_userId_sku_unique_idx` UNIQUE(`userId`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `inventoryLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('warehouse','truck') NOT NULL DEFAULT 'warehouse',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryLocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryLocations_userId_name_unique_idx` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `inventoryMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`itemId` int NOT NULL,
	`locationId` int NOT NULL,
	`jobId` int,
	`purchaseOrderId` int,
	`type` enum('receive','consume','adjust') NOT NULL,
	`quantity` decimal(12,2) NOT NULL,
	`note` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`inventoryItemId` int,
	`description` varchar(255) NOT NULL,
	`quantity` decimal(12,2) NOT NULL,
	`unitCost` decimal(12,2) NOT NULL DEFAULT '0',
	`receivedQuantity` decimal(12,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`poNumber` varchar(64) NOT NULL,
	`supplierName` varchar(255) NOT NULL,
	`locationId` int NOT NULL,
	`status` enum('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
	`expectedDate` varchar(32),
	`notes` text,
	`totalAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseOrders_userId_poNumber_unique_idx` UNIQUE(`userId`,`poNumber`)
);
--> statement-breakpoint
CREATE INDEX `inventoryItems_userId_idx` ON `inventoryItems` (`userId`);--> statement-breakpoint
CREATE INDEX `inventoryLocations_userId_idx` ON `inventoryLocations` (`userId`);--> statement-breakpoint
CREATE INDEX `inventoryMovements_userId_idx` ON `inventoryMovements` (`userId`);--> statement-breakpoint
CREATE INDEX `inventoryMovements_itemId_idx` ON `inventoryMovements` (`itemId`);--> statement-breakpoint
CREATE INDEX `inventoryMovements_locationId_idx` ON `inventoryMovements` (`locationId`);--> statement-breakpoint
CREATE INDEX `inventoryMovements_jobId_idx` ON `inventoryMovements` (`jobId`);--> statement-breakpoint
CREATE INDEX `inventoryMovements_purchaseOrderId_idx` ON `inventoryMovements` (`purchaseOrderId`);--> statement-breakpoint
CREATE INDEX `purchaseOrderItems_userId_idx` ON `purchaseOrderItems` (`userId`);--> statement-breakpoint
CREATE INDEX `purchaseOrderItems_purchaseOrderId_idx` ON `purchaseOrderItems` (`purchaseOrderId`);--> statement-breakpoint
CREATE INDEX `purchaseOrders_userId_idx` ON `purchaseOrders` (`userId`);--> statement-breakpoint
CREATE INDEX `purchaseOrders_locationId_idx` ON `purchaseOrders` (`locationId`);