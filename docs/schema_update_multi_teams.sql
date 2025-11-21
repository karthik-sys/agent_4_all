-- Drop the unique constraint if it exists (agent can only be in one team)
-- This allows agents to join multiple teams
ALTER TABLE agent_team_members 
DROP CONSTRAINT IF EXISTS agent_team_members_team_id_agent_id_key;

-- Keep only a constraint that prevents duplicate entries (same agent in same team twice)
-- The UNIQUE constraint should allow (team1, agent1) and (team2, agent1) but not duplicate (team1, agent1)
ALTER TABLE agent_team_members
ADD CONSTRAINT agent_team_members_unique 
UNIQUE (team_id, agent_id);

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_teams_agent 
ON agent_team_members(agent_id);

