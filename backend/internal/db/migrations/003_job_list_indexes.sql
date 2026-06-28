ALTER TABLE jobs ADD INDEX idx_jobs_source_id (source_id);
ALTER TABLE jobs ADD INDEX idx_jobs_published_at (published_at DESC);
ALTER TABLE user_jobs ADD INDEX idx_user_jobs_user_status (user_id, status);
