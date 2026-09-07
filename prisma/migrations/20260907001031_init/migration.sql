CREATE TYPE "EmotionalDirection" AS ENUM ('REFLECT', 'LIFT', 'CONTRAST');
CREATE TYPE "VisualStyle" AS ENUM ('PAPER_GARDEN', 'DUSK_GRADIENT', 'PLAYFUL_SHAPES', 'QUIET_SEA');
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'APPROVED', 'SCHEDULED', 'REJECTED', 'CANCELLED', 'PUBLISHED');
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'CLAIMED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "DestinationState" AS ENUM ('PLANNED', 'CONNECTED', 'BLOCKED', 'MANUAL_EXPORT');
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_STARTED', 'SCHEDULED', 'PUBLISHED', 'FAILED_NEEDS_REVIEW', 'CANCELLED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "MoodCheckIn" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feelings" TEXT[],
  "intensity" INTEGER NOT NULL,
  "inspiration" TEXT NOT NULL,
  "visualStyle" "VisualStyle" NOT NULL,
  "direction" "EmotionalDirection" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MoodCheckIn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MoodCheckIn_userId_createdAt_idx" ON "MoodCheckIn"("userId", "createdAt");
ALTER TABLE "MoodCheckIn" ADD CONSTRAINT "MoodCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Poem" (
  "id" TEXT NOT NULL,
  "checkInId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "lines" TEXT[],
  "syllableCounts" INTEGER[],
  "syllableUncertain" BOOLEAN NOT NULL DEFAULT true,
  "caption" TEXT NOT NULL,
  "altText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Poem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Poem" ADD CONSTRAINT "Poem_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "MoodCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Background" (
  "id" TEXT NOT NULL,
  "checkInId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "palette" JSONB NOT NULL,
  "style" "VisualStyle" NOT NULL,
  "svgTemplate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Background_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Background" ADD CONSTRAINT "Background_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "MoodCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ArtworkRevision" (
  "id" TEXT NOT NULL,
  "checkInId" TEXT NOT NULL,
  "poemId" TEXT NOT NULL,
  "backgroundId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "immutableSnapshot" JSONB NOT NULL,
  "typography" JSONB NOT NULL,
  "caption" TEXT NOT NULL,
  "altText" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "scheduledFor" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvalInvalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArtworkRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArtworkRevision_checkInId_revisionNumber_key" ON "ArtworkRevision"("checkInId", "revisionNumber");
CREATE INDEX "ArtworkRevision_status_scheduledFor_idx" ON "ArtworkRevision"("status", "scheduledFor");
ALTER TABLE "ArtworkRevision" ADD CONSTRAINT "ArtworkRevision_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "MoodCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtworkRevision" ADD CONSTRAINT "ArtworkRevision_poemId_fkey" FOREIGN KEY ("poemId") REFERENCES "Poem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtworkRevision" ADD CONSTRAINT "ArtworkRevision_backgroundId_fkey" FOREIGN KEY ("backgroundId") REFERENCES "Background"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Destination" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "state" "DestinationState" NOT NULL,
  "capabilities" JSONB NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

CREATE TABLE "DestinationDelivery" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "remotePostId" TEXT,
  "attemptToken" TEXT NOT NULL,
  "lastError" TEXT,
  "scheduledFor" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DestinationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DestinationDelivery_attemptToken_key" ON "DestinationDelivery"("attemptToken");
CREATE UNIQUE INDEX "DestinationDelivery_revisionId_destinationId_key" ON "DestinationDelivery"("revisionId", "destinationId");
CREATE INDEX "DestinationDelivery_status_scheduledFor_idx" ON "DestinationDelivery"("status", "scheduledFor");
ALTER TABLE "DestinationDelivery" ADD CONSTRAINT "DestinationDelivery_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ArtworkRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DestinationDelivery" ADD CONSTRAINT "DestinationDelivery_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "QueueJob" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
  "checkInId" TEXT,
  "revisionId" TEXT,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QueueJob_dedupeKey_key" ON "QueueJob"("dedupeKey");
CREATE INDEX "QueueJob_status_runAt_idx" ON "QueueJob"("status", "runAt");
ALTER TABLE "QueueJob" ADD CONSTRAINT "QueueJob_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "MoodCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueueJob" ADD CONSTRAINT "QueueJob_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ArtworkRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
