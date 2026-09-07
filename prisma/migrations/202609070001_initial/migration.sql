-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeDefaults" (
    "ownerId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "haikuCount" INTEGER NOT NULL DEFAULT 3,
    "artCount" INTEGER NOT NULL DEFAULT 3,
    "guidance" JSONB NOT NULL,
    "dailyBudgetCents" INTEGER NOT NULL DEFAULT 50,
    "localOnly" BOOLEAN NOT NULL DEFAULT true,
    "publishingPaused" BOOLEAN NOT NULL DEFAULT false,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "generationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "neutralOptIn" BOOLEAN NOT NULL DEFAULT false,
    "reminderTime" TEXT NOT NULL DEFAULT '09:00',
    "generationTime" TEXT NOT NULL DEFAULT '09:30',
    "cutoffTime" TEXT NOT NULL DEFAULT '21:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeDefaults_pkey" PRIMARY KEY ("ownerId")
);

-- CreateTable
CREATE TABLE "DailyEntry" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "feelings" TEXT[],
    "intensity" INTEGER,
    "privateNotes" TEXT NOT NULL DEFAULT '',
    "publicInspiration" TEXT NOT NULL DEFAULT '',
    "permissionToUse" BOOLEAN NOT NULL DEFAULT false,
    "guidance" JSONB NOT NULL,
    "inputProvided" BOOLEAN NOT NULL DEFAULT true,
    "selectedCandidateId" TEXT,
    "history" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "historyIndex" INTEGER NOT NULL DEFAULT -1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRequest" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "haikuCount" INTEGER NOT NULL,
    "artCount" INTEGER NOT NULL,
    "completedHaiku" INTEGER NOT NULL DEFAULT 0,
    "completedArt" INTEGER NOT NULL DEFAULT 0,
    "guidance" JSONB NOT NULL,
    "brief" JSONB NOT NULL,
    "locks" JSONB NOT NULL,
    "sourcePoemId" TEXT,
    "sourceArtId" TEXT,
    "scope" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "estimateCents" INTEGER NOT NULL,
    "localDate" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationOutput" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "revisionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HaikuRevision" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "parentId" TEXT,
    "lines" TEXT[],
    "caption" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "interpretation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HaikuRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkRevision" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "parentId" TEXT,
    "assetId" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtworkRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateRevision" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "parentId" TEXT,
    "poemId" TEXT NOT NULL,
    "artId" TEXT NOT NULL,
    "lines" TEXT[],
    "caption" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "locks" JSONB NOT NULL,
    "meterOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "provenance" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderReview" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "digest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenderReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "digest" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'approved',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "remoteId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "scopes" TEXT[],
    "encryptedTokenRef" TEXT,
    "state" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRun" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_ownerId_idx" ON "Session"("ownerId");

-- CreateIndex
CREATE INDEX "DailyEntry_ownerId_createdAt_idx" ON "DailyEntry"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEntry_ownerId_localDate_key" ON "DailyEntry"("ownerId", "localDate");

-- CreateIndex
CREATE INDEX "GenerationRequest_ownerId_localDate_idx" ON "GenerationRequest"("ownerId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRequest_ownerId_clientKey_key" ON "GenerationRequest"("ownerId", "clientKey");

-- CreateIndex
CREATE INDEX "GenerationOutput_state_idx" ON "GenerationOutput"("state");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationOutput_requestId_kind_ordinal_key" ON "GenerationOutput"("requestId", "kind", "ordinal");

-- CreateIndex
CREATE INDEX "HaikuRevision_ownerId_entryId_idx" ON "HaikuRevision"("ownerId", "entryId");

-- CreateIndex
CREATE INDEX "ArtworkRevision_ownerId_entryId_idx" ON "ArtworkRevision"("ownerId", "entryId");

-- CreateIndex
CREATE INDEX "CandidateRevision_ownerId_entryId_idx" ON "CandidateRevision"("ownerId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_key_key" ON "Asset"("key");

-- CreateIndex
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");

-- CreateIndex
CREATE INDEX "RenderReview_ownerId_entryId_idx" ON "RenderReview"("ownerId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_reviewId_key" ON "Approval"("reviewId");

-- CreateIndex
CREATE INDEX "Approval_ownerId_entryId_idx" ON "Approval"("ownerId", "entryId");

-- CreateIndex
CREATE INDEX "Publication_ownerId_idx" ON "Publication"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_approvalId_destination_account_key" ON "Publication"("approvalId", "destination", "account");

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_ownerId_provider_account_key" ON "SocialConnection"("ownerId", "provider", "account");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRun_ownerId_localDate_kind_key" ON "DailyRun"("ownerId", "localDate", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_ownerId_localDate_key" ON "Notification"("ownerId", "localDate");

-- CreateIndex
CREATE INDEX "AuditEvent_ownerId_createdAt_idx" ON "AuditEvent"("ownerId", "createdAt");

