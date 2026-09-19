ALTER TABLE `bookings` ADD `slotKey` varchar(200);--> statement-breakpoint
ALTER TABLE `bookings` ADD COLUMN `slotKey` varchar(200);
UPDATE `bookings`
SET `slotKey` = CASE
  WHEN `status` = 'scheduled' THEN CONCAT(`userId`, '|', `date`, '|', `time`)
  ELSE NULL
END;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_live_slot_unique_idx` UNIQUE(`slotKey`);
