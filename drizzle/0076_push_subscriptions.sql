CREATE TABLE `pushSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` varchar(512) NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`userAgent` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
	`updatedAt` timestamp NOT NULL DEFAULT current_timestamp(),
	PRIMARY KEY (`id`),
	UNIQUE KEY `push_endpoint_unique` (`endpoint`)
);
--> statement-breakpoint

CREATE TABLE `pushVapidKeys` (
	`id` int NOT NULL,
	`publicKey` varchar(255) NOT NULL,
	`privateKey` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
	`updatedAt` timestamp NOT NULL DEFAULT current_timestamp(),
	PRIMARY KEY (`id`)
);
