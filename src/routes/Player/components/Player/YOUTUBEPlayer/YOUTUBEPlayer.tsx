import React from 'react'
import { useAppSelector } from 'store/hooks'
import styles from './YOUTUBEPlayer.css'

interface WordData {
  word: string
  start: number
  end: number
  ignore?: boolean
}

type LyricsLine = WordData[]

interface YOUTUBEPlayerProps {
  isPlaying: boolean
  youtubeVideoId: string
  youtubeAlignedLyrics: LyricsLine[] | null
  youtubeVideoDuration: number
  width: number
  height: number
  onAudioElement: (el: HTMLVideoElement) => void
  onEnd: () => void
  onError: (msg: string) => void
  onLoad: () => void
  onPlay: () => void
  onStatus: (status: { position: number }) => void
  upcomingLyricsColor?: string
  playedLyricsColor?: string
}

class YOUTUBEPlayerInner extends React.Component<YOUTUBEPlayerProps> {
  static minGapForProgress = 15
  static gapPadding = 5

  state = {
    lyricsUpdateTimer: false as false | ReturnType<typeof setInterval>
  }

  video = React.createRef<HTMLVideoElement>()
  upcomingLyrics = React.createRef<HTMLDivElement>()
  playedLyrics = React.createRef<HTMLDivElement>()
  progressBar = React.createRef<HTMLDivElement>()

  previousCurrentLine: number | null = null
  gapStart = -1
  gapEnd = -1

  componentDidMount () {
    this.props.onAudioElement(this.video.current!)
    this.updateSources()
  }

  componentDidUpdate (prevProps: YOUTUBEPlayerProps) {
    if (prevProps.youtubeVideoId !== this.props.youtubeVideoId) {
      this.updateSources()
    }

    if (prevProps.isPlaying !== this.props.isPlaying) {
      this.updateIsPlaying()
    }
  }

  renderLyricsLines () {
    return this.props.youtubeAlignedLyrics!.map((line, i) =>
      <div key={this.props.youtubeVideoId + '_line_' + i} className={styles.line}>
        { this.renderLyricsWords(i, line) }
      </div>
    )
  }

  renderLyricsWords (lineNumber: number, words: WordData[]) {
    return words.map((wordData, i) =>
      <span key={this.props.youtubeVideoId + '_line_' + lineNumber + '_word_' + i} className={styles.wordContainer}>
        <span className={styles.word + ' ' + (wordData.ignore ? styles.wordIgnore : '')}>
          { wordData.word }
        </span>
      </span>
    )
  }

  render () {
    const { width, height } = this.props

    return (
      <>
        <video className={styles.video}
          preload='auto'
          width={width}
          height={height}
          onCanPlayThrough={this.updateIsPlaying}
          onEnded={this.props.onEnd}
          onError={this.handleError}
          onLoadStart={this.props.onLoad}
          onPlay={this.handlePlay}
          onTimeUpdate={this.handleTimeUpdate}
          ref={this.video}
        />
        { this.props.youtubeAlignedLyrics != null &&
          <>
            <div key={this.props.youtubeVideoId + '_upcomingLyricsContainer'} style={{ width, height }} className={styles.lyricsContainer}>
              <div style={{ width }} className={styles.lyricsScrollContainer}>
                <div
                  ref={this.upcomingLyrics}
                  className={styles.lyrics + ' ' + styles.upcomingLyrics}
                  style={{ color: this.props.upcomingLyricsColor }}>
                  { this.renderLyricsLines() }
                </div>
                <div className={styles.endNotice}>
                  👏👏👏
                </div>
              </div>
            </div>
            <div key={this.props.youtubeVideoId + '_playedLyricsContainer'} style={{ width, height }} className={styles.lyricsContainer}>
              <div style={{ width }} className={styles.lyricsScrollContainer}>
                <div
                  ref={this.playedLyrics}
                  className={styles.lyrics + ' ' + styles.playedLyrics}
                  style={{ color: this.props.playedLyricsColor }}>
                  { this.renderLyricsLines() }
                </div>
              </div>
            </div>
            <div key={this.props.youtubeVideoId + '_progressBar'} ref={this.progressBar} style={{ width: width / 1.5 }} className={styles.progressBarContainer}>
              <div className={styles.progressBar}/>
            </div>
          </>
        }
      </>
    )
  }

  getFocusY () {
    return Math.floor(this.props.height / 2.5)
  }

  getLyricsEnd () {
    let lastLineWithWords: WordData[] | null = null
    for (let x = this.props.youtubeAlignedLyrics!.length - 1; x >= 0; x--) {
      if (this.props.youtubeAlignedLyrics![x].length) {
        lastLineWithWords = this.props.youtubeAlignedLyrics![x]
        break
      }
    }

    if (lastLineWithWords === null) return this.props.youtubeVideoDuration
    return lastLineWithWords[lastLineWithWords.length - 1].end
  }

  getGapStart (lineIndex: number): number {
    if (lineIndex >= 0 && lineIndex < this.props.youtubeAlignedLyrics!.length) {
      if (this.props.youtubeAlignedLyrics![lineIndex].length) {
        const words = this.props.youtubeAlignedLyrics![lineIndex]
        return words[words.length - 1].end
      } else {
        for (let i = lineIndex - 1; i >= 0; i--) {
          if (this.props.youtubeAlignedLyrics![i].length) {
            const words = this.props.youtubeAlignedLyrics![i]
            return words[words.length - 1].end
          }
        }
        return 0
      }
    } else if (lineIndex === -2) {
      return this.getGapStart(this.props.youtubeAlignedLyrics!.length - 1)
    }
    return 0
  }

  getGapEnd (lineIndex: number): number {
    if (lineIndex >= -1) lineIndex++

    if (lineIndex >= 0 && lineIndex < this.props.youtubeAlignedLyrics!.length) {
      if (this.props.youtubeAlignedLyrics![lineIndex].length) {
        const words = this.props.youtubeAlignedLyrics![lineIndex]
        return words[0].start
      } else {
        for (let i = lineIndex + 1; i < this.props.youtubeAlignedLyrics!.length; i++) {
          if (this.props.youtubeAlignedLyrics![i].length) {
            const words = this.props.youtubeAlignedLyrics![i]
            return words[0].start
          }
        }
      }
    }
    return this.props.youtubeVideoDuration
  }

  getCurrentLineIndex (currentTime: number): number {
    let start = 0
    const index = this.props.youtubeAlignedLyrics!.findIndex((words) => {
      if (words.length > 0) start = parseFloat(String(words[0].start))
      if (currentTime < start) return true
      if (words.length > 0) start = parseFloat(String(words[words.length - 1].end))
      return false
    })

    if (index >= 0) return index - 1
    if (index === -1) {
      if (currentTime < this.getLyricsEnd()) return this.props.youtubeAlignedLyrics!.length - 1
      return -2
    }
    return 0
  }

  updateLyricsPosition (currentTime: number | null = null) {
    if (this.props.youtubeAlignedLyrics !== null && this.video.current) {
      const duration = this.props.youtubeVideoDuration
      if (currentTime === null) currentTime = this.video.current.currentTime + 0.2
      if (currentTime > duration) currentTime = duration
      let currentLineIndex = this.getCurrentLineIndex(currentTime)

      if (this.previousCurrentLine !== currentLineIndex) {
        this.previousCurrentLine = currentLineIndex

        this.gapStart = this.getGapStart(currentLineIndex)
        this.gapEnd = this.getGapEnd(currentLineIndex)
        if (this.gapEnd - this.gapStart >= YOUTUBEPlayerInner.minGapForProgress && currentLineIndex !== -2) {
          this.gapEnd -= YOUTUBEPlayerInner.gapPadding
        } else {
          this.gapStart = -1
          this.gapEnd = -1
        }

        if (currentLineIndex === -1) {
          currentLineIndex = 0
        }

        if (currentLineIndex === -2) {
          currentLineIndex = this.props.youtubeAlignedLyrics.length - 1
          this.upcomingLyrics.current!.parentElement!.parentElement!.style.opacity = '0'
          this.playedLyrics.current!.parentElement!.parentElement!.style.opacity = '0'
        } else {
          this.upcomingLyrics.current!.parentElement!.parentElement!.style.opacity = '1'
          this.playedLyrics.current!.parentElement!.parentElement!.style.opacity = '1'
        }

        const focusY = this.getFocusY()
        const lineY = (this.upcomingLyrics.current!.children[currentLineIndex] as HTMLElement).offsetTop
        this.upcomingLyrics.current!.parentElement!.style.top = (focusY - lineY) + 'px'
        this.playedLyrics.current!.parentElement!.style.top = (focusY - lineY) + 'px'

        const played = this.playedLyrics.current!.children
        const upcoming = this.upcomingLyrics.current!.children

        // make sure the current line is visible
        ;(played[currentLineIndex] as HTMLElement).style.visibility = 'visible'
        ;(played[currentLineIndex] as HTMLElement).style.opacity = '1'
        ;(upcoming[currentLineIndex] as HTMLElement).style.visibility = 'visible'
        ;(upcoming[currentLineIndex] as HTMLElement).style.opacity = '1'

        // make all later lines visible and reset their played word widths
        for (let i = currentLineIndex + 1; i < this.props.youtubeAlignedLyrics.length; i++) {
          for (let wordIndex = 0; wordIndex < played[i].children.length; wordIndex++) {
            ;(played[i].children[wordIndex].firstChild as HTMLElement).style.width = '0%'
          }
          ;(played[i] as HTMLElement).style.visibility = 'visible'
          ;(played[i] as HTMLElement).style.opacity = '1'
          ;(upcoming[i] as HTMLElement).style.visibility = 'visible'
          ;(upcoming[i] as HTMLElement).style.opacity = '1'
        }

        // update preceding line opacity and all word widths
        if ((currentLineIndex - 1) >= 0) {
          for (let wordIndex = 0; wordIndex < played[currentLineIndex - 1].children.length; wordIndex++) {
            ;(played[currentLineIndex - 1].children[wordIndex].firstChild as HTMLElement).style.width = '100%'
          }
          ;(upcoming[currentLineIndex - 1] as HTMLElement).style.visibility = 'visible'
          ;(played[currentLineIndex - 1] as HTMLElement).style.visibility = 'visible'
          ;(played[currentLineIndex - 1] as HTMLElement).style.opacity = '0.8'
          ;(upcoming[currentLineIndex - 1] as HTMLElement).style.opacity = '0.8'
        }

        if ((currentLineIndex - 2) >= 0) {
          ;(upcoming[currentLineIndex - 2] as HTMLElement).style.visibility = 'visible'
          ;(played[currentLineIndex - 2] as HTMLElement).style.visibility = 'visible'
          ;(upcoming[currentLineIndex - 2] as HTMLElement).style.opacity = '0.6'
          ;(played[currentLineIndex - 2] as HTMLElement).style.opacity = '0.6'
        }
        if ((currentLineIndex - 3) >= 0) {
          ;(upcoming[currentLineIndex - 2] as HTMLElement).style.visibility = 'visible'
          ;(played[currentLineIndex - 2] as HTMLElement).style.visibility = 'visible'
          ;(upcoming[currentLineIndex - 3] as HTMLElement).style.opacity = '0.3'
          ;(played[currentLineIndex - 3] as HTMLElement).style.opacity = '0.3'
        }
        if ((currentLineIndex - 4) >= 0) {
          ;(upcoming[currentLineIndex - 2] as HTMLElement).style.visibility = 'visible'
          ;(played[currentLineIndex - 2] as HTMLElement).style.visibility = 'visible'
          ;(upcoming[currentLineIndex - 4] as HTMLElement).style.opacity = '0'
          ;(played[currentLineIndex - 4] as HTMLElement).style.opacity = '0'
        }

        // just hide the rest of the preceding lines
        for (let i = 0; i < currentLineIndex - 5; i++) {
          ;(upcoming[i] as HTMLElement).style.visibility = 'hidden'
          ;(played[i] as HTMLElement).style.visibility = 'hidden'
        }
      }

      // update the played portion of words in the current line
      if (currentLineIndex === -1) currentLineIndex = 0
      if (currentLineIndex === -2) currentLineIndex = this.props.youtubeAlignedLyrics.length - 1

      const words = this.props.youtubeAlignedLyrics[currentLineIndex]
      if (words.length) {
        const played = this.playedLyrics.current!.children
        words.forEach((word, wordIndex) => {
          const wordStart = parseFloat(String(word.start))
          const wordEnd = parseFloat(String(word.end))
          let wordProgress = 0
          if (currentTime! >= wordEnd) {
            wordProgress = 100
          } else if (currentTime! >= wordStart) {
            const wordDuration = wordEnd - wordStart
            if (wordDuration > 0) {
              wordProgress = (((currentTime! - wordStart) / wordDuration) * 100)
            }
          }

          if (played[currentLineIndex] !== undefined &&
            played[currentLineIndex].children[wordIndex] !== undefined) {
            ;(played[currentLineIndex].children[wordIndex].firstChild as HTMLElement).style.width = wordProgress + '%'
          }
        })
      }

      // show a progress bar if we're in the gap
      if (this.gapStart !== -1) {
        if (currentTime! >= this.gapStart && currentTime! < this.gapEnd) {
          this.upcomingLyrics.current!.parentElement!.parentElement!.style.opacity = '0'
          this.playedLyrics.current!.parentElement!.parentElement!.style.opacity = '0'
          this.progressBar.current!.style.opacity = '1'
          this.progressBar.current!.firstChild &&
            ((this.progressBar.current!.firstChild as HTMLElement).style.width =
              ((((currentTime!) - (this.gapStart + 1)) / (this.gapEnd - (this.gapStart + 1))) * 100) + '%')
        } else {
          if (this.progressBar.current!.firstChild) {
            (this.progressBar.current!.firstChild as HTMLElement).style.width = '100%'
          }
          this.upcomingLyrics.current!.parentElement!.parentElement!.style.opacity = '1'
          this.playedLyrics.current!.parentElement!.parentElement!.style.opacity = '1'
          this.progressBar.current!.style.opacity = '0'
        }
      }
    }
  }

  startLyricsTimer () {
    if (!this.state.lyricsUpdateTimer && this.props.youtubeAlignedLyrics !== null) {
      this.setState({ lyricsUpdateTimer: setInterval(this.updateLyricsPosition.bind(this), 100) })
    }
  }

  stopLyricsTimer () {
    if (this.state.lyricsUpdateTimer) {
      clearInterval(this.state.lyricsUpdateTimer)
      this.setState({ lyricsUpdateTimer: false })
    }
  }

  updateSources = () => {
    this.stopLyricsTimer()
    this.setState({ currentTime: 0.0 })
    this.video.current!.src = `${document.baseURI}api/youtube/${this.props.youtubeVideoId}`
    this.video.current!.load()
    this.previousCurrentLine = null
    this.startLyricsTimer()
  }

  updateIsPlaying = () => {
    if (this.props.isPlaying) {
      this.video.current!.play()
        .catch(err => this.props.onError(err.message))
      this.startLyricsTimer()
    } else {
      this.video.current!.pause()
      this.stopLyricsTimer()
    }
  }

  handleError = (el: React.SyntheticEvent<HTMLVideoElement>) => {
    const { message, code } = (el.target as HTMLVideoElement).error!
    this.props.onError(`${message} (code ${code})`)
  }

  handlePlay = () => this.props.onPlay()

  handleTimeUpdate = () => {
    this.props.onStatus({
      position: this.video.current!.currentTime,
    })
  }
}

const YOUTUBEPlayer = (props: Omit<YOUTUBEPlayerProps, 'upcomingLyricsColor' | 'playedLyricsColor'> & { upcomingLyricsColor?: string, playedLyricsColor?: string }) => {
  const upcomingLyricsColor = useAppSelector(state => (state.prefs as any).upcomingLyricsColor) as string | undefined
  const playedLyricsColor = useAppSelector(state => (state.prefs as any).playedLyricsColor) as string | undefined

  return (
    <YOUTUBEPlayerInner
      {...props}
      upcomingLyricsColor={props.upcomingLyricsColor ?? upcomingLyricsColor}
      playedLyricsColor={props.playedLyricsColor ?? playedLyricsColor}
    />
  )
}

export default YOUTUBEPlayer
