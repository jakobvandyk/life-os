-- Add parent_id column to tasks for subtask support
ALTER TABLE tasks ADD COLUMN parent_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
