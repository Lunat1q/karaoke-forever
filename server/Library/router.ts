import KoaRouter from '@koa/router'
import sql from 'sqlate'
import { db } from '../lib/Database.js'
import Media from '../Media/Media.js'
import Prefs from '../Prefs/Prefs.js'
const router = new KoaRouter({ prefix: '/api' })

// lists underlying media for a given song
router.get('/song/:songId', async (ctx) => {
  // must be admin
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const songId = parseInt(ctx.params.songId, 10)

  if (Number.isNaN(songId)) {
    ctx.throw(401, 'Invalid songId')
  }

  const res = Media.search({ songId })

  if (!res.result.length) {
    ctx.throw(404)
  }

  ctx.body = res
})

// searches YouTube for videos
router.post('/youtubesearch', async (ctx) => {
  const prefs = Prefs.get() as any
  const searchQuery = ((ctx.request as any).body as any).query as string

  const containsKaraoke = searchQuery.toLowerCase().includes('karaoke')
  const queries: string[] = []

  if (prefs.isKaraokeGeneratorEnabled || containsKaraoke) {
    queries.push(searchQuery)
  }

  if (!containsKaraoke) {
    queries.push(searchQuery + ' karaoke')
  }

  if (prefs.isKaraokeGeneratorEnabled && containsKaraoke) {
    queries.push(searchQuery.replace(/karaoke/gi, ''))
  }

  let youtubesearchapi
  try {
    youtubesearchapi = (await import('youtube-search-api')).default
  } catch {
    ctx.throw(500, 'youtube-search-api package not installed')
    return
  }

  const queryPromises = queries.map(query => {
    return youtubesearchapi.GetListByKeyword(query, false, 20, [{ type: 'video' }])
      .then(result => {
        result.originalQuery = query
        result.items.forEach(item => {
          item.bestThumbnail = item.thumbnail.thumbnails.reduce((best, current) => {
            return (current.width > best.width) ? current : best
          }, { width: 0 })
          item.duration = item.length.simpleText
          item.url = `https://www.youtube.com/watch?v=${item.id}`
        })
        return result
      })
  })

  const searchResults = await Promise.all(queryPromises)

  // get videos queued in this room
  const queueQuery = sql`
    SELECT youtubeVideoId
    FROM queue
    WHERE youtubeVideoId IS NOT NULL AND roomId = ${ctx.user.roomId}
  `
  const rows = db.all<{ youtubeVideoId: string }>(String(queueQuery), queueQuery.parameters)
  const queuedVideoIds = rows.map(row => row.youtubeVideoId)

  const { durationToSeconds } = await import('../lib/DateTime.js')

  const cleanResults = searchResults.map(searchResult => {
    return searchResult.items.filter((video) => {
      const karaokeSearched = searchResult.originalQuery.toLowerCase().includes('karaoke')
      const karaokeFound = video.title.toLowerCase().includes('karaoke')
      return (video.channelTitle && !video.isLive && video.bestThumbnail && durationToSeconds(video.duration) < 600 && karaokeSearched === karaokeFound)
    }).map((video) => ({
      id: video.id,
      url: video.url,
      title: video.title,
      duration: video.duration,
      thumbnail: video.bestThumbnail.url,
      channel: video.channelTitle,
      karaoke: video.title.toLowerCase().includes('karaoke'),
      queued: queuedVideoIds.includes(video.id),
    }))
  })

  // combine results from queries together
  const totalReturnItemsCount = 20
  const itemsFromEach = Math.ceil(totalReturnItemsCount / queries.length)
  const returnResults: any[] = []
  for (let x = 0; x < itemsFromEach; x++) {
    cleanResults.forEach(results => {
      if (results.length > x) {
        returnResults.push(results[x])
      }
    })
  }

  // remove duplicates
  const existingIds: string[] = []
  ctx.body = returnResults.filter(video => {
    if (!existingIds.includes(video.id)) {
      existingIds.push(video.id)
      return true
    }
    return false
  })
})

// identifies song details for a YouTube video
router.post('/youtubeidentify', async (ctx) => {
  const body = (ctx.request as any).body

  let getArtistTitle
  try {
    getArtistTitle = (await import('get-artist-title')).default
  } catch {
    ctx.throw(500, 'get-artist-title package not installed')
    return
  }

  let [artist, title] = getArtistTitle(body.video.title, {
    defaultArtist: body.video.channel
  })

  if (body.artist !== undefined) artist = body.artist
  if (body.title !== undefined) title = body.title

  const parts: string[] = []
  if (artist) parts.push(artist)
  if (title) parts.push(title)
  const query = parts.join(' - ')

  ctx.body = {
    artist,
    title,
    songs: [],
    lyrics: ''
  }

  // if pre-made karaoke, we're done
  if (body.video.karaoke) return

  try {
    const Genius = (await import('genius-lyrics')).default
    const Client = new Genius.Client()
    const songs = await Client.songs.search(query)

    ctx.body.songs = await Promise.all(songs.map(async (song) => {
      const lyrics = await song.lyrics()
      return {
        id: song.id,
        title: song.title,
        artist: { id: song.artist.id, name: song.artist.name },
        lyrics,
      }
    }))

    if (body.songID) {
      ctx.body.songs = ctx.body.songs.filter((song) => song.id === body.songID)
    }

    if (ctx.body.songs.length === 1) {
      try {
        ctx.body.artist = ctx.body.songs[0].artist.name
        ctx.body.title = ctx.body.songs[0].title
        ctx.body.lyrics = await ctx.body.songs[0].lyrics
      } catch { /* ignore and return empty lyrics */ }
    }
  } catch (err) {
    if (err.message === 'No result was found') {
      ctx.body = { artist, title, songs: [], lyrics: '' }
    }
  }
})

export default router
