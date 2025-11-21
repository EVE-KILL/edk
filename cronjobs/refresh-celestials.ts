import { spawn } from 'child_process'

export const name = 'refresh-celestials'
export const description = 'Refreshes the celestials materialized view'
export const schedule = '0 0 * * *' // Runs every day at midnight

export async function action() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['cli', 'sde:refresh-mv'], {
      stdio: 'inherit',
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Process exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}
