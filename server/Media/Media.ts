import sql from 'sqlate'
import fs from 'fs'
import path from 'path'
import { db } from '../lib/Database.js'
import getLogger from '../lib/Log.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
import Prefs from '../Prefs/Prefs.js'
import { QUEUE_PUSH } from '../../shared/actionTypes.js'

const log = getLogger('Media')

class Media {
  /**
   * Get media matching all search criteria
   */
  static search (filter: object): { result: number[], entities: Record<string, any> } {
    const media = {
      result: [],
      entities: {},
    }

    const whereClause = typeof filter !== 'object'
      ? sql`true`
      : sql`${sql.tuple(Object.keys(filter).map(sql.column))} = ${sql.tuple(Object.values(filter))}`

    const query = sql`
      SELECT
        media.*,
        songs.*,
        artists.artistId, artists.name AS artist, artists.nameNorm AS artistNorm,
        paths.pathId, paths.path
      FROM media
        INNER JOIN songs USING (songId)
        INNER JOIN artists USING (artistId)
        INNER JOIN paths USING (pathId)
      WHERE ${whereClause}
      ORDER BY paths.priority ASC
    `
    const rows = db.all<{ mediaId: number } & Record<string, any>>(String(query), query.parameters)

    for (const row of rows) {
      media.result.push(row.mediaId)
      media.entities[row.mediaId] = row
    }

    return media
  }

  /**
   * Add media file to the library
   */
  static add (media: any): number {
    if (!Number.isInteger(media.songId)
      || !Number.isInteger(media.duration)
      || !Number.isInteger(media.pathId)
      || !media.relPath
    ) throw new Error('invalid media data: ' + JSON.stringify(media))

    // currently uses an Object instead of Map
    const query = sql`
      INSERT INTO media ${sql.tuple(Object.keys(media).map(sql.column))}
      VALUES ${sql.tuple(Object.values(media))}
    `
    const res = db.run(String(query), query.parameters)

    if (!Number.isInteger(res.lastID)) {
      throw new Error('invalid lastID from media insert')
    }

    return res.lastID
  }

  /**
   * Update media item
   */
  static update (media: any): void {
    const { mediaId } = media

    if (!Number.isInteger(mediaId)) {
      throw new Error(`invalid mediaId: ${mediaId}`)
    }

    // currently uses an Object instead of Map
    delete media.mediaId

    const query = sql`
      UPDATE media
      SET ${sql.tuple(Object.keys(media).map(sql.column))} = ${sql.tuple(Object.values(media))}
      WHERE mediaId = ${mediaId}
    `
    db.run(String(query), query.parameters)
  }

  /**
   * Removes media from the db in sqlite-friendly batches
   */
  static remove (mediaIds: number[]): void {
    const batchSize = 999

    while (mediaIds.length) {
      const query = sql`
        DELETE FROM media
        WHERE mediaId IN ${sql.in(mediaIds.splice(0, batchSize))}
      `
      const res = db.run(String(query), query.parameters)

      log.info(`removed ${res.changes} media`)
    }
  }

  /**
   * Remove unlinked items and VACUUM
   */
  static cleanup (): void {
    let res

    // remove media in nonexistent paths
    res = db.run(`
      DELETE FROM media WHERE mediaId IN (
        SELECT media.mediaId FROM media LEFT JOIN paths USING(pathId) WHERE paths.pathId IS NULL
      )
    `)
    log.info(`cleanup: ${res.changes} media in nonexistent paths`)

    // remove songs without associated media
    res = db.run(`
      DELETE FROM songs WHERE songId IN (
        SELECT songs.songId FROM songs LEFT JOIN media USING(songId) WHERE media.mediaId IS NULL
      )
    `)
    log.info(`cleanup: ${res.changes} songs with no associated media`)

    // remove stars for nonexistent songs
    res = db.run(`
      DELETE FROM songStars WHERE songId IN (
        SELECT songStars.songId FROM songStars LEFT JOIN songs USING(songId) WHERE songs.songId IS NULL
      )
    `)
    log.info(`cleanup: ${res.changes} stars for nonexistent songs`)

    // remove queue items for nonexistent songs
    const rows = db.all<{ queueId: number }>(`
      SELECT queue.queueId FROM queue LEFT JOIN songs USING(songId) WHERE songs.songId IS NULL
    `)

    for (const row of rows) {
      Queue.remove(row.queueId)
    }

    log.info(`cleanup: ${rows.length} queue items for nonexistent songs`)

    log.info('cleanup: vacuuming database')
    db.run('VACUUM')
  }

  /**
   * Set isPreferred flag for a given media item
   */
  static setPreferred (mediaId: number, isPreferred: boolean): number {
    if (!Number.isInteger(mediaId) || typeof isPreferred !== 'boolean') {
      throw new Error('invalid mediaId or value')
    }

    // get songId
    const res = Media.search({ mediaId })

    if (!res.result.length) {
      throw new Error(`mediaId not found: ${mediaId}`)
    }

    const songId = res.entities[mediaId].songId

    // clear any currently preferred items
    const query = sql`
      UPDATE media
      SET isPreferred = 0
      WHERE songId = ${songId}
    `
    db.run(String(query), query.parameters)

    if (isPreferred) {
      Media.update({ mediaId, isPreferred: 1 })
    }

    return songId
  }

  /**
   * Update a YouTube video entry and notify relevant rooms
   */
  static updateYoutubeVideo (data: any, io: any): void {
    const { video } = data
    const youtubeVideoId = video.youtubeVideoId

    if (!Number.isInteger(video.id)) {
      throw new Error(`invalid video ID: ${video.id}`)
    }

    // get the queue entries that use this video
    const queueQuery = sql`
      SELECT *
      FROM queue
      WHERE youtubeVideoId = ${youtubeVideoId}
    `
    const queueRows = db.all<any>(String(queueQuery), queueQuery.parameters)
    const roomIds = queueRows.map(row => row.roomId)

    if (queueRows.length) {
      // handle status updates with toast notifications
      if (Object.prototype.hasOwnProperty.call(data, 'status')) {
        const userIds = queueRows.map(row => row.userId)
        if (data.status === 'failed') {
          for (const userId of userIds) {
            io.to(`user:${userId}`).emit('toast', {
              content: `😥 A karaoke mix for "${data.video.title}" by ${data.video.artist} could not be created.`,
              type: 'error'
            })
          }

          // remove failed video from all queues
          const deleteQuery = sql`
            DELETE FROM queue
            WHERE youtubeVideoId = ${youtubeVideoId}
          `
          db.run(String(deleteQuery), deleteQuery.parameters)
        } else if (data.status === 'ready') {
          const msg = data.video.karaoke
            ? `🤩 "${data.video.title}" by ${data.video.artist} downloaded successfully!`
            : `🤩 The karaoke mix for "${data.video.title}" by ${data.video.artist} is ready!`

          for (const userId of userIds) {
            io.to(`user:${userId}`).emit('toast', { content: msg })
          }
        }
      }

      // update the DB record
      delete data.video

      if (Object.keys(data).length) {
        const query = sql`
          UPDATE youtubeVideos
          SET ${sql.tuple(Object.keys(data).map(sql.column))} = ${sql.tuple(Object.values(data))}
          WHERE id = ${video.id}
        `
        db.run(String(query), query.parameters)
      }

      // update the applicable rooms
      for (const roomId of roomIds) {
        io.to(Rooms.prefix(roomId)).emit('action', {
          type: QUEUE_PUSH,
          payload: Queue.get(roomId),
        })
      }
    }

    // if the video is no longer queued anywhere, delete it and cleanup
    if (!queueRows.length || data.status === 'failed') {
      const deleteQuery = sql`
        DELETE FROM youtubeVideos
        WHERE youtubeVideoId = ${youtubeVideoId}
      `
      db.run(String(deleteQuery), deleteQuery.parameters)

      // delete the video's tmp folder
      const prefs = Prefs.get() as any
      const tmpDir = path.join(prefs.tmpOutputPath || 'tmp', youtubeVideoId)
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  }
}

export default Media
