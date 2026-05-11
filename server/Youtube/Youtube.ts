import IPC from '../lib/IPCBridge.js'
import {
  YOUTUBE_WORKER_STATUS,
} from '../../shared/actionTypes.js'

class Youtube {
  isCanceling: boolean
  emitStatus: (text: string, pct: number, isProcessing?: boolean) => void

  constructor () {
    this.isCanceling = false
    this.emitStatus = this.getStatusEmitter()
  }

  cancel () {
    this.isCanceling = true
  }

  getStatusEmitter () {
    return (text: string, pct: number, isProcessing = true) => {
      IPC.send({
        type: YOUTUBE_WORKER_STATUS,
        payload: {
          isProcessing,
          pct,
          text,
        },
        meta: {
          noAck: true,
        }
      })
    }
  }
}

export default Youtube
