import { expect, it } from 'vitest'
import { runSketchWorkers } from '../server/githubRecon.ts'

it('processes screens sequentially by default or two at a time when requested', async () => {
  for (const parallel of [false, true]) {
    let active = 0
    let maximum = 0
    const events: string[] = []
    await runSketchWorkers([1, 2, 3], parallel, async (screen) => {
      events.push(`start-${screen}`)
      maximum = Math.max(maximum, ++active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      events.push(`end-${screen}`)
    })
    expect(maximum).toBe(parallel ? 2 : 1)
    if (!parallel) expect(events).toEqual(['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3'])
  }
})
