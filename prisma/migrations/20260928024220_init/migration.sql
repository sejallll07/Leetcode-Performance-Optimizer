-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('NEVER_SYNCED', 'SYNCING', 'SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leetcode_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leetcodeUsername" TEXT NOT NULL,
    "totalSolved" INTEGER NOT NULL DEFAULT 0,
    "easySolved" INTEGER NOT NULL DEFAULT 0,
    "mediumSolved" INTEGER NOT NULL DEFAULT 0,
    "hardSolved" INTEGER NOT NULL DEFAULT 0,
    "ranking" INTEGER,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'NEVER_SYNCED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastSyncErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leetcode_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "leetcodeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "interviewRelevance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_topics" (
    "problemId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "problem_topics_pkey" PRIMARY KEY ("problemId","topicId")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "leetcodeSubmissionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_topic_mastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "masteryScore" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "problemCount" INTEGER NOT NULL,
    "easyCount" INTEGER NOT NULL,
    "mediumCount" INTEGER NOT NULL,
    "hardCount" INTEGER NOT NULL,
    "lastPracticedAt" TIMESTAMP(3),
    "exposureScore" DOUBLE PRECISION NOT NULL,
    "difficultyScore" DOUBLE PRECISION NOT NULL,
    "recencyScore" DOUBLE PRECISION NOT NULL,
    "diversityScore" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gapVerdict" TEXT,
    "gapExplanation" TEXT,

    CONSTRAINT "user_topic_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_relationships" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "prerequisiteTopicId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "topic_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "intervalIndex" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revision_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_history" (
    "id" TEXT NOT NULL,
    "revisionItemId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "previousInterval" INTEGER NOT NULL,
    "newInterval" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hintLevel" INTEGER,
    "problemSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "leetcode_profiles_userId_key" ON "leetcode_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "topics_name_key" ON "topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "problems_leetcodeId_key" ON "problems"("leetcodeId");

-- CreateIndex
CREATE UNIQUE INDEX "problems_slug_key" ON "problems"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_userId_leetcodeSubmissionId_key" ON "submissions"("userId", "leetcodeSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "topic_relationships_topicId_prerequisiteTopicId_key" ON "topic_relationships"("topicId", "prerequisiteTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "revision_items_userId_problemId_key" ON "revision_items"("userId", "problemId");

-- CreateIndex
CREATE INDEX "mentor_messages_userId_createdAt_idx" ON "mentor_messages"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "leetcode_profiles" ADD CONSTRAINT "leetcode_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_topics" ADD CONSTRAINT "problem_topics_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_topics" ADD CONSTRAINT "problem_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topic_mastery" ADD CONSTRAINT "user_topic_mastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topic_mastery" ADD CONSTRAINT "user_topic_mastery_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_relationships" ADD CONSTRAINT "topic_relationships_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_relationships" ADD CONSTRAINT "topic_relationships_prerequisiteTopicId_fkey" FOREIGN KEY ("prerequisiteTopicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_items" ADD CONSTRAINT "revision_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_items" ADD CONSTRAINT "revision_items_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_history" ADD CONSTRAINT "revision_history_revisionItemId_fkey" FOREIGN KEY ("revisionItemId") REFERENCES "revision_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_messages" ADD CONSTRAINT "mentor_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
