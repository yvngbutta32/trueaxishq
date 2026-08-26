ALTER TABLE `serviceVisits` ADD `clientVisible` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `serviceVisits` ADD `clientUpdate` varchar(500);