import React, { useRef, useState } from 'react'
import clsx from 'clsx'
import { useSwipeable } from 'react-swipeable'
import { useLongPress } from 'use-long-press'
import { useAppDispatch } from 'store/hooks'
import Buttons from 'components/Buttons/Buttons'
import Icon from 'components/Icon'
import UserImage from 'components/UserImage/UserImage'
import { requestPlayNext } from 'store/modules/status'
import { showErrorMessage } from 'store/modules/ui'
import { removeItem } from '../../modules/queue'
import styles from './QueueYoutubeItem.css'

const LONG_PRESS_THRESHOLD_MS = 700

interface QueueYoutubeItemProps {
  artist: string
  errorMessage: string
  isCurrent: boolean
  isErrored: boolean
  isOwner: boolean
  isPlayed: boolean
  isPlaying: boolean
  isRemovable: boolean
  isSkippable: boolean
  isUpcoming: boolean
  pctPlayed: number
  queueId: number
  youtubeVideoId: string
  title: string
  userId: number
  userDisplayName: string
  userDateUpdated: number
  wait?: string
  status?: string
  onMoveClick: (queueId: number) => void
  onRemoveUpcoming: (userId: number) => void
}

const QueueYoutubeItem = ({
  artist,
  errorMessage,
  isCurrent,
  isErrored,
  isOwner,
  isPlayed,
  isPlaying,
  isRemovable,
  isSkippable,
  isUpcoming,
  onMoveClick,
  onRemoveUpcoming,
  pctPlayed,
  queueId,
  title,
  userId,
  userDateUpdated,
  userDisplayName,
  wait,
  status,
}: QueueYoutubeItemProps) => {
  const [isExpanded, setExpanded] = useState(false)
  const longPressActiveRef = useRef(false)
  const dispatch = useAppDispatch()

  const handleErrorInfoClick = () => dispatch(showErrorMessage(errorMessage))
  const handleSkipClick = () => {
    dispatch(requestPlayNext())
    setExpanded(false)
  }
  const handleRemoveClick = () => dispatch(removeItem({ queueId }))

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      setExpanded(isErrored || isRemovable || isSkippable)
    },
    onSwipedRight: () => setExpanded(false),
    preventScrollOnSwipe: true,
    trackMouse: true,
  })

  const bindRemovePressHandlers = useLongPress(() => {
    const confirmText = isOwner ? 'Remove all your upcoming songs?' : `Remove all upcoming songs for "${userDisplayName}"?`
    longPressActiveRef.current = true

    if (confirm(confirmText)) {
      onRemoveUpcoming(userId)
    }
  }, { threshold: LONG_PRESS_THRESHOLD_MS, cancelOnMovement: true })

  const bindSkipPressHandlers = useLongPress(() => {
    const confirmText = isOwner ? 'Skip and remove all your upcoming songs?' : `Skip and remove all upcoming songs for "${userDisplayName}"?`
    longPressActiveRef.current = true

    if (confirm(confirmText)) {
      onRemoveUpcoming(userId)
      handleSkipClick()
    }
  }, { threshold: LONG_PRESS_THRESHOLD_MS, cancelOnMovement: true })

  return (
    <div
      {...swipeHandlers}
      className={clsx(
        styles.container,
        isCurrent && styles.current,
        isCurrent && !isPlaying && styles.paused,
      )}
      style={{ '--progress': (isCurrent && pctPlayed < 2 ? 2 : pctPlayed) + '%' } as React.CSSProperties}
    >
      <div className={styles.content}>
        <div className={clsx(styles.imageContainer, isPlayed && styles.greyed)}>
          <UserImage userId={userId} dateUpdated={userDateUpdated} />
          <div className={styles.waitContainer}>
            {isUpcoming && (
              <div className={clsx(styles.wait, isOwner && styles.isOwner)}>
                {wait}
              </div>
            )}
          </div>
        </div>

        <div className={clsx(styles.primary, isPlayed && styles.greyed)}>
          <div className={styles.innerPrimary}>
            <div className={styles.title}>{title}</div>
            <div className={styles.artist}>
              <div className={styles.artistName}>{artist}</div>
              {status !== 'ready' && (
                <div className={styles.status}>{status}</div>
              )}
            </div>
          </div>
          <div className={clsx(styles.user, isOwner && styles.isOwner)}>
            {userDisplayName}
          </div>
        </div>

        <Buttons btnWidth={50} isExpanded={isExpanded}>
          {status !== 'ready' && (
            <div>
              <Icon icon='HOURGLASS' size={44} className={styles.loader} />
            </div>
          )}
          {isErrored && (
            <div onClick={handleErrorInfoClick} className={clsx(styles.btn, styles.danger)}>
              <Icon icon='INFO_OUTLINE' size={44} />
            </div>
          )}
          {isRemovable && (
            <div
              onClick={handleRemoveClick}
              {...bindRemovePressHandlers()}
              className={clsx(styles.btn, styles.danger)}
              data-hide
            >
              <Icon icon='CLEAR' size={44} />
            </div>
          )}
          {isSkippable && (
            <div
              onClick={handleSkipClick}
              {...bindSkipPressHandlers()}
              className={clsx(styles.btn, styles.danger)}
              data-hide
            >
              <Icon icon='PLAY_NEXT' size={44} />
            </div>
          )}
        </Buttons>
      </div>
    </div>
  )
}

export default QueueYoutubeItem
