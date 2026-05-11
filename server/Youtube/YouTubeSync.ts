/**
 * Syncs processed YouTube videos to the media library folder.
 *
 * For each "ready" video in the DB:
 *  - Runs Whisper forced-alignment for non-Latin lyrics if needed
 *  - Burns aligned lyrics into karaoke.mp4 as ASS subtitles via ffmpeg
 *  - Copies the result to the media library folder
 *  - Cleans up stale files
 *
 * Runs periodically (every 2 minutes) from within the app.
 */
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { DatabaseSync } from 'node:sqlite'
import getLogger from '../lib/Log.js'

const log = getLogger('YouTubeSync')

const WHISPER_MODEL = process.env.WHISPER_MODEL || 'medium'

interface ReadyVideo {
  youtubeVideoId: string
  artist: string
  title: string
  lyrics: string | null
}

function sanitize (name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, ' ').trim()
}

function hasNonLatinChars (text: string): boolean {
  return /[а-яА-ЯёЁ\u3000-\u9FFF\uAC00-\uD7AF]/.test(text)
}

function formatTime (seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h + ':' + String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0')
}

function generateASS (alignedData: string): string {
  const lines: Array<Array<{ word: string, start: number | null, end: number | null, ignore?: boolean }>> = JSON.parse(alignedData)
  let events = ''

  for (const line of lines) {
    if (!line.length) continue
    const timedWords = line.filter(w => !w.ignore && w.start !== null)
    if (!timedWords.length) continue

    const lineStart = timedWords[0].start!
    const lineEnd = (timedWords[timedWords.length - 1].end ?? lineStart + 3)

    let karaokeText = ''
    let prevEnd = lineStart

    for (const w of line) {
      if (w.ignore) {
        karaokeText += w.word + ' '
        continue
      }
      const wordStart = w.start ?? prevEnd
      const wordEnd = w.end ?? wordStart + 0.5
      const gap = Math.max(0, Math.round((wordStart - prevEnd) * 100))
      if (gap > 0) karaokeText += '{\\k' + gap + '}'
      const dur = Math.max(1, Math.round((wordEnd - wordStart) * 100))
      karaokeText += '{\\kf' + dur + '}' + w.word + ' '
      prevEnd = wordEnd
    }

    events += 'Dialogue: 0,' + formatTime(lineStart) + ',' + formatTime(lineEnd + 0.5) +
      ',Default,,0,0,0,,' + karaokeText.trim() + '\n'
  }

  return '[Script Info]\n' +
    'Title: Karaoke Lyrics\n' +
    'ScriptType: v4.00+\n' +
    'WrapStyle: 0\n' +
    'ScaledBorderAndShadow: yes\n' +
    'PlayResX: 1920\n' +
    'PlayResY: 1080\n\n' +
    '[V4+ Styles]\n' +
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
    'Style: Default,Arial,60,&H00FFFFFF,&H0000A0D9,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,60,1\n\n' +
    '[Events]\n' +
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' +
    events
}

/** The inline Python code for Whisper forced-alignment (same as YoutubeProcessor) */
const WHISPER_PYTHON_CODE = `
import sys, json, os, stable_whisper

audio_path, lyrics_path, output_path, model_size = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "small"

with open(lyrics_path, "r", encoding="utf-8") as f:
    lyrics_text = f.read().strip()

if not lyrics_text:
    print("ERROR: lyrics file is empty", file=sys.stderr)
    sys.exit(1)

original_lines = [l.strip() for l in lyrics_text.splitlines() if l.strip()]

cache_dir = os.environ.get("WHISPER_CACHE_DIR", "/data/whisper-models")
os.makedirs(cache_dir, exist_ok=True)

model = stable_whisper.load_faster_whisper(model_size, download_root=cache_dir)

has_cyrillic = any("\\u0400" <= c <= "\\u04FF" for c in lyrics_text)
lang = "ru" if has_cyrillic else "en"
result = model.align(audio_path, lyrics_text, language=lang)

all_words = []
for seg in result.segments:
    for w in seg.words:
        t = w.word.strip()
        if t:
            all_words.append({"word": t, "start": round(w.start, 2), "end": round(w.end, 2), "ignore": False})

aligned = []
idx = 0
for line_text in original_lines:
    line_aligned = []
    for _ in line_text.split():
        if idx < len(all_words):
            line_aligned.append(all_words[idx])
            idx += 1
    if line_aligned:
        aligned.append(line_aligned)

if idx < len(all_words):
    aligned.append(all_words[idx:])

for line in aligned:
    for i, w in enumerate(line):
        if w["end"] - w["start"] < 0.01:
            prev_end = line[i - 1]["end"] if i > 0 else w["start"]
            next_start = line[i + 1]["start"] if i + 1 < len(line) else w["start"] + 0.3
            gap = next_start - prev_end
            if gap > 0.05:
                w["start"] = prev_end
                w["end"] = prev_end + min(gap, 0.3)
            else:
                w["end"] = w["start"] + 0.2

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(aligned, f, ensure_ascii=False)

print(f"Done: {sum(len(l) for l in aligned)} words in {len(aligned)} lines")
`

function runWhisperAlign (audioPath: string, lyricsText: string, srcDir: string): void {
  const lyricsPath = path.join(srcDir, 'lyrics_input.txt')
  const outputPath = path.join(srcDir, 'whisper_aligned.txt')

  fs.writeFileSync(lyricsPath, lyricsText)

  execFileSync('/opt/spleeter-venv/bin/python3', [
    '-c', WHISPER_PYTHON_CODE, audioPath, lyricsPath, outputPath, WHISPER_MODEL
  ], { timeout: 900000 })
}

export function syncYouTubeToLibrary (dbPath: string, mediaDir: string, tmpDir: string) {
  const db = new DatabaseSync(dbPath, { open: true })

  let videos: ReadyVideo[]
  try {
    videos = db.prepare(
      "SELECT youtubeVideoId, artist, title, lyrics FROM youtubeVideos WHERE status='ready'"
    ).all() as ReadyVideo[]
  } finally {
    db.close()
  }

  fs.mkdirSync(mediaDir, { recursive: true })

  const expectedFiles = new Set<string>()
  let created = 0
  let skipped = 0

  for (const video of videos) {
    const srcDir = path.join(tmpDir, video.youtubeVideoId)
    const srcVideo = path.join(srcDir, 'karaoke.mp4')
    const srcAudio = path.join(srcDir, 'audio.mp3')
    const srcLyrics = path.join(srcDir, 'aligned.txt')
    const whisperLyrics = path.join(srcDir, 'whisper_aligned.txt')
    const filename = sanitize(video.artist) + ' - ' + sanitize(video.title) + '.mp4'
    const dest = path.join(mediaDir, filename)
    expectedFiles.add(filename)

    if (!fs.existsSync(srcVideo)) {
      log.verbose('SKIP (no video): ' + video.youtubeVideoId)
      skipped++
      continue
    }

    // Run Whisper forced alignment for non-Latin lyrics if audio.mp3 exists
    if (video.lyrics && hasNonLatinChars(video.lyrics) && !fs.existsSync(whisperLyrics) && fs.existsSync(srcAudio)) {
      try {
        log.info('WHISPER ALIGN: ' + video.artist + ' - ' + video.title)
        runWhisperAlign(srcAudio, video.lyrics, srcDir)
        log.info('WHISPER DONE: ' + video.youtubeVideoId)

        // Replace aligned.txt so the queue player also uses Whisper alignment
        try { fs.copyFileSync(whisperLyrics, srcLyrics) } catch { /* ignore */ }
        // Remove old dest so it gets re-created with Whisper lyrics
        if (fs.existsSync(dest)) {
          try { fs.unlinkSync(dest) } catch { /* ignore */ }
        }
      } catch (err: any) {
        log.error('WHISPER ERROR: ' + video.youtubeVideoId + ' ' + (err.message ? err.message.substring(0, 200) : ''))
      }
    }

    if (fs.existsSync(dest)) {
      skipped++
      continue
    }

    // Prefer Whisper alignment over AutoLyrixAlign
    const alignmentFile = fs.existsSync(whisperLyrics) ? whisperLyrics : srcLyrics

    if (fs.existsSync(alignmentFile)) {
      try {
        const alignedData = fs.readFileSync(alignmentFile, 'utf8')
        const assContent = generateASS(alignedData)
        const assPath = path.join(srcDir, 'lyrics.ass')
        fs.writeFileSync(assPath, assContent)

        log.info('BURNING LYRICS: ' + filename)
        execFileSync('ffmpeg', [
          '-y', '-nostdin', '-i', srcVideo,
          '-vf', 'ass=' + assPath,
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
          '-c:a', 'copy', dest
        ], { timeout: 600000 })
        log.info('CREATED: ' + filename)
        created++
      } catch (err: any) {
        log.error('ERROR burning lyrics: ' + filename + ' ' + (err.message ? err.message.substring(0, 200) : ''))
        try { fs.symlinkSync(srcVideo, dest); log.info('FALLBACK SYMLINK: ' + filename); created++ } catch { /* ignore */ }
      }
    } else {
      fs.symlinkSync(srcVideo, dest)
      log.info('LINKED (no lyrics): ' + filename)
      created++
    }
  }

  // Clean up stale files
  if (fs.existsSync(mediaDir)) {
    for (const file of fs.readdirSync(mediaDir)) {
      if (!expectedFiles.has(file)) {
        try { fs.unlinkSync(path.join(mediaDir, file)); log.info('CLEANED: ' + file) } catch { /* ignore */ }
      }
    }
  }

  log.info('Sync done: ' + created + ' created, ' + skipped + ' skipped, ' + videos.length + ' total ready')
}

let syncTimer: ReturnType<typeof setInterval> | null = null

/**
 * Start a periodic sync loop (every 2 minutes).
 */
export function startSyncLoop (dbPath: string, mediaDir: string, tmpDir: string) {
  if (syncTimer) return

  log.info('Starting YouTube sync loop (every 2 minutes)')

  syncTimer = setInterval(() => {
    try {
      syncYouTubeToLibrary(dbPath, mediaDir, tmpDir)
    } catch (err: any) {
      log.error('Sync error: ' + err.message)
    }
  }, 120_000)
}

/**
 * Stop the periodic sync loop.
 */
export function stopSyncLoop () {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}
