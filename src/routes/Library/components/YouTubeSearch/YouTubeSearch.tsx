import React, { useState, useCallback, useEffect } from 'react'
import PaddedList from 'components/PaddedList/PaddedList'
import styles from './YouTubeSearch.css'
import ColorCycle from '../../../Player/components/PlayerTextOverlay/ColorCycle'
import HttpApi from 'lib/HttpApi'
import YouTubeItem, { type YouTubeVideo, YOUTUBE_ITEM_HEIGHT } from '../YouTubeItem'
import YouTubeIdentify from '../YouTubeIdentify'
import type { UIState } from 'store/modules/ui'

const api = new HttpApi('')

interface YouTubeSearchRowProps {
  index: number
  style: React.CSSProperties
  videos: YouTubeVideo[]
  onVideoTap: (video: YouTubeVideo) => void
}

const YouTubeSearchRow = ({ index, style, videos, onVideoTap }: YouTubeSearchRowProps) => {
  const video = videos[index]
  return (
    <YouTubeItem
      key={video.id}
      video={video}
      style={style}
      onVideoTap={onVideoTap}
    />
  )
}

interface YouTubeSearchProps {
  filterKeywords: string[]
  ui: UIState
  onDone: () => void
}

const YouTubeSearch = ({ filterKeywords, ui, onDone }: YouTubeSearchProps) => {
  const [loading, setLoading] = useState(true)
  const [identifying, setIdentifying] = useState<YouTubeVideo | null>(null)
  const [error, setError] = useState(false)
  const [videos, setVideos] = useState<YouTubeVideo[]>([])

  const performSearch = useCallback(() => {
    setLoading(true)
    setError(false)
    api.post('youtubesearch', {
      body: { query: filterKeywords.join(' ') }
    })
      .then((result) => {
        setVideos(result as unknown as YouTubeVideo[])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [filterKeywords])

  useEffect(() => {
    performSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const identifyYoutubeVideo = useCallback((video: YouTubeVideo) => {
    setError(false)
    setLoading(false)
    setIdentifying(video)
  }, [])

  const identifyCancelled = useCallback(() => {
    setIdentifying(null)
  }, [])

  const videoQueued = useCallback(() => {
    onDone()
  }, [onDone])

  const retry = useCallback(() => {
    setError(false)
    setLoading(true)
    setIdentifying(null)
    setVideos([])
    performSearch()
  }, [performSearch])

  const containerStyle = {
    paddingTop: ui.headerHeight,
    paddingBottom: ui.footerHeight,
    width: ui.innerWidth,
    height: ui.innerHeight,
  }

  if (loading) {
    return (
      <div className={styles.container} style={containerStyle}>
        <ColorCycle text='SEARCHING YOUTUBE' className={styles.backdrop}/>
      </div>
    )
  }

  if (error || !videos) {
    return (
      <div className={styles.container} style={containerStyle}>
        <div>We had a problem searching YouTube :(</div>
        <div style={{ paddingTop: 30 }}>
          <button onClick={retry} className={styles.btn}>Try Again</button>
        </div>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className={styles.container} style={containerStyle}>
        <div>We found nothin&apos;</div>
      </div>
    )
  }

  if (identifying !== null) {
    return (
      <YouTubeIdentify
        ui={ui}
        video={identifying}
        query={filterKeywords.join(' ')}
        onQueued={videoQueued}
        onCancel={identifyCancelled}
      />
    )
  }

  return (
    <PaddedList
      numRows={videos.length}
      rowHeight={() => YOUTUBE_ITEM_HEIGHT}
      rowComponent={YouTubeSearchRow}
      rowProps={{ videos, onVideoTap: identifyYoutubeVideo }}
      paddingTop={ui.headerHeight}
      paddingRight={4}
      paddingBottom={ui.footerHeight}
      width={ui.innerWidth}
      height={ui.innerHeight}
    />
  )
}

export default YouTubeSearch
