-- CreateTable
CREATE TABLE "mock_interview_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "problems" JSONB NOT NULL,
    "outcomes" JSONB,
    "report" JSONB,
    "narrative" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mock_interview_sessions_userId_startedAt_idx" ON "mock_interview_sessions"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "mock_interview_sessions" ADD CONSTRAINT "mock_interview_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
