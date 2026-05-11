import { exec } from 'child_process'
import type { Readable, Writable } from 'stream'

class Shell {
  static sleep (ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static promisifiedPipe (input: Readable, output: Writable): Promise<void> {
    let ended = false
    function end () {
      if (!ended) {
        ended = true
        ;(output as any).close?.()
        ;(input as any).close?.()
        return true
      }
    }

    return new Promise((resolve, reject) => {
      input.pipe(output)
      input.on('error', errorEnding)

      function niceEnding () {
        if (end()) resolve()
      }

      function errorEnding (error: Error) {
        if (end()) reject(error)
      }

      output.on('finish', niceEnding)
      output.on('end', niceEnding)
      output.on('error', errorEnding)
    })
  }

  static promisifiedExec (cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = process.env

      if (process.env.NODE_ENV === 'development') {
        env.LC_ALL = 'C.UTF-8'
        env.LANG = 'C.UTF-8'
      }

      exec(cmd, { env }, (error, stdout) => {
        if (error) {
          reject(error)
        }
        resolve(stdout)
      })
    })
  }
}

export default Shell
