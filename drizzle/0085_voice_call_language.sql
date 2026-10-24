-- Voice call language (Oct 23 2026). The press-9 language menu stores the
-- caller's choice on the call row so every webhook in the call (STT locale,
-- TTS voice, prompts, LLM language) follows it for the rest of the call.
ALTER TABLE `voiceCalls`
  ADD COLUMN `language` VARCHAR(8) NULL AFTER `fromNumber`;
