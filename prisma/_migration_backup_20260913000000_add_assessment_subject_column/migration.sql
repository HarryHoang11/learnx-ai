-- Add subject column to Assessment table
-- The subject field is already defined in the Prisma schema but may not exist in the database

ALTER TABLE assessment ADD COLUMN IF NOT EXISTS subject VARCHAR(255);

-- Optional: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_assessment_subject ON assessment(subject);
