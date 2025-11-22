import { spawn } from 'child_process'

export const name = 'refresh-materialized-views'
export const description = 'Nightly full refresh of all materialized views via bun cli db:refresh'
export const schedule = '0 3 * * *' // 03:00 UTC daily

export async function action() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['cli', 'db:refresh'], {
      stdio: 'inherit'
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`db:refresh exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}
