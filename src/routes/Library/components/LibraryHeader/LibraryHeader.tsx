import React, { useState, useRef } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setFilterStr, resetFilterStr, toggleFilterStarred, setYoutubeSearchQuery } from '../../modules/library'
import Button from 'components/Button/Button'
import styles from './LibraryHeader.css'

const LibraryHeader = () => {
  const dispatch = useAppDispatch()
  const { filterStr, filterStarred } = useAppSelector(state => state.library)
  const isYouTubeEnabled = useAppSelector(state => (state.prefs as any).isYouTubeEnabled)

  const searchInput = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(filterStr)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value)
    dispatch(setFilterStr(event.target.value))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && isYouTubeEnabled && value.trim()) {
      dispatch(setYoutubeSearchQuery(value.trim()))
    }
  }

  const clearSearch = () => {
    setValue('')
    dispatch(resetFilterStr())
  }

  const handleMagnifierClick = () => {
    if (value.trim()) clearSearch()
    else searchInput.current?.focus()
  }

  return (
    <div className={styles.container}>
      <Button
        className={clsx(styles.btnMagnifier, filterStr && styles.active)}
        icon='MAGNIFIER'
        onClick={handleMagnifierClick}
      />
      <input
        type='search'
        className={styles.searchInput}
        placeholder='search'
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        ref={searchInput}
      />
      {filterStr && (
        <Button
          icon='CLEAR'
          onClick={clearSearch}
          className={clsx(styles.btnClear, styles.active)}
        />
      )}
      <Button
        className={clsx(styles.btnStar, filterStarred && styles.active)}
        icon='STAR_FULL'
        onClick={() => dispatch(toggleFilterStarred())}
      />
    </div>
  )
}

export default LibraryHeader
