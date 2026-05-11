import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { createUser, removeUser, updateUser } from '../../../modules/users'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import AccountForm from '../../AccountForm/AccountForm'
import { UserWithRole } from 'shared/types'
import HttpApi from 'lib/HttpApi'
import styles from './EditUser.css'

const api = new HttpApi('')

interface EditUserProps {
  user?: UserWithRole
  onClose: () => void
}

const EditUser = ({ user, onClose }: EditUserProps) => {
  const dispatch = useAppDispatch()
  const rooms = useAppSelector(state => state.rooms)
  const [moveRoomId, setMoveRoomId] = useState<number | null>(null)

  const handleSubmit = (data: FormData) => {
    if (user) dispatch(updateUser({ userId: user.userId, data }))
    else dispatch(createUser(data))
  }

  const handleRemoveClick = () => {
    if (user && confirm(`Remove user "${user.username}"?\n\nTheir queued songs will also be removed.`)) {
      dispatch(removeUser(user.userId))
    }
  }

  const handleMoveToRoom = async () => {
    if (!user || !moveRoomId) return
    try {
      await api.put(`user/${user.userId}/room`, {
        body: { roomId: moveRoomId },
      })
      alert(`Moved ${user.username} to room "${rooms.entities[moveRoomId]?.name}"`)
      setMoveRoomId(null)
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    }
  }

  return (
    <Modal
      className={styles.modal}
      onClose={onClose}
      title={user ? user.username : 'Create User'}
    >
      <AccountForm user={user} onSubmit={handleSubmit} showRole autoFocus={!user}>
        <div className={styles.btnContainer}>
          {!user && (
            <Button type='submit' className={styles.btn} variant='primary'>
              Create User
            </Button>
          )}

          {user && (
            <Button type='submit' className={styles.btn} variant='primary'>
              Update User
            </Button>
          )}

          {user && (
            <Button onClick={handleRemoveClick} className={styles.btn} variant='danger'>
              Remove User
            </Button>
          )}

          <Button onClick={onClose} variant='default'>
            Cancel
          </Button>
        </div>
      </AccountForm>

      {user && rooms.result.length > 0 && (
        <div className={styles.roomAssign}>
          <label>Move to Room</label>
          <select
            value={moveRoomId ?? ''}
            onChange={(e) => setMoveRoomId(parseInt(e.target.value, 10) || null)}
          >
            <option value=''>Select a room...</option>
            {rooms.result.map(id => (
              <option key={id} value={id}>{rooms.entities[id].name}</option>
            ))}
          </select>
          {moveRoomId && (
            <Button onClick={handleMoveToRoom} variant='primary'>
              Move User
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}

export default EditUser
