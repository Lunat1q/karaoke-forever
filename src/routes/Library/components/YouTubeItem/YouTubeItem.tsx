import React from 'react'
import Icon from 'components/Icon'
import styles from './YouTubeItem.css'

export interface YouTubeVideo {
  id: string
  url: string
  title: string
  duration: string
  thumbnail: string
  channel: string
  karaoke: boolean
  queued: boolean
}

interface YouTubeItemProps {
  video: YouTubeVideo
  style?: React.CSSProperties
  onVideoTap?: (video: YouTubeVideo) => void
}

const YOUTUBE_ITEM_HEIGHT = 70

const YouTubeItem = ({ video, style, onVideoTap }: YouTubeItemProps) => (
  <div onClick={() => onVideoTap?.(video)} style={style}
    className={video.queued ? styles.containerQueued : styles.container}>
    <div className={styles.thumbnailContainer}>
      <img src={video.thumbnail} />
      <div className={styles.mixtypeicon}>
        {video.karaoke && <Icon icon='MICROPHONE' size={35}/>}
        {!video.karaoke && <Icon icon='HOURGLASS' size={35}/>}
      </div>
      <div className={styles.duration}>{video.duration}</div>
    </div>
    <div className={styles.primary}>
      <div className={styles.title}>
        {video.title}
        {video.karaoke && <div className={styles.mixtype}><Icon icon='MICROPHONE' size={12}/> Pre-made karaoke mix</div>}
        {!video.karaoke && <div className={styles.mixtype}><Icon icon='HOURGLASS' size={12} className={styles.spin} /> Ready in a few minutes</div>}
        {video.channel && <div className={styles.channel}>{video.channel}</div>}
      </div>
    </div>
  </div>
)

YouTubeItem.YOUTUBE_ITEM_HEIGHT = YOUTUBE_ITEM_HEIGHT

export default YouTubeItem
