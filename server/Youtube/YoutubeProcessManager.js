import sql from 'sqlate'
import env from '../lib/cli.js'
import getLogger from '../lib/Log.js'
import IPC from '../lib/IPCBridge.js'
import childProcess from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  YOUTUBE_CMD_STOP,
  YOUTUBE_CMD_UPDATE,
} from '../../shared/actionTypes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const log = getLogger(`main[${process.pid}]`)

let youtubeProcess = null

const resetProcessingVideos = async () => {
  // reset videos left in any sort of processing state...
  const { db } = await import('../lib/Database.js')
  log.info('Resetting YouTube videos left processing')
  const query = sql`
    UPDATE youtubeVideos SET status='pending'
    WHERE status NOT IN ('pending', 'ready', 'failed')
  `
  await db.run(String(query))
}

const startYoutubeProcessor = async () => {
  if (youtubeProcess === null) {
    await resetProcessingVideos()
    log.info('Starting YouTube processor')
    let options = { env: { ...env, KF_CHILD_PROCESS: 'youtube' } }
    if (process.env.NODE_ENV === 'development') {
      options.execArgv = ['--inspect=5724']
    }

    youtubeProcess = childProcess.fork(path.join(__dirname, '..', 'youtubeWorker.js'), [], options)

    youtubeProcess.on('exit', (code, signal) => {
      log.info(`YouTube processor exited (${signal || code})`)
      IPC.removeChild(youtubeProcess)
      youtubeProcess = null
    })

    IPC.addChild(youtubeProcess)
  } else {
    log.info('YouTube processor already running')
  }
}

const updateYoutubeProcessor = () => {
  log.info('Updating YouTube processor')
  if (youtubeProcess === null) {
    startYoutubeProcessor()
  } else {
    IPC.send({ type: YOUTUBE_CMD_UPDATE })
  }
}

const stopYoutubeProcessor = () => {
  if (youtubeProcess) {
    IPC.send({ type: YOUTUBE_CMD_STOP })
  }
}

const killYoutubeProcess = () => {
  if (youtubeProcess) {
    youtubeProcess.kill()
  }
}

export { startYoutubeProcessor, stopYoutubeProcessor, killYoutubeProcess, updateYoutubeProcessor }
