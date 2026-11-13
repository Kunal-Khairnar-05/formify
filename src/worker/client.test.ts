import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SINGLE_THREAD, transferables, type Reply, type Request } from './protocol'

/** Stands in for the browser's Worker: records what it is sent and lets a test reply. */
class FakeWorker {
  static made: FakeWorker[] = []
  name: string
  sent: Request[] = []
  ended = false
  onmessage: ((event: { data: Reply }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null

  constructor(_url: URL, options: { name: string }) {
    this.name = options.name
    FakeWorker.made.push(this)
  }
  postMessage(request: Request) {
    this.sent.push(request)
  }
  terminate() {
    this.ended = true
  }
  reply(reply: Reply) {
    this.onmessage?.({ data: reply })
  }
}

const spec = { widthPx: 140, heightPx: 60, format: 'jpg' as const, background: '#fff' }
const file = new Blob(['x'])

// the client keeps its worker between calls, so each test starts from a fresh copy of it
async function freshClient() {
  vi.resetModules()
  return import('./client')
}

beforeEach(() => {
  FakeWorker.made = []
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => vi.unstubAllGlobals())

describe('run', () => {
  it('starts one worker, on first use, and sends it the job', async () => {
    const { run } = await freshClient()
    expect(FakeWorker.made).toHaveLength(0)
    void run('guessTurns', [file, 'photo'])
    void run('guessTurns', [file, 'signature'])
    expect(FakeWorker.made).toHaveLength(1)
    expect(FakeWorker.made[0].sent.map((request) => request.job)).toEqual(['guessTurns', 'guessTurns'])
  })

  it('gives each job its own result, whatever order they come back in', async () => {
    const { run } = await freshClient()
    const first = run('guessTurns', [file, 'photo'])
    const second = run('guessTurns', [file, 'signature'])
    const [worker] = FakeWorker.made
    worker.reply({ id: worker.sent[1].id, type: 'done', result: 3 })
    worker.reply({ id: worker.sent[0].id, type: 'done', result: 1 })
    expect(await first).toBe(1)
    expect(await second).toBe(3)
  })

  it('passes progress on to the caller', async () => {
    const { run } = await freshClient()
    const stages: string[] = []
    const job = run('processSignature', [file, spec], (stage) => stages.push(stage))
    const [worker] = FakeWorker.made
    const { id } = worker.sent[0]
    worker.reply({ id, type: 'stage', stage: 'Finding the ink' })
    worker.reply({ id, type: 'stage', stage: 'Fitting the file size' })
    worker.reply({ id, type: 'done', result: {} })
    await job
    expect(stages).toEqual(['Finding the ink', 'Fitting the file size'])
  })

  it('rejects with the reason when a job fails, and keeps the worker', async () => {
    const { run } = await freshClient()
    const job = run('guessTurns', [file, 'photo'])
    const [worker] = FakeWorker.made
    worker.reply({ id: worker.sent[0].id, type: 'failed', message: 'not a picture' })
    await expect(job).rejects.toThrow('not a picture')
    void run('guessTurns', [file, 'photo'])
    expect(FakeWorker.made).toHaveLength(1)
  })

  it('ignores a reply for a job it no longer knows', async () => {
    const { run } = await freshClient()
    void run('guessTurns', [file, 'photo'])
    expect(() => FakeWorker.made[0].reply({ id: 999, type: 'done', result: 0 })).not.toThrow()
  })
})

describe('when the worker itself fails', () => {
  it('rejects every waiting job and starts a new worker for the next one', async () => {
    const { run } = await freshClient()
    const first = run('guessTurns', [file, 'photo'])
    const second = run('guessTurns', [file, 'signature'])
    FakeWorker.made[0].onerror?.({ message: 'out of memory' })
    await expect(first).rejects.toThrow('out of memory')
    await expect(second).rejects.toThrow('out of memory')
    expect(FakeWorker.made[0].ended).toBe(true)

    void run('guessTurns', [file, 'photo'])
    expect(FakeWorker.made).toHaveLength(2)
  })
})

describe('when threads will not start', () => {
  it('replaces the worker with one that uses no threads and gives it the same jobs', async () => {
    const { run } = await freshClient()
    const job = run('processPhoto', [file, spec, 'fast'])
    const [threaded] = FakeWorker.made
    expect(threaded.name).not.toBe(SINGLE_THREAD)

    threaded.reply({ type: 'threads-failed' })
    expect(threaded.ended).toBe(true)
    const single = FakeWorker.made[1]
    expect(single.name).toBe(SINGLE_THREAD)
    expect(single.sent).toEqual(threaded.sent)

    // the caller never sees any of this: the job simply finishes
    single.reply({ id: single.sent[0].id, type: 'done', result: 'made' })
    expect(await job).toBe('made')
  })

  it('does so only once, however many threads report failure', async () => {
    const { run } = await freshClient()
    void run('processPhoto', [file, spec, 'fast'])
    const [threaded] = FakeWorker.made
    threaded.reply({ type: 'threads-failed' })
    threaded.reply({ type: 'threads-failed' })
    FakeWorker.made[1].reply({ type: 'threads-failed' })
    expect(FakeWorker.made).toHaveLength(2)
  })

  it('stays without threads for every worker after that', async () => {
    const { run, cancelAll } = await freshClient()
    const job = run('processPhoto', [file, spec, 'fast'])
    FakeWorker.made[0].reply({ type: 'threads-failed' })
    cancelAll()
    await expect(job).rejects.toThrow('Cancelled')
    void run('guessTurns', [file, 'photo'])
    expect(FakeWorker.made[2].name).toBe(SINGLE_THREAD)
  })
})

describe('cancelAll', () => {
  it('ends the worker and rejects what was waiting as Cancelled', async () => {
    const { run, cancelAll, Cancelled } = await freshClient()
    const job = run('processPhoto', [file, spec, 'fast'])
    cancelAll()
    expect(FakeWorker.made[0].ended).toBe(true)
    await expect(job).rejects.toBeInstanceOf(Cancelled)
  })

  it('starts a new worker for the next job', async () => {
    const { run, cancelAll } = await freshClient()
    void run('guessTurns', [file, 'photo']).catch(() => {})
    cancelAll()
    void run('guessTurns', [file, 'photo'])
    expect(FakeWorker.made).toHaveLength(2)
  })

  it('does nothing when no worker has been started', async () => {
    const { cancelAll } = await freshClient()
    expect(() => cancelAll()).not.toThrow()
    expect(FakeWorker.made).toHaveLength(0)
  })
})

describe('transferables', () => {
  it('finds the buffer behind every array, however deep', () => {
    const mask = new Float32Array(4)
    const bytes = new Uint8Array(8)
    const found = transferables({ stages: { mask, exported: { bytes } }, timingsMs: { load: 3 } })
    expect(found).toHaveLength(2)
    expect(found).toContain(mask.buffer)
    expect(found).toContain(bytes.buffer)
  })

  it('lists a buffer once when two arrays share it', () => {
    const buffer = new ArrayBuffer(16)
    const found = transferables([new Uint8Array(buffer), new Float32Array(buffer), buffer])
    expect(found).toEqual([buffer])
  })

  it('leaves out a buffer that is shared between threads', () => {
    const shared = new Float32Array(new SharedArrayBuffer(8))
    expect(transferables({ shared })).toEqual([])
  })

  it('finds nothing in plain values, null, or a file', () => {
    expect(transferables({ turns: 3, note: 'x', none: null, missing: undefined, file })).toEqual([])
    expect(transferables(7)).toEqual([])
  })
})
