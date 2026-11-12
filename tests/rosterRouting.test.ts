import { afterEach, expect, it, vi } from 'vitest'

/**
 * pickModel routing for the wide-roster keys: the right transport, the right
 * label, and — the part the resident loop keys off — a truthful vision flag,
 * resolved from the curated menu rather than assumed.
 */

const mocks = vi.hoisted(() => ({ account: vi.fn() }))
/* no default marked: the fallback order decides */
vi.mock('../server/db/index.ts', () => ({ db: { select: () => ({ from: () => ({ where: async () => [] }) }) } }))
vi.mock('../server/localAgentPreferences.ts', () => ({ getLocalAgentPreference: async () => ({ enabled: false }) }))
vi.mock('../server/modelAccounts.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/modelAccounts.ts')>()
  return {
    ...original,
    getAccount: mocks.account,
    /* the routing reads every account; a test connects one (or none) */
    getAccounts: async (userId: string) => {
      const account = (await mocks.account(userId)) as Record<string, unknown> | null | undefined
      return account ? [{ enabled: true, connectedAt: 1, ...account }] : []
    },
  }
})

import { pickModel } from '../server/agentModel'

const request = { system: [{ text: 'Design', cache: true }], tools: [], messages: [], maxTokens: 2048 }

it('routes Z.ai through its fixed endpoint using the user key and model', async () => {
  mocks.account.mockResolvedValue({ kind: 'zai-key', userId: 'alice', apiKey: 'secret', model: 'glm-4.7' })
  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Done' } }] }), { status: 200 }))
  const model = await pickModel('alice')
  expect(model).toMatchObject({ provider: 'zai-key', vision: false })
  await model!.run(request)
  expect(spy.mock.calls[0]![0]).toBe('https://api.z.ai/api/coding/paas/v4/chat/completions')
  expect(spy.mock.calls[0]![1]).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer secret' } })
  expect(JSON.parse(String(spy.mock.calls[0]![1]?.body)).model).toBe('glm-4.7')
})
afterEach(() => {
  vi.restoreAllMocks()
  mocks.account.mockReset()
})

it('routes an OpenRouter account through the Chat Completions transport with its label', async () => {
  mocks.account.mockResolvedValue({
    kind: 'openrouter-key',
    userId: 'alice',
    apiKey: 'sk-or-alice',
    model: 'moonshotai/kimi-k2.6',
  })
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Done' } }] }), { status: 200 }))
  const model = await pickModel('alice')
  expect(model).toMatchObject({
    provider: 'openrouter-key',
    userId: 'alice',
    vision: true,
    label: 'OpenRouter (moonshotai/kimi-k2.6)',
  })
  expect(await model!.run(request)).toMatchObject({ stop_reason: 'end_turn' })
  expect(String(fetchSpy.mock.calls[0]![0])).toContain('openrouter.ai')
})

it('marks a text-only roster pick as vision: false', async () => {
  mocks.account.mockResolvedValue({ kind: 'openrouter-key', userId: 'a', apiKey: 'sk-or-a', model: 'z-ai/glm-5.3' })
  expect(await pickModel('a')).toMatchObject({ vision: false, label: 'OpenRouter (z-ai/glm-5.3)' })
})

it('treats an off-menu OpenRouter override as text-only, the safe degraded default', async () => {
  mocks.account.mockResolvedValue({ kind: 'openrouter-key', userId: 'a', apiKey: 'sk-or-a', model: 'acme/mystery-1' })
  expect(await pickModel('a')).toMatchObject({ vision: false })
})

it('routes a Gemini account with its default model and vision intact', async () => {
  mocks.account.mockResolvedValue({ kind: 'gemini-key', userId: 'bob', apiKey: 'AIzaBobKeyLongEnough123456789012' })
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Done' } }] }), { status: 200 }))
  const model = await pickModel('bob')
  expect(model).toMatchObject({ provider: 'gemini-key', vision: true, label: 'Gemini (gemini-3.7-flash)' })
  expect(await model!.run(request)).toMatchObject({ stop_reason: 'end_turn' })
  expect(String(fetchSpy.mock.calls[0]![0])).toContain('generativelanguage.googleapis.com')
})

it('routes a standard Z.ai API account to the standard billing endpoint', async () => {
  mocks.account.mockResolvedValue({ kind: 'zai-api-key', userId: 'alice', apiKey: 'api-secret', model: 'glm-4.7' })
  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Done' } }] }), { status: 200 }))
  const model = await pickModel('alice')
  expect(model).toMatchObject({ provider: 'zai-api-key', vision: false })
  await model!.run(request)
  expect(spy.mock.calls[0]![0]).toBe('https://api.z.ai/api/paas/v4/chat/completions')
  expect(spy.mock.calls[0]![1]).toMatchObject({ headers: { Authorization: 'Bearer api-secret' } })
})

it('sends images only when the user enables visual support', async () => {
  for (const vision of [false, true]) {
    mocks.account.mockResolvedValue({
      kind: 'zai-key',
      userId: 'alice',
      apiKey: 'secret',
      model: 'glm-5.3-flash',
      vision,
    })
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Done' } }] }), { status: 200 }))
    const model = await pickModel('alice')
    expect(model).toMatchObject({ vision })
    await model!.run({
      ...request,
      messages: [
        {
          role: 'user',
          content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } }],
        },
      ],
    })
    const payload = JSON.parse(String(spy.mock.calls[0]![1]?.body))
    expect(JSON.stringify(payload).includes('data:image/png;base64,aGVsbG8=')).toBe(vision)
    spy.mockRestore()
  }
})
