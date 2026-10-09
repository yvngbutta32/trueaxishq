-- Agency sub-accounts: managed client workspaces under an Agency-plan owner.
-- A sub-account is a normal user row owned by its parent (parentUserId); all
-- existing per-userId data isolation applies to it unchanged.
ALTER TABLE `users`
  ADD COLUMN `parentUserId` int NULL,
  ADD COLUMN `subSuspended` tinyint(1) NOT NULL DEFAULT 0;
