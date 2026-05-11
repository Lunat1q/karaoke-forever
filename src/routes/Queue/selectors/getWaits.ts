import { RootState } from 'store/store'
import { createSelector } from '@reduxjs/toolkit'
import getPlayerHistory from './getPlayerHistory'
import getRoundRobinQueue from './getRoundRobinQueue'


const getPosition = (state: RootState) => state.status.position
const getQueue = (state: RootState) => getRoundRobinQueue(state)
const getQueueId = (state: RootState) => state.status.queueId
const getSongs = (state: RootState) => state.songs

const getWaits = createSelector(
  [getQueue, getQueueId, getPlayerHistory, getPosition, getSongs],
  (queue, queueId, history, position, songs) => {
    const curIdx = queue.result.indexOf(queueId)
    const waits: Record<number, number> = {}
    let curWait = 0
    let nextWait = 0

    queue.result.forEach((queueId, i) => {
      const item = queue.entities[queueId] as any
      const songId = item.songId
      const isYouTube = item.mediaType === 'youtube'

      let duration: number
      if (isYouTube) {
        duration = item.youtubeVideoDuration || 0
      } else {
        if (!songs.entities[songId]) return
        duration = songs.entities[songId].duration
      }

      if (i === curIdx) {
        // if history includes the current item it's already been played
        if (history.lastIndexOf(queueId) === -1) {
          nextWait = Math.round(duration - position)
        }
      } else if (i > curIdx) {
        // upcoming
        curWait += nextWait
        nextWait = duration
      }

      waits[queueId] = curWait
    })

    return waits
  },
)

export default getWaits
