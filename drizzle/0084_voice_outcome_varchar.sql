-- Voice outcome widening (Oct 23 2026). 0079 created voiceCalls.outcome as a
-- 5-value ENUM, but schema.ts declares varchar(20) — the drift silently broke
-- every write of newer outcomes ('fair_use_cap' from managed lines, 'transfer'
-- from the press-zero path; the live e2e caught it). Widen to match schema.
ALTER TABLE `voiceCalls`
  --> statement-breakpoint
  MODIFY COLUMN `outcome` VARCHAR(20) NOT NULL DEFAULT 'unknown';
