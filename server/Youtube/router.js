import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import getLogger from '../lib/Log.js'
import KoaRouter from '@koa/router'
import Prefs from '../Prefs/Prefs.js'

const stat = promisify(fs.stat)
const log = getLogger('Youtube')
const router = new KoaRouter({ prefix: '/api/youtube' })

// stream a youtube karaoke.mp4 file
router.get('/:youtubeVideoId', async (ctx, next) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  // get base path
  const { tmpOutputPath } = await Prefs.get()

  const file = path.join(tmpOutputPath, ctx.params.youtubeVideoId, 'karaoke.mp4')

  if (!fs.existsSync(file)) {
    ctx.throw(404, 'The karaoke.mp4 file could not be found')
  }

  // get file info
  const stats = await stat(file)
  ctx.length = stats.size
  ctx.type = 'video/mp4'

  log.verbose('streaming %s (%sMB): %s', ctx.type, (ctx.length / 1000000).toFixed(2), file)
  ctx.body = fs.createReadStream(file)
})

export default router
