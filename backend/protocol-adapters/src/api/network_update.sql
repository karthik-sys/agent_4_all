-- Add last_item column to agent_evaluations if it doesn't exist
ALTER TABLE agent_evaluations ADD COLUMN IF NOT EXISTS last_item_purchased TEXT;

-- Update the was_selected marking
CREATE OR REPLACE FUNCTION mark_evaluation_selected() RETURNS TRIGGER AS $$
BEGIN
  -- Update the evaluation to mark it as selected and store the item
  UPDATE agent_evaluations 
  SET was_selected = true,
      last_item_purchased = NEW.description
  WHERE agent_id = NEW.agent_id 
  AND evaluation_session_id = (
    SELECT evaluation_session_id 
    FROM agent_evaluations 
    WHERE agent_id = NEW.agent_id 
    ORDER BY evaluated_at DESC 
    LIMIT 1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
