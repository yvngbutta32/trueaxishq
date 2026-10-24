-- Voice receptionist hardening (Oct 23 2026): human-transfer path + Spanish.
-- Research mandate (docs/working-notes/research/comp-2026-10/ai-receptionist-landscape-2026.md):
-- top documented failure mode = dropped emergency transfers; only ST/Smith.ai
-- are bilingual, so Spanish is a free differentiator vs the whole SMB field.
ALTER TABLE `voiceSettings`
  ADD COLUMN `transferNumber` varchar(32) NOT NULL DEFAULT '',
  ADD COLUMN `language` varchar(8) NOT NULL DEFAULT 'en';
