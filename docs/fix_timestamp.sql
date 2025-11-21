-- Fix timestamp columns to use TIMESTAMPTZ
ALTER TABLE agent_teams 
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

ALTER TABLE agent_team_members 
ALTER COLUMN joined_at TYPE TIMESTAMPTZ USING joined_at AT TIME ZONE 'UTC';

-- Check other tables too
ALTER TABLE agent_evaluations 
ALTER COLUMN evaluated_at TYPE TIMESTAMPTZ USING evaluated_at AT TIME ZONE 'UTC';
