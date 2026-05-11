import React, { useState, useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import PaddedList from 'components/PaddedList/PaddedList'
import styles from './YouTubeIdentify.css'
import ColorCycle from '../../../Player/components/PlayerTextOverlay/ColorCycle'
import HttpApi from 'lib/HttpApi'
import { durationToSeconds } from 'lib/dateTime'
import { queueYoutubeVideo } from 'routes/Queue/modules/queue'
import YouTubeSongItem, { type YouTubeSong, ITEM_HEIGHT as SONG_ITEM_HEIGHT } from '../YouTubeSongItem'
import type { YouTubeVideo } from '../YouTubeItem'
import type { UIState } from 'store/modules/ui'

const api = new HttpApi('')

interface YouTubeIdentifyRowProps {
  index: number
  style: React.CSSProperties
  songs: YouTubeSong[]
  onSongTap: (song: YouTubeSong) => void
}

const YouTubeIdentifyRow = ({ index, style, songs, onSongTap }: YouTubeIdentifyRowProps) => {
  const song = songs[index]
  return (
    <YouTubeSongItem
      key={song.id}
      song={song}
      style={style}
      onSongTap={onSongTap}
    />
  )
}

interface YouTubeIdentifyProps {
  query: string
  video: YouTubeVideo
  ui: UIState
  onQueued: () => void
  onCancel: () => void
}

const YouTubeIdentify = ({ query, video, ui, onQueued, onCancel }: YouTubeIdentifyProps) => {
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [manual, setManual] = useState(false)
  const [added, setAdded] = useState(false)
  const [songs, setSongs] = useState<YouTubeSong[]>([])
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')
  const [lyrics, setLyrics] = useState('')

  const performIdentification = useCallback((songID: number | null = null, includeArtistTitle = true) => {
    const body: Record<string, unknown> = { video, songID }

    if (includeArtistTitle) {
      body.artist = artist
      body.title = title
    }

    api.post('youtubeidentify', { body })
      .then((response: any) => {
        setSongs(response.songs)
        setLyrics(response.lyrics)
        setLoading(false)
        setArtist(response.artist)
        setTitle(response.title)

        if (songID && response.lyrics) {
          // useLyrics inline since we have the fresh values
          dispatch(queueYoutubeVideo(
            video.id,
            video.thumbnail,
            video.url,
            durationToSeconds(video.duration),
            response.artist,
            response.title,
            response.lyrics,
            video.karaoke,
          ))
          setAdded(true)
        }
      })
      .catch(() => {
        setLoading(false)
        setError(true)
        setManual(false)
        setSongs([])
        setArtist('')
        setTitle('')
        setLyrics('')
      })
  }, [video, artist, title, dispatch])

  useEffect(() => {
    performIdentification(null, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const useLyrics = useCallback(() => {
    dispatch(queueYoutubeVideo(
      video.id,
      video.thumbnail,
      video.url,
      durationToSeconds(video.duration),
      artist,
      title,
      lyrics,
      video.karaoke,
    ))
    setAdded(true)
  }, [dispatch, video, artist, title, lyrics])

  const useSong = useCallback((song: YouTubeSong) => {
    setLoading(true)
    setError(false)
    setManual(false)
    setSongs([])
    setLyrics('')
    performIdentification(song.id)
  }, [performIdentification])

  const retry = useCallback(() => {
    setLoading(true)
    setError(false)
    setManual(false)
    setSongs([])
    setLyrics('')
    performIdentification()
  }, [performIdentification])

  const enterArtistAndTitle = useCallback(() => {
    setLoading(false)
    setError(false)
    setManual(false)
    setSongs([])
    setLyrics('')
  }, [])

  const enterManually = useCallback(() => {
    setLoading(false)
    setError(false)
    setManual(true)
    setSongs([])
    performIdentification()
  }, [performIdentification])

  const containerStyle = {
    paddingTop: ui.headerHeight,
    paddingBottom: ui.footerHeight,
    width: ui.innerWidth,
    height: ui.innerHeight,
  }

  if (loading) {
    return (
      <div className={styles.container} style={containerStyle}>
        <ColorCycle text='IDENTIFYING SONG' className={styles.backdrop}/>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container} style={containerStyle}>
        <div className={styles.error}>The server had a hickup :(</div>
        <label className={styles.label}>
          <button onClick={retry} className={`${styles.btn} primary`}>Try Again</button>
        </label>
      </div>
    )
  }

  if (added) {
    return (
      <div className={styles.container} style={containerStyle}>
        <div className={styles.success}>
          {video.karaoke && <><strong>&quot;{title}&quot;</strong> by <strong>{artist}</strong> has been added! Feel free to add more songs while we download the video.</>}
          {!video.karaoke && <><strong>&quot;{title}&quot;</strong> by <strong>{artist}</strong> has been added! Feel free to add more songs while our robots generate a karaoke mix 🤖</>}
        </div>
        <label className={styles.label}>
          <button onClick={onQueued} className={`${styles.btn} primary`}>Nice!</button>
        </label>
      </div>
    )
  }

  if (manual) {
    return (
      <div className={styles.container} style={containerStyle}>
        <div className={styles.info}>
          Enter the song&apos;s lyrics below so we can make a karaoke mix. Maybe Google and copy/paste them?
        </div>
        <label className={styles.label}>
          Artist
          <input type='text' className={styles.input} placeholder='Artist' value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label className={styles.label}>
          Song
          <input type='text' className={styles.input} placeholder='Song Title' value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={styles.label}>
          Lyrics
          <textarea style={{ height: ui.innerHeight - 550, minHeight: 50 }} className={styles.input} placeholder='Paste lyrics here' value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
        </label>
        <label className={styles.label}>
          <button onClick={useLyrics} className={`${styles.btn} primary`}>
            {lyrics ? 'Use These Lyrics' : "I'm good without any lyrics"}
          </button>
        </label>
      </div>
    )
  }

  if (video.karaoke) {
    return (
      <div className={styles.container} style={containerStyle}>
        <div className={styles.info}>
          <strong>Nice!</strong> This looks like a pre-made karaoke mix, which will take just
          a few seconds to prepare. Feel free to correct the artist and title below...
        </div>
        <label className={styles.label}>
          Artist
          <input type='text' className={styles.input} placeholder='Artist' value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label className={styles.label}>
          Song
          <input type='text' className={styles.input} placeholder='Song Title' value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={styles.label} style={{ paddingTop: 15 }}>
          <button onClick={useLyrics} className={`${styles.btn} primary`}>Add This Song!</button>
        </label>
        <label className={styles.label} style={{ paddingTop: 5 }}>
          <button onClick={onCancel} className={`${styles.btnLink} primary`}>Back to Search Results</button>
        </label>
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className={styles.container} style={containerStyle}>
        <div className={styles.info}>
          <strong>Help!</strong> Enter the correct artist and song title to help us find this song.
        </div>
        <label className={styles.label}>
          Artist
          <input type='text' className={styles.input} placeholder='Artist' value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label className={styles.label}>
          Song
          <input type='text' className={styles.input} placeholder='Song Title' value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={styles.label} style={{ paddingTop: 15 }}>
          <button onClick={retry} className={`${styles.btn} primary`}>Try Again</button>
        </label>
        <label className={styles.label} style={{ paddingTop: 5 }}>
          <button onClick={enterManually} className={`${styles.btnLink} primary`}>Let me enter lyrics myself</button>
        </label>
        <label className={styles.label} style={{ paddingTop: 5 }}>
          <button onClick={onCancel} className={`${styles.btnLink} primary`}>Back to Search Results</button>
        </label>
      </div>
    )
  }

  if (songs.length === 1) {
    if (lyrics) {
      return (
        <div className={styles.container} style={containerStyle}>
          <div className={styles.success}>
            We think this is <strong>&quot;{title}&quot;</strong> by <strong>{artist}</strong>, and it goes like this...
          </div>
          <label className={styles.label}>
            <pre className={styles.lyricsContainer} style={{ height: ui.innerHeight - 450 }}>
              {lyrics}
            </pre>
          </label>
          <label className={styles.label} style={{ paddingTop: 15 }}>
            <button onClick={useLyrics} className={`${styles.btn} primary`}>That&apos;s it!</button>
          </label>
          <label className={styles.label} style={{ paddingTop: 5 }}>
            <button onClick={enterArtistAndTitle} className={`${styles.btnLink} primary`}>No, that doesn&apos;t look right</button>
          </label>
        </div>
      )
    }

    return (
      <div className={styles.container} style={containerStyle}>
        <div className={styles.info}>
          We found <strong>&quot;{title}&quot;</strong> by <strong>{artist}</strong>, but we couldn&apos;t find the lyrics. Can you help? Maybe Google and copy/paste them?
        </div>
        <label className={styles.label}>
          Lyrics
          <textarea style={{ height: ui.innerHeight - 500, minHeight: 50 }} className={styles.input} placeholder='Paste lyrics here' value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
        </label>
        <label className={styles.label}>
          <button onClick={useLyrics} className={`${styles.btn} primary`}>
            {lyrics ? 'Use These Lyrics' : "I'm good without any lyrics"}
          </button>
        </label>
        <label className={styles.label} style={{ paddingTop: 5 }}>
          <button onClick={enterArtistAndTitle} className={`${styles.btnLink} primary`}>Try a different artist/title</button>
        </label>
      </div>
    )
  }

  // Multiple song matches
  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.info}>
        We found lots of matches! Which song is this?
      </div>
      <PaddedList
        numRows={songs.length}
        rowHeight={() => SONG_ITEM_HEIGHT}
        rowComponent={YouTubeIdentifyRow}
        rowProps={{ songs, onSongTap: useSong }}
        paddingTop={0}
        paddingRight={4}
        paddingBottom={0}
        width={ui.innerWidth}
        height={ui.innerHeight - 300}
      />
      <label className={styles.label} style={{ paddingTop: 15 }}>
        <button onClick={enterArtistAndTitle} className={`${styles.btnLink} primary`}>None of these look right</button>
      </label>
    </div>
  )
}

export default YouTubeIdentify
