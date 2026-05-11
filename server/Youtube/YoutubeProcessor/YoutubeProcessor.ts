import fs from 'fs'
import { rimraf } from 'rimraf'
import youtubedl from 'youtube-dl-exec'
import axios from 'axios'
import FormData from 'form-data'
import { db } from '../../lib/Database.js'
import sql from 'sqlate'
import shell from '../../lib/Shell.js'
import getLogger from '../../lib/Log.js'
import Youtube from '../Youtube.js'
import IPC from '../../lib/IPCBridge.js'
import {
  YOUTUBE_VIDEO_UPDATE
} from '../../../shared/actionTypes.js'

const log = getLogger(`youtube[${process.pid}]`)

interface YoutubeVideo {
  id: number
  youtubeVideoId: string
  userId: number
  url: string
  lyrics: string | null
  karaoke: number
  status: string
}

interface YoutubeDlOption {
  key: string
  value: string | boolean
}

interface YoutubePrefs {
  isYouTubeEnabled: boolean
  isKaraokeGeneratorEnabled: boolean
  isConcurrentAlignmentEnabled: boolean
  spleeterPath: string
  autoLyrixHost: string
  ffmpegPath: string
  youtubeDlExecOptions: YoutubeDlOption[]
  tmpOutputPath: string
  maxYouTubeProcesses: number
}

class YoutubeProcessor extends Youtube {
  isYouTubeEnabled = false
  isKaraokeGeneratorEnabled = false
  isConcurrentAlignmentEnabled = false
  spleeterPath = 'spleeter'
  autoLyrixHost = ''
  ffmpegPath = 'ffmpeg'
  youtubeDlExecOptions: YoutubeDlOption[] = []
  tmpOutputPath = 'tmp'
  maxYouTubeProcesses = 1
  processCount = 0

  constructor (prefs: YoutubePrefs) {
    super()
    this.setPrefs(prefs)
  }

  setPrefs (prefs: YoutubePrefs) {
    this.isYouTubeEnabled = prefs.isYouTubeEnabled
    this.isKaraokeGeneratorEnabled = prefs.isKaraokeGeneratorEnabled
    this.isConcurrentAlignmentEnabled = prefs.isConcurrentAlignmentEnabled
    this.spleeterPath = prefs.spleeterPath
    this.autoLyrixHost = prefs.autoLyrixHost
    this.ffmpegPath = prefs.ffmpegPath
    this.youtubeDlExecOptions = prefs.youtubeDlExecOptions
    this.tmpOutputPath = prefs.tmpOutputPath
    this.maxYouTubeProcesses = Number(prefs.maxYouTubeProcesses) || 1

    if (this.maxYouTubeProcesses < 1) {
      this.maxYouTubeProcesses = 1
    }
  }

  async process () {
    let lastUserId = 0

    while (true) {
      if (!this.isYouTubeEnabled) {
        log.info('YouTube is not enabled. Exiting YouTube processor...')
        return
      }

      log.debug('Looking for the next video while ' + this.processCount + ' other processes are running...')

      const query = sql`
        SELECT youtubeVideos.*,
          CASE WHEN youtubeVideos.userId < ${lastUserId}
            THEN youtubeVideos.userId + 9999999999999
            ELSE youtubeVideos.userId
          END AS position
        FROM youtubeVideos
          INNER JOIN (
            SELECT userId, MIN(id) AS firstId
            FROM youtubeVideos
            WHERE status = 'pending'
            GROUP BY userId
          ) AS firstVideo ON youtubeVideos.id = firstVideo.firstId AND youtubeVideos.userId = firstVideo.userId
        ORDER BY position DESC
        LIMIT 1
      `
      const videos = db.all<YoutubeVideo>(String(query), query.parameters)

      if (videos.length > 0) {
        const video = videos[0]
        lastUserId = video.userId
        this.processCount++

        this.processVideo(video).finally(() => {
          this.processCount--
          log.info('There are now ' + this.processCount + ' processes running')
        })
      } else {
        if (this.processCount === 0) {
          log.info('No more videos to process. Stopping YouTube worker...')
          return
        }
      }

      if (this.isCanceling) {
        log.info('Cancelling youtube worker gracefully...')
        return
      }

      do {
        log.debug('Waiting with ' + this.processCount + ' out of ' + this.maxYouTubeProcesses + ' processes running...')
        await shell.sleep(2000)
      } while (this.processCount >= this.maxYouTubeProcesses)
    }
  }

  async processVideo (video: YoutubeVideo) {
    try {
      log.info('Processing video ID #' + video.id + ' using process #' + this.processCount + '...')

      await IPC.req({
        type: YOUTUBE_VIDEO_UPDATE,
        payload: { video, status: 'downloading' }
      })

      const outputDir = this.tmpOutputPath + '/' + video.youtubeVideoId
      fs.mkdirSync(outputDir, { recursive: true })

      // download the video
      log.info('Downloading video #' + video.id + '...')
      const options: Record<string, unknown> = {
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
        f: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        o: outputDir + '/combined.%(ext)s'
      }

      if (Array.isArray(this.youtubeDlExecOptions)) {
        for (const option of this.youtubeDlExecOptions) {
          if (option && typeof option.key === 'string' && option.key.trim()) {
            options[option.key] = option.value
          }
        }
      }

      await youtubedl(video.url, options)

      // find the downloaded file
      const files = fs.readdirSync(outputDir)
      let downloadedFile: string | null = null
      for (const file of files) {
        if (file.startsWith('combined.')) {
          downloadedFile = outputDir + '/' + file
          break
        }
      }

      if (!downloadedFile || !fs.existsSync(downloadedFile) || fs.statSync(downloadedFile).size < 1000) {
        throw new Error('Problem downloading combined audio and video file from YouTube')
      }

      // separate the audio and video
      await Promise.all([
        shell.promisifiedExec(this.ffmpegPath + ' -y -nostdin -i "' + downloadedFile + '" -vn "' + outputDir + '/audio.mp3"'),
        shell.promisifiedExec(this.ffmpegPath + ' -y -nostdin -i "' + downloadedFile + '" -an -vcodec copy "' + outputDir + '/video.mp4"')
      ])

      if (!fs.existsSync(outputDir + '/audio.mp3') || fs.statSync(outputDir + '/audio.mp3').size < 1000) {
        throw new Error('Problem downloading audio file from YouTube')
      }

      if (!fs.existsSync(outputDir + '/video.mp4') || fs.statSync(outputDir + '/video.mp4').size < 1000) {
        throw new Error('Problem downloading video file from YouTube')
      }

      log.info('Mixing video #' + video.id + '...')
      await IPC.req({
        type: YOUTUBE_VIDEO_UPDATE,
        payload: { video, status: 'processing' }
      })

      if (!video.karaoke) {
        if (this.isConcurrentAlignmentEnabled) {
          const processPromises: Promise<void>[] = [this.splitVocals(outputDir, video)]
          if (video.lyrics) {
            processPromises.push(this.alignLyrics(outputDir, video))
          }
          await Promise.all(processPromises)
        } else {
          await this.splitVocals(outputDir, video)
          if (video.lyrics) {
            await this.alignLyrics(outputDir, video)
          }
        }

        log.info('Finalizing video #' + video.id + '...')

        // Clean up intermediate files (keep audio.mp3 for potential whisper re-alignment)
        try {
          fs.unlinkSync(outputDir + '/video.mp4')
          rimraf(outputDir + '/audio').catch(() => {})
        } catch {
          /* ignore deletion errors */
        }
      } else {
        // pre-made karaoke mix: combine audio/video
        await shell.promisifiedExec(this.ffmpegPath + ' -y -nostdin -i "' + outputDir + '/video.mp4" -i "' + outputDir + '/audio.mp3" -c:v copy -c:a aac "' + outputDir + '/karaoke.mp4"')

        try {
          fs.unlinkSync(outputDir + '/audio.mp3')
          fs.unlinkSync(outputDir + '/video.mp4')
        } catch {
          /* ignore deletion errors */
        }
      }

      if (!fs.existsSync(outputDir + '/karaoke.mp4') || fs.statSync(outputDir + '/karaoke.mp4').size < 1000) {
        throw new Error('Karaoke video could not be created')
      }

      if (!video.karaoke && video.lyrics && (!fs.existsSync(outputDir + '/aligned.txt') || fs.statSync(outputDir + '/aligned.txt').size < 100)) {
        throw new Error('Karaoke lyrics could not be aligned')
      }

      log.info('Successfully processed video ID #' + video.id + '!')
      await IPC.req({
        type: YOUTUBE_VIDEO_UPDATE,
        payload: { video, status: 'ready' }
      })
    } catch (err) {
      log.error('Problem processing video #' + video.id + '...')
      log.error(err)
      await IPC.req({
        type: YOUTUBE_VIDEO_UPDATE,
        payload: { video, status: 'failed' }
      })
    }
  }

  async splitVocals (outputDir: string, video: YoutubeVideo) {
    log.info('Splitting vocals for video #' + video.id + '...')
    await shell.promisifiedExec(this.spleeterPath + ' separate -o "' + outputDir + '" "' + outputDir + '/audio.mp3"')

    if (!fs.existsSync(outputDir + '/audio/vocals.wav') || fs.statSync(outputDir + '/audio/vocals.wav').size < 1000) {
      throw new Error('Could not isolate vocals')
    }

    if (!fs.existsSync(outputDir + '/audio/accompaniment.wav') || fs.statSync(outputDir + '/audio/accompaniment.wav').size < 1000) {
      throw new Error('Could not isolate accompaniment')
    }

    log.info('Successfully split vocals for video ID #' + video.id + '!')
    log.info('Combining audio/video for video ID #' + video.id + '!')
    await shell.promisifiedExec(this.ffmpegPath + ' -y -nostdin -i "' + outputDir + '/video.mp4" -i "' + outputDir + '/audio/accompaniment.wav" -c:v copy -c:a aac "' + outputDir + '/karaoke.mp4"')
  }

  async alignLyrics (outputDir: string, video: YoutubeVideo) {
    log.info('Aligning lyrics for video #' + video.id + '...')

    // Use Whisper-based alignment for non-Latin lyrics (Russian, Chinese, etc.)
    const hasNonLatin = /[^\u0000-\u024F\u1E00-\u1EFF]/.test(video.lyrics!)
    if (hasNonLatin) {
      return this.alignLyricsWhisper(outputDir, video)
    }

    const form = new FormData()
    form.append('audio_file', fs.createReadStream(outputDir + '/audio.mp3'))
    form.append('lyrics', video.lyrics)
    form.append('format', 'json')

    const result = await axios.post(
      this.autoLyrixHost + '/align',
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        transformResponse: []
      }
    )

    if (result && result.status === 200 && Array.isArray(JSON.parse(result.data))) {
      fs.writeFileSync(outputDir + '/aligned.txt', result.data)
      log.info('Successfully aligned lyrics for video ID #' + video.id + '!')
    } else {
      throw new Error('AutoAlignLyrix Service failed. Maybe try testing the configuration.')
    }
  }

  async alignLyricsWhisper (outputDir: string, video: YoutubeVideo) {
    log.info('Using Whisper alignment for non-Latin lyrics (video #' + video.id + ')...')

    const lyricsPath = outputDir + '/lyrics_input.txt'
    const alignedPath = outputDir + '/aligned.txt'
    fs.writeFileSync(lyricsPath, video.lyrics!)

    await shell.promisifiedExec(
      'whisper-align "' + outputDir + '/audio.mp3" "' + lyricsPath + '" "' + alignedPath + '" small'
    )

    if (!fs.existsSync(alignedPath) || fs.statSync(alignedPath).size < 100) {
      throw new Error('Whisper alignment failed for video #' + video.id)
    }

    const data = JSON.parse(fs.readFileSync(alignedPath, 'utf-8'))
    if (!Array.isArray(data)) {
      throw new Error('Whisper alignment produced invalid output for video #' + video.id)
    }

    log.info('Successfully aligned lyrics with Whisper for video ID #' + video.id + '!')
  }
}

export default YoutubeProcessor
