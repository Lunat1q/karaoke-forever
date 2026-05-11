import sql from 'sqlate'
import { db } from '../lib/Database.js'
import Queue from './Queue.js'
import Rooms from '../Rooms/Rooms.js'
import Media from '../Media/Media.js'
import { QUEUE_ADD, QUEUE_MOVE, QUEUE_REMOVE, QUEUE_PUSH } from '../../shared/actionTypes.js'

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [QUEUE_ADD]: async (sock, { payload }, acknowledge) => {
    const { songId, youtubeVideoId } = payload

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_ADD + '_ERROR',
        error: err.message,
      })
    }

    Queue.add({
      roomId: sock.user.roomId,
      songId,
      userId: sock.user.userId,
      youtubeVideoId,
    })

    // if this is a youtube video, also insert into youtubeVideos table
    if (youtubeVideoId) {
      // see if it is already in the database
      const youtubeCheckQuery = sql`
        SELECT *
        FROM youtubeVideos
        WHERE youtubeVideoId = ${youtubeVideoId}
      `
      const rows = db.all<any>(String(youtubeCheckQuery), youtubeCheckQuery.parameters)

      let processVideo = true
      if (rows.length) {
        let video = rows.length === 1 ? rows[0] : null

        // if the video failed (or somehow we have multiple), delete and re-process
        if (video === null || video.status === 'failed') {
          const deleteQuery = sql`
            DELETE FROM youtubeVideos
            WHERE youtubeVideoId = ${youtubeVideoId}
          `
          const deleteRes = db.run(String(deleteQuery), deleteQuery.parameters)

          if (!deleteRes.changes) {
            sock.emit('toast', {
              content: 'This video had already failed, and we couldn\'t retry it.',
              type: 'error'
            })
            return
          }
        } else {
          processVideo = false
          sock.emit('toast', { content: '😎 This video is already ' + video.status + '!' })
        }
      }

      if (processVideo) {
        const youtubeInsertFields = new Map()
        youtubeInsertFields.set('youtubeVideoId', payload.youtubeVideoId)
        youtubeInsertFields.set('userId', sock.user.userId)
        youtubeInsertFields.set('thumbnail', payload.thumbnail)
        youtubeInsertFields.set('url', payload.url)
        youtubeInsertFields.set('duration', payload.duration)
        youtubeInsertFields.set('artist', payload.artist)
        youtubeInsertFields.set('title', payload.title)
        youtubeInsertFields.set('lyrics', payload.lyrics)
        youtubeInsertFields.set('karaoke', payload.karaoke)
        youtubeInsertFields.set('status', 'pending')

        const youtubeInsertQuery = sql`
          INSERT INTO youtubeVideos ${sql.tuple(Array.from(youtubeInsertFields.keys()).map(sql.column))}
          VALUES ${sql.tuple(Array.from(youtubeInsertFields.values()))}
        `
        const youtubeInsertRes = db.run(String(youtubeInsertQuery), youtubeInsertQuery.parameters)

        if (youtubeInsertRes.changes !== 1) {
          throw new Error('Could not add YouTube video')
        }
      }

      // make sure the youtube processor is running
      try {
        const YoutubeProcessManager = require('../Youtube/YoutubeProcessManager')
        YoutubeProcessManager.startYoutubeProcessor()
      } catch { /* YouTube module may not be available */ }
    }

    // success
    acknowledge({ type: QUEUE_ADD + '_SUCCESS' })

    // to all in room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_MOVE]: async (sock, { payload }, acknowledge) => {
    const { queueId, prevQueueId } = payload

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: err.message,
      })
    }

    if (!sock.user.isAdmin && !(Queue.isOwner(sock.user.userId, queueId))) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: 'Cannot move another user\'s song',
      })
    }

    Queue.move({
      prevQueueId,
      queueId,
      roomId: sock.user.roomId,
    })

    // success
    acknowledge({ type: QUEUE_MOVE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_REMOVE]: (sock, { payload }, acknowledge) => {
    const { queueId } = payload
    const ids = Array.isArray(queueId) ? queueId : [queueId]

    if (!sock.user.isAdmin && !(Queue.isOwner(sock.user.userId, ids))) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: 'Cannot remove another user\'s song',
      })
    }

    // check for YouTube videos before removing
    for (const id of ids) {
      const queueQuery = sql`
        SELECT *
        FROM queue
        WHERE queueId = ${id}
      `
      const queueItem = db.get<any>(String(queueQuery), queueQuery.parameters)

      Queue.remove(id)

      // cleanup YouTube video if applicable
      if (queueItem && queueItem.youtubeVideoId) {
        const youtubeQuery = sql`
          SELECT *
          FROM youtubeVideos
          WHERE youtubeVideoId = ${queueItem.youtubeVideoId}
        `
        const video = db.get<any>(String(youtubeQuery), youtubeQuery.parameters)

        if (video) {
          Media.updateYoutubeVideo({ video }, sock.server)
        }
      }
    }

    // success
    acknowledge({ type: QUEUE_REMOVE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
}

export default ACTION_HANDLERS
