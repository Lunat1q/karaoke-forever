-- Up
-- Add youtubeVideoId to queue and create youtubeVideos table
-- Safe to re-run: uses IF NOT EXISTS and handles existing schemas

-- Recreate queue table with youtubeVideoId column and nullable songId
DROP TABLE IF EXISTS queue_yt_tmp;

CREATE TABLE queue_yt_tmp (
    queueId integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    roomId integer NOT NULL,
    songId integer,
    userId integer NOT NULL,
    youtubeVideoId text,
    prevQueueId integer
);

INSERT OR IGNORE INTO queue_yt_tmp (queueId, roomId, songId, userId, prevQueueId)
    SELECT queueId, roomId, songId, userId, prevQueueId FROM queue;

DROP TABLE IF EXISTS queue;

ALTER TABLE queue_yt_tmp RENAME TO queue;

CREATE INDEX IF NOT EXISTS idxRoom ON queue (roomId ASC);
CREATE INDEX IF NOT EXISTS idxPrevQueueId ON queue (prevQueueId ASC);

CREATE TABLE IF NOT EXISTS youtubeVideos
(
    id integer not null
        constraint youtubeVideos_pk
        primary key autoincrement,
    youtubeVideoId text not null,
    userId integer not null,
    thumbnail text not null,
    url text not null,
    duration integer not null,
    artist text not null,
    title text not null,
    lyrics text,
    status text not null,
    karaoke integer(1) NOT NULL DEFAULT(0)
);

CREATE UNIQUE INDEX IF NOT EXISTS youtubeVideos_youtubeVideoId_uindex
    ON youtubeVideos (youtubeVideoId);


-- Down
