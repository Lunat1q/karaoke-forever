import { initLogger } from './lib/Log.js'
import path from 'path'
import env from './lib/cli.js'

const log = initLogger('youtube', {
  console: { level: 4 },
  file: { level: 3 },
}).scope(`youtube[${process.pid}]`)

const { open } = await import('./lib/Database.js')
const { default: IPC } = await import('./lib/IPCBridge.js')
const { YOUTUBE_CMD_STOP, YOUTUBE_CMD_UPDATE } = await import('../shared/actionTypes.js')
const { default: Prefs } = await import('./Prefs/Prefs.js')
const { default: YoutubeProcessor } = await import('./Youtube/YoutubeProcessor/index.js')

let _Processor

open({ file: path.join(env.KES_PATH_DATA, 'database.sqlite3'), ro: true })

IPC.use({
  [YOUTUBE_CMD_STOP]: async () => {
    log.info('Stopping YouTube processor gracefully')
    cancelProcessing()
  },
  [YOUTUBE_CMD_UPDATE]: async () => {
    log.info('Updating YouTube processor')
    update()
  }
})

startProcessing()

async function startProcessing () {
  log.info('Starting YouTube processor')

  const prefs = await Prefs.get()
  _Processor = new YoutubeProcessor(prefs)
  await _Processor.process()

  process.exit()
}

async function update () {
  log.info('Updating YouTube processor')

  if (_Processor) {
    const prefs = await Prefs.get()
    _Processor.setPrefs(prefs)
  } else {
    startProcessing()
  }
}

function cancelProcessing () {
  if (_Processor) {
    _Processor.cancel()
  }
}
