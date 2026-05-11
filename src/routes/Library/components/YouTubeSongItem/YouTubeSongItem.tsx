import React from 'react'
import styles from './YouTubeSongItem.css'

export interface YouTubeSong {
  id: number
  title: string
  artist?: { name: string }
  thumbnail?: string
}

interface YouTubeSongItemProps {
  song: YouTubeSong
  style?: React.CSSProperties
  onSongTap?: (song: YouTubeSong) => void
}

const ITEM_HEIGHT = 70

const YouTubeSongItem = ({ song, style, onSongTap }: YouTubeSongItemProps) => (
  <div onClick={() => onSongTap?.(song)} style={style} className={styles.container}>
    <div className={styles.thumbnailContainer}>
      {song.thumbnail && <img src={song.thumbnail} />}
    </div>
    <div className={styles.primary}>
      <div className={styles.title}>
        {song.title}
        {song.artist && <div className={styles.artist}>{song.artist.name}</div>}
      </div>
    </div>
  </div>
)

YouTubeSongItem.ITEM_HEIGHT = ITEM_HEIGHT

export default YouTubeSongItem
