import React, { useState, useCallback } from 'react'
import { useAppSelector } from 'store/hooks'
import { Link } from 'react-router'
import ArtistList from '../components/ArtistList/ArtistList'
import SearchResults from '../components/SearchResults/SearchResults'
import YouTubeSearch from '../components/YouTubeSearch/YouTubeSearch'
import TextOverlay from 'components/TextOverlay/TextOverlay'
import Spinner from 'components/Spinner/Spinner'
import styles from './LibraryView.css'

const LibraryView = () => {
  const { isAdmin } = useAppSelector(state => state.user)
  const { isLoading, filterStr, filterStarred } = useAppSelector(state => state.library)
  const isYouTubeEnabled = useAppSelector(state => (state.prefs as any).isYouTubeEnabled)
  const songsResult = useAppSelector(state => state.songs.result)
  const ui = useAppSelector(state => state.ui)

  const isSearching = !!filterStr.trim().length || filterStarred
  const [initialHeaderHeight] = useState(ui.headerHeight)
  const [finalHeaderHeight, setFinalHeaderHeight] = useState(null)
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState<string | null>(null)

  const handleYouTubeSearch = useCallback((query: string) => {
    setYoutubeSearchQuery(query)
  }, [])

  const handleYouTubeDone = useCallback(() => {
    setYoutubeSearchQuery(null)
  }, [])

  // don't render ArtistList until headerHeight is stable; otherwise
  // scroll position restoration does not work well (appears OBO)
  // @todo - this is hacky
  if (finalHeaderHeight === null && ui.headerHeight > initialHeaderHeight) {
    setFinalHeaderHeight(ui.headerHeight)
  }

  if (!finalHeaderHeight) return null

  return (
    <>
      {youtubeSearchQuery && (
        <YouTubeSearch
          filterKeywords={youtubeSearchQuery.split(' ')}
          ui={ui}
          onDone={handleYouTubeDone}
        />
      )}

      {!youtubeSearchQuery && !isSearching && <ArtistList ui={ui} />}

      {!youtubeSearchQuery && isSearching && (
        <SearchResults
          ui={ui}
          onYouTubeSearch={isYouTubeEnabled ? handleYouTubeSearch : undefined}
        />
      )}

      {isLoading && <Spinner />}

      {!isLoading && songsResult.length === 0 && (
        <TextOverlay className={styles.empty}>
          <h1>Library Empty</h1>
          {isAdmin && (
            <p>
              <Link to='/account'>Add media folders</Link>
              {isYouTubeEnabled ? '' : ' or enable YouTube'}
              {' '}
              to get started.
            </p>
          )}
        </TextOverlay>
      )}
    </>
  )
}

export default LibraryView
