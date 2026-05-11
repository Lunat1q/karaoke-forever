import IPC from '../lib/IPCBridge.js'
import {
  YOUTUBE_WORKER_STATUS,
} from '../../shared/actionTypes.js'

class Youtube {
  constructor () {
    this.isCanceling = false
    this.emitStatus = this.getStatusEmitter()
  }

  cancel () {
    this.isCanceling = true
  }

  getStatusEmitter () {
    return (text, pct, isProcessing = true) => {
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
