import React, { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { requestLogout, switchRoom, updateAccount } from 'store/modules/user'
import { removeItem } from 'routes/Queue/modules/queue'
import getUpcoming from 'routes/Queue/selectors/getUpcoming'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import AccountForm from '../AccountForm/AccountForm'
import styles from './Account.css'

const Account = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const rooms = useAppSelector(state => state.rooms)
  const upcomingQueueIds = useAppSelector(state => getUpcoming(state, user.userId))

  const curPassword = useRef(null)
  const [isDirty, setDirty] = useState(false)

  const [switchRoomId, setSwitchRoomId] = useState<number | null>(null)
  const [roomPassword, setRoomPassword] = useState('')

  const handleRoomSwitch = () => {
    if (!switchRoomId || switchRoomId === user.roomId) return

    const hasUpcoming = upcomingQueueIds.length > 0
    if (hasUpcoming && !confirm('Switching rooms will leave your queued songs behind. Continue?')) return

    dispatch(switchRoom({ roomId: switchRoomId, roomPassword: roomPassword || undefined }))
    setSwitchRoomId(null)
    setRoomPassword('')
  }

  const handleSignOut = () => {
    if (!user.isAdmin) {
      const hasUpcomingSongs = upcomingQueueIds.length > 0
      let message = ''

      if (user.isGuest && hasUpcomingSongs) {
        message = `Are you sure you want to sign out?\n\nYour upcoming songs will be removed from the queue, and as a guest, you won't be able to sign back into this account.`
      } else if (user.isGuest) {
        message = `Are you sure you want to sign out?\n\nAs a guest, you won't be able to sign back into this account.`
      } else if (hasUpcomingSongs) {
        message = `Are you sure you want to sign out?\n\nYour upcoming songs will be removed from the queue.`
      }

      if (message && !confirm(message)) return

      if (hasUpcomingSongs) {
        dispatch(removeItem({ queueId: upcomingQueueIds }))
      }
    }

    dispatch(requestLogout())
  }

  const handleSubmit = (data: FormData) => {
    if (!user.isGuest) {
      if (!curPassword.current.value.trim()) {
        alert('Please enter your current password to make changes.')
        curPassword.current.focus()
        return
      }

      data.append('password', curPassword.current.value)
    }

    dispatch(updateAccount(data))
  }

  return (
    <Panel title='My Account' contentClassName={styles.content}>
      <>
        <p>
          Signed in as&nbsp;
          <strong>{user.isGuest ? 'guest' : user.username}</strong>
          {user.roomId && rooms.entities[user.roomId] && (
            <>
              &nbsp;in room&nbsp;
              <strong>{rooms.entities[user.roomId].name}</strong>
            </>
          )}
        </p>

        <AccountForm
          user={user}
          onDirtyChange={setDirty}
          onSubmit={handleSubmit}
          showUsername={!user.isGuest}
          showPassword={!user.isGuest}
        >
          {isDirty && !user.isGuest && (
            <input
              type='password'
              autoComplete='current-password'
              placeholder='current password'
              ref={curPassword}
            />

          )}

          <div className={styles.btnContainer}>
            {isDirty && (
              <Button type='submit' variant='primary'>
                Update Account
              </Button>
            )}
            <Button onClick={handleSignOut} variant='default'>
              Sign Out
            </Button>
          </div>
        </AccountForm>

        {rooms.result.length > 1 && (
          <div className={styles.roomSwitcher}>
            <label>Switch Room</label>
            <select
              value={switchRoomId ?? ''}
              onChange={(e) => {
                setSwitchRoomId(parseInt(e.target.value, 10) || null)
                setRoomPassword('')
              }}
            >
              <option value=''>Select a room...</option>
              {rooms.result
                .filter(id => id !== user.roomId && (user.isAdmin || rooms.entities[id].status === 'open'))
                .map(id => (
                  <option key={id} value={id}>{rooms.entities[id].name}</option>
                ))
              }
            </select>
            {switchRoomId && rooms.entities[switchRoomId]?.hasPassword && !user.isAdmin && (
              <input
                type='password'
                autoComplete='off'
                placeholder='room password'
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
              />
            )}
            {switchRoomId && (
              <Button onClick={handleRoomSwitch} variant='primary'>
                Switch Room
              </Button>
            )}
          </div>
        )}
      </>
    </Panel>
  )
}

export default Account
