export type LoadGate = {
  run: <T>(fn: () => Promise<T>) => Promise<T>
}

export function createLoadGate(maxConcurrent: number): LoadGate {
  const cap = Math.max(1, Math.floor(maxConcurrent))
  let active = 0
  const waiters: (() => void)[] = []

  async function acquire(): Promise<void> {
    while (active >= cap) {
      await new Promise<void>((resolve) => {
        waiters.push(resolve)
      })
    }
    active++
  }

  function release(): void {
    active--
    waiters.shift()?.()
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    await acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }

  return { run }
}
