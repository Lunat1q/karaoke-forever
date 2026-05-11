-- Up
-- Add youtubeVideoId to queue and create youtubeVideos table
-- Safe to re-run: uses IF NOT EXISTS and handles existing schemas

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
