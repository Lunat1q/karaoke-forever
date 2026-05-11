-- Up
ALTER TABLE "queue" ADD COLUMN "prevQueueId" INTEGER;
CREATE INDEX IF NOT EXISTS idxPrevQueueId ON "queue" ("prevQueueId" ASC);

UPDATE queue
SET prevQueueId = (
	SELECT MAX(q.queueId)
	FROM queue q
	WHERE q.queueId < queue.queueId AND q.roomId = queue.roomId
);

-- Down
DROP INDEX IF EXISTS idxPrevQueueId;

ALTER TABLE "queue" DROP COLUMN "prevQueueId";
