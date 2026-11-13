import { SINGLE_THREAD, type JobName, type Jobs, type Reply, type Request } from './protocol'

/** Thrown into every job that was running when the work was cancelled. */
export class Cancelled extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'Cancelled'
  }
}

interface Waiting {
  /** Kept so the job can be given to a new worker if this one has to be replaced. */
  request: Request
  resolve: (result: never) => void
  reject: (error: Error) => void
  onStage?: (stage: string) => void
}

let worker: Worker | undefined
// set once threads have failed to start; every worker after that is started without them
let singleThread = false
let nextId = 1
const waiting = new Map<number, Waiting>()

/** End every job that is waiting, with this error. */
function failAll(error: Error) {
  for (const job of waiting.values()) job.reject(error)
  waiting.clear()
}

// The worker is started the first time it is needed, and started afresh after it has been
// stopped or has crashed, so one bad photo does not leave the page unable to make another.
function start(): Worker {
  const created = new Worker(new URL('./pipeline.worker.ts', import.meta.url), {
    type: 'module',
    name: singleThread ? SINGLE_THREAD : 'formify-pipeline',
  })
  created.onmessage = (event: MessageEvent<Reply>) => {
    const reply = event.data
    if (reply.type === 'threads-failed') {
      // only the worker now in use is replaced, and only once
      if (worker !== created || singleThread) return
      singleThread = true
      created.terminate()
      worker = start()
      // everything it was doing is started again; none of it was finished
      for (const job of waiting.values()) worker.postMessage(job.request)
      return
    }
    const job = waiting.get(reply.id)
    if (!job) return
    if (reply.type === 'stage') {
      job.onStage?.(reply.stage)
      return
    }
    waiting.delete(reply.id)
    if (reply.type === 'done') job.resolve(reply.result as never)
    else job.reject(new Error(reply.message))
  }
  // the worker itself failed (out of memory, or its script would not load)
  created.onerror = (event) => {
    if (worker === created) worker = undefined
    created.terminate()
    failAll(new Error(event.message || 'The background worker stopped unexpectedly.'))
  }
  return created
}

/** Ask the worker to do a job. `onStage` hears what it is doing as it goes. */
export function run<N extends JobName>(
  job: N,
  args: Jobs[N]['args'],
  onStage?: (stage: string) => void,
): Promise<Jobs[N]['result']> {
  worker ??= start()
  const id = nextId++
  const request: Request<N> = { id, job, args }
  return new Promise((resolve, reject) => {
    waiting.set(id, { request, resolve, reject, onStage })
    worker!.postMessage(request)
  })
}

/**
 * Stop whatever the worker is doing, at once. A job in the middle of a model cannot be
 * interrupted politely, so the worker is ended; the next job starts a new one, and the
 * model files come back from the browser's cache.
 */
export function cancelAll() {
  worker?.terminate()
  worker = undefined
  failAll(new Cancelled())
}
