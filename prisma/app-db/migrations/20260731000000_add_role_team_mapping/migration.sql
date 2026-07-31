-- Map roles to teams
ALTER TABLE "roles" ADD COLUMN "team_id" UUID;

-- Create indexes
CREATE INDEX "roles_team_id_idx" ON "roles"("team_id");

-- Add foreign key constraints
ALTER TABLE "roles" ADD CONSTRAINT "roles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
