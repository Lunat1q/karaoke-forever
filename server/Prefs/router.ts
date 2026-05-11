import path from 'path'
import getLogger from '../lib/Log.js'
import KoaRouter from '@koa/router'
import getFolders from '../lib/getFolders.js'
import getWindowsDrives from '../lib/getWindowsDrives.js'
import Prefs from './Prefs.js'
import Media from '../Media/Media.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import Rooms from '../Rooms/Rooms.js'
import Queue from '../Queue/Queue.js'
import { PREFS_PATHS_CHANGED, QUEUE_PUSH } from '../../shared/actionTypes.js'
import type { Prefs as PrefsType } from '../../shared/types.js'

interface RequestWithBody {
  body: Record<string, unknown>
}

const log = getLogger('Prefs')
const router = new KoaRouter({ prefix: '/api/prefs' })

// get all prefs (including media paths)
router.get('/', (ctx) => {
  const prefs = Prefs.get() as unknown as PrefsType

  // only include public prefs if not an admin or first-run
  if (!prefs.isFirstRun && !ctx.user.isAdmin) {
    ctx.body = Prefs.get(true)
  } else {
    ctx.body = prefs
  }
})

// add a media path
router.post('/path', (ctx) => {
  const dir = decodeURIComponent(ctx.query.dir as string)

  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  // required
  if (!dir) {
    ctx.throw(422, 'Invalid path')
  }

  const pathId = Prefs.addPath(dir, {
    prefs: (ctx.request as unknown as RequestWithBody).body,
  })

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher
  process.emit(PREFS_PATHS_CHANGED, prefs.paths)

  ctx.startScanner(pathId)
})

// set media path preferences
router.put('/path/:pathId', (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const pathId = parseInt(ctx.params.pathId, 10)

  if (isNaN(pathId)) {
    ctx.throw(422, 'Invalid pathId')
  }

  Prefs.setPathData(pathId, 'prefs.', (ctx.request as unknown as RequestWithBody).body)

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher?
  if ('isWatchingEnabled' in (ctx.request as unknown as RequestWithBody).body) {
    process.emit(PREFS_PATHS_CHANGED, prefs.paths)
  }

  // need to push updated queue items?
  if ('isVideoKeyingEnabled' in (ctx.request as unknown as RequestWithBody).body) {
    for (const { room, roomId } of Rooms.getActive(ctx.io)) {
      ctx.io.to(room).emit('action', {
        type: QUEUE_PUSH,
        payload: Queue.get(roomId),
      })
    }
  }
})

// remove a media path
router.delete('/path/:pathId', (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const pathId = parseInt(ctx.params.pathId, 10)

  if (isNaN(pathId)) {
    ctx.throw(422, 'Invalid pathId')
  }

  ctx.stopScanner()

  Prefs.removePath(pathId)

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher
  process.emit(PREFS_PATHS_CHANGED, prefs.paths)

  Media.cleanup()

  pushQueuesAndLibrary(ctx.io)
})

// scan a media path
router.get('/path/:pathId/scan', async (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const pathId = parseInt(ctx.params.pathId, 10)

  if (isNaN(pathId)) {
    ctx.throw(422, 'Invalid pathId')
  }

  ctx.status = 200
  ctx.startScanner(pathId)
})

// scan all media paths
router.get('/paths/scan', async (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  ctx.status = 200
  ctx.startScanner(true)
})

// stop scanning
router.get('/paths/scan/stop', async (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  ctx.status = 200
  ctx.stopScanner()
})

// get folder listing for path browser
router.get('/path/ls', async (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const dir = decodeURIComponent(ctx.query.dir as string)

  // windows is a special snowflake and gets an
  // extra top level of available drive letters
  if (dir === '' && process.platform === 'win32') {
    const drives = getWindowsDrives()

    ctx.body = {
      current: '',
      parent: false,
      children: drives,
    }
  } else {
    const current = path.resolve(dir)
    const parent = path.resolve(dir, '../')

    const list = await getFolders(dir)
    log.verbose('%s listed path: %s', ctx.user.name, current)

    ctx.body = {
      current,
      // if at root, windows gets a special top level
      parent: parent === current ? (process.platform === 'win32' ? '' : false) : parent,
      children: list.map(p => ({
        path: p,
        label: p.replace(current + path.sep, ''),
      })).filter(c => !(c.label.startsWith('.') || c.label.startsWith('/.'))),
    }
  }
})

// test spleeter
router.get('/testspleeter', async (ctx) => {
  if (!ctx.user.isAdmin) ctx.throw(401)

  const prefs = Prefs.get() as any
  try {
    const { execSync } = await import('child_process')
    const result = execSync(prefs.spleeterPath + ' --version', { encoding: 'utf-8' }).trim()

    if (result.toLowerCase().startsWith('spleeter version: ')) {
      const version = result.substring(18)
      ctx.body = {
        success: version.startsWith('2.'),
        message: version.startsWith('2.')
          ? 'Spleeter ' + version + ' was found!'
          : 'Spleeter ' + version + ' was found. This might work, but we expected v2.x.x'
      }
    } else {
      ctx.body = { success: false, message: 'Something\'s wrong... ' + result }
    }
  } catch (err) {
    ctx.body = { success: false, message: err.message }
  }
})

// test AutoLyrixAlign Service
router.get('/testautolyrix', async (ctx) => {
  if (!ctx.user.isAdmin) ctx.throw(401)

  const prefs = Prefs.get() as any
  try {
    const result = await fetch(prefs.autoLyrixHost + '/version')
    const text = await result.text()

    if (result.ok && text.toLowerCase().startsWith('autolyrixalignservice ')) {
      const version = text.substring(22)
      ctx.body = {
        success: version.startsWith('1.'),
        message: version.startsWith('1.')
          ? 'AutoLyrixAlign Service ' + version + ' was found!'
          : 'AutoLyrixAlign Service ' + version + ' was found. This might work, but we expected v1.x.x'
      }
    } else {
      ctx.body = { success: false, message: 'Doesn\'t look like AutoLyrixAlign Service. Got: ' + text }
    }
  } catch (err) {
    ctx.body = { success: false, message: err.message }
  }
})

// test ffmpeg
router.get('/testffmpeg', async (ctx) => {
  if (!ctx.user.isAdmin) ctx.throw(401)

  const prefs = Prefs.get() as any
  try {
    const { execSync } = await import('child_process')
    const result = execSync(prefs.ffmpegPath + ' -version', { encoding: 'utf-8' }).trim()

    if (result.toLowerCase().startsWith('ffmpeg version ')) {
      let version = result.substring(15)
      version = version.substring(0, version.search(/\s/g)).trim()
      ctx.body = {
        success: true,
        message: 'FFMPEG ' + version + ' was found!'
      }
    } else {
      ctx.body = { success: false, message: 'Something\'s wrong... ' + result }
    }
  } catch (err) {
    ctx.body = { success: false, message: err.message }
  }
})

export default router
