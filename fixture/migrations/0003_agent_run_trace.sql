ALTER TABLE agent_runs ADD COLUMN handler_kind TEXT;
ALTER TABLE agent_runs ADD COLUMN trigger_kind TEXT;
ALTER TABLE agent_runs ADD COLUMN claimed_message_id INTEGER;
ALTER TABLE agent_runs ADD COLUMN commit_sha TEXT;
ALTER TABLE agent_runs ADD COLUMN changed_paths TEXT;
ALTER TABLE agent_runs ADD COLUMN error_category TEXT;
