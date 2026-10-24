-- 0087: PO job costing roll-up (Jobber's #1 unfulfilled request).
-- Purchase orders can be linked to a job at creation; received job-linked PO
-- totals then flow into the owner job-cost roll-up alongside stock consumed
-- from inventory, so "what did this job cost me?" finally has a materials line.
ALTER TABLE `purchaseOrders`
  ADD COLUMN `jobId` int;
--> statement-breakpoint
ALTER TABLE `purchaseOrders`
  ADD INDEX `purchaseOrders_owner_job_idx` (`userId`, `jobId`);
--> statement-breakpoint
-- Job-costing correctness: consuming stock onto a job must value the material
-- at the unit cost WHEN IT WAS USED, not whatever the item costs today —
-- receiving a later PO rewrites the item's unit cost, which silently inflated
-- old job materials (caught by the live e2e). Snapshots live on the movement.
ALTER TABLE `inventoryMovements`
  ADD COLUMN `unitCostAt` decimal(12, 2);
