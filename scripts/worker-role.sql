DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'haiku_worker') THEN
    CREATE ROLE haiku_worker NOINHERIT;
  END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM haiku_worker;
GRANT USAGE ON SCHEMA public, pgboss TO haiku_worker;
GRANT SELECT ON "CreativeDefaults", "GenerationRequest", "GenerationOutput", "HaikuRevision", "ArtworkRevision", "CandidateRevision", "Asset", "DailyRun", "Notification" TO haiku_worker;
GRANT SELECT ("id", "ownerId", "localDate", "timezone", "feelings", "intensity", "publicInspiration", "permissionToUse", "guidance", "inputProvided", "selectedCandidateId", "archivedAt") ON "DailyEntry" TO haiku_worker;
GRANT INSERT ("id", "ownerId", "localDate", "timezone", "feelings", "guidance", "inputProvided", "updatedAt") ON "DailyEntry" TO haiku_worker;
GRANT UPDATE ("archivedAt", "updatedAt") ON "DailyEntry" TO haiku_worker;
GRANT INSERT ON "GenerationRequest", "GenerationOutput", "HaikuRevision", "ArtworkRevision", "Asset", "DailyRun", "Notification", "AuditEvent" TO haiku_worker;
GRANT SELECT ON "AuditEvent" TO haiku_worker;
GRANT UPDATE ON "GenerationRequest", "GenerationOutput", "Notification" TO haiku_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO haiku_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO haiku_worker;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgboss TO haiku_worker;
-- Deliberately no User/Session/SocialConnection/Approval/Publication/RenderReview access.
-- Generation can read permitted inspiration, but cannot SELECT privateNotes or mutate composition selection.
