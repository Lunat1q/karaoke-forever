import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import store from './store/store'
import socket from 'lib/socket'
import AppRouter from 'lib/AppRouter'
import { connectSocket } from './store/modules/user'
import Persistor from 'store/Persistor'

Persistor.init(store, () => {
  // rehydration complete; open socket connection
  // if it looks like we have a valid session
  if (store.getState().user.userId !== null) {
    store.dispatch(connectSocket())
    socket.open()
  }
})

socket.on('reconnect_attempt', () => {
  store.dispatch(connectSocket())
})

// toast functionality
socket.on('toast', (data: any) => {
  // don't show the toast on the player
  const isPlayer = window.location.pathname.replace(/\/$/, '').endsWith('/player')
  if (!isPlayer) {
    // dynamic import to avoid bundling if unused
    import('react-toastify').then(({ toast }) => {
      const defaultOptions = {
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      }
      const content = data.content
      delete data.content
      toast(content, { ...defaultOptions, ...data })
    })
  }
})

// ========================================================
// Go!
// ========================================================
createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <RouterProvider router={AppRouter} />
    </React.StrictMode>,
  )
