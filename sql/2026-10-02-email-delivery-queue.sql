CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL DEFAULT '',
  "replyTo" TEXT NOT NULL DEFAULT '',
  "subject" TEXT NOT NULL DEFAULT '',
  "html" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL DEFAULT 'general',
  "lowPriority" BOOLEAN NOT NULL DEFAULT false,
  "batchId" TEXT NOT NULL DEFAULT '',
  "requestedById" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "lockId" TEXT NOT NULL DEFAULT '',
  "expiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "providerMessageId" TEXT NOT NULL DEFAULT '',
  "lastError" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDelivery_recipient_idx" ON "EmailDelivery"("recipient");
CREATE INDEX "EmailDelivery_kind_idx" ON "EmailDelivery"("kind");
CREATE INDEX "EmailDelivery_lowPriority_idx" ON "EmailDelivery"("lowPriority");
CREATE INDEX "EmailDelivery_batchId_idx" ON "EmailDelivery"("batchId");
CREATE INDEX "EmailDelivery_requestedById_idx" ON "EmailDelivery"("requestedById");
CREATE INDEX "EmailDelivery_status_idx" ON "EmailDelivery"("status");
CREATE INDEX "EmailDelivery_nextAttemptAt_idx" ON "EmailDelivery"("nextAttemptAt");
CREATE INDEX "EmailDelivery_expiresAt_idx" ON "EmailDelivery"("expiresAt");
CREATE INDEX "EmailDelivery_sentAt_idx" ON "EmailDelivery"("sentAt");
CREATE INDEX "EmailDelivery_createdAt_idx" ON "EmailDelivery"("createdAt");
CREATE INDEX "EmailDelivery_worker_idx"
  ON "EmailDelivery"("status", "lowPriority", "nextAttemptAt", "createdAt");
