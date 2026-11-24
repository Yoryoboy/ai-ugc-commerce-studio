import { expect, test } from 'claude-code/testing'

const VIDEO = 'mcp__claude_ai_Higgsfield__generate_video'
const IMAGE = 'mcp__claude_ai_Higgsfield__generate_image'
const IMAGE_BATCH = 'mcp__claude_ai_Higgsfield__generate_image_batch'

const text = (value: unknown) => ({ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) })
const cost = (credits: number) => ({ cost: { credits, credits_exact: credits } })
const submitted = { results: [{ id: 'j1', status: 'pending' }] }

const NEW_VIDEO = {
  model: 'seedance_2_5',
  resolution: '1080p',
  duration: 15,
  prompt: 'Una mujer muestra las patas de sommier',
}

type World = {
  /** Each question the guard asked: its text and option labels. */
  asks: { question: string; options: string[] }[]
  /** Each real (non get_cost) Higgsfield call that reached Claude Code. */
  generated: any[]
  /** Each get_cost call the guard made through $.mcp.call. */
  priced: any[]
  /** Each balance call. */
  balanceCalls: number
}

type Setup = {
  /** Is the cwd a studio? Default true. */
  studio?: boolean
  /** studio.json content. */
  studioJson?: unknown
  /** What the question is answered with; 'dismiss' makes ask reject. */
  answer?: string
  /** get_cost: price by params, or 'error' to make the call fail. */
  price?: (params: any) => number | 'error'
  /** The real generation's result text. */
  generationResult?: unknown
  /** Give the generation result as a plain string instead of text blocks. */
  generationAsString?: boolean
  /** Balance after generating. */
  balance?: number
  /** Path printed by the "latest file touched" process. */
  recent?: string
  files?: Record<string, unknown>
}

/** Registers every stub the mod needs and returns what they saw. Call before the first $ call. */
function world(on: any, setup: Setup = {}): World {
  const w: World = { asks: [], generated: [], priced: [], balanceCalls: 0 }
  const isStudio = setup.studio !== false
  const files: Record<string, unknown> = {
    'studio.json': setup.studioJson ?? { credits: { available: 1000 } },
    ...(setup.files ?? {}),
  }

  on('session.start', () => ({ cwd: '/studio' }))
  on('session.cwd', () => ({ value: '/studio' }))
  on('fs.exists', ($: any, e: any) => ({ value: isStudio && e.path === '/studio/studio.json' }))
  on('fs.read', ($: any, e: any) => {
    const key = Object.keys(files).find((k) => e.path === `/studio/${k}`)
    return key === undefined ? { deny: `no such file ${e.path}` } : { value: JSON.stringify(files[key]) }
  })
  on('process.run', () => ({ value: { exitCode: 0, stdout: setup.recent ?? '', stderr: '' } }))
  on('mcp.call', ($: any, e: any) => {
    if (e.tool === 'balance') {
      w.balanceCalls += 1
      return { value: { content: [text({ credits: setup.balance ?? 1010, subscription_plan_type: 'plus' })], isError: false } }
    }
    w.priced.push({ server: e.server, tool: e.tool, args: e.args })
    const price = (setup.price ?? (() => 'error'))(e.args.params)
    if (price === 'error') {
      return { value: { content: [text('cost unavailable')], isError: true } }
    }
    return { value: { content: [text(cost(price))], isError: false } }
  })
  on('tool.call', ($: any, e: any) => {
    if (e.tool === 'AskUserQuestion') {
      const q = e.questions[0]
      w.asks.push({ question: q.question, options: q.options.map((o: any) => o.label) })
      const answer = setup.answer ?? 'Generar'
      if (answer === 'dismiss') {
        return { deny: 'dismissed' }
      }
      return { result: { answers: { [q.question]: answer } } }
    }
    w.generated.push(e)
    const body = setup.generationResult ?? submitted
    return setup.generationAsString ? { result: JSON.stringify(body) } : { result: [text(body)] }
  })
  return w
}

const START = { surface: 'terminal', isInteractive: true, cwd: '/studio' } as const

const BAND = {
  plugin: 'ugc-studio',
  component: 'AbovePrompt',
  requestId: 'x',
  surface: 'terminal',
  viewport: { columns: 140, rows: 30 },
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 5,
    bodyColumns: 130,
    scroll: { offset: 0, bodyRows: 5 },
    view: {},
  },
} as const

/** The text of everything the band drew, or null when it drew nothing. */
async function bandText($: any): Promise<string | null> {
  const ui = await $.ui.mount(BAND)
  const title = await ui.find({ type: 'Text', text: /UGC Studio/ })
  if (title === undefined) {
    await ui.unmount()
    return null
  }
  const parts: string[] = []
  for (const re of [/UGC Studio/, /sesión/, /saldo/, /actores:/, /productos:/]) {
    const found = await ui.find({ type: 'Text', text: re })
    if (found !== undefined) parts.push(found.children.join(''))
  }
  await ui.unmount()
  return parts.join('')
}

test('outside a studio a generation passes with no question and nothing is drawn', async ($, on) => {
  const w = world(on, { studio: false })
  await $.session.start(START)
  const out = await $.tool.call({ tool: VIDEO, params: NEW_VIDEO })

  expect(w.asks).toEqual([])
  expect(w.priced).toEqual([])
  expect(w.generated).toHaveLength(1)
  expect(w.generated[0].params).toEqual(NEW_VIDEO)
  expect(out.result).toEqual([text(submitted)])
  expect(w.balanceCalls).toBe(0)
  expect(await bandText($)).toBe(null)
})

test('a get_cost call passes without a question and counts nothing', async ($, on) => {
  const w = world(on, { price: () => 80 })
  await $.session.start(START)
  const params = { ...NEW_VIDEO, get_cost: true }
  const out = await $.tool.call({ tool: VIDEO, params })

  expect(w.asks).toEqual([])
  expect(w.priced).toEqual([])
  expect(w.generated).toHaveLength(1)
  expect(w.generated[0].params).toEqual(params)
  expect(out.result).toEqual([text(submitted)])
  expect(w.balanceCalls).toBe(0)
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 0 cr · saldo 1000 cr')
})

test('a new 1080p video asks with the exact cost, runs on Generar and fills the meter', async ($, on) => {
  const w = world(on, {
    price: (p) => (p.draft === true ? 56 : 240),
    balance: 760,
    recent: './clientes/acme/MLA1/videos/v1/prompt-v1.md\n',
    files: {
      'clientes/acme/MLA1/producto.json': { title: 'Patas de sommier' },
      'clientes/acme/MLA1/videos/v1/video.json': { actorId: 'lucia' },
      'actores/lucia/actor.json': { name: 'Lucía' },
    },
  })
  await $.session.start(START)
  const out = await $.tool.call({ tool: VIDEO, params: NEW_VIDEO })

  // The guard priced the original call and its draft version with get_cost.
  expect(w.priced.map((p) => p.args.params)).toEqual([
    { ...NEW_VIDEO, get_cost: true },
    { model: 'seedance_2_5', duration: 15, prompt: NEW_VIDEO.prompt, draft: true, get_cost: true },
  ])
  expect(w.priced[0].server).toBe('claude_ai_Higgsfield')
  expect(w.priced[0].tool).toBe('generate_video')

  expect(w.asks).toHaveLength(1)
  expect(w.asks[0].question).toBe(
    [
      'UGC Studio · ¿Generar video? seedance_2_5 · 1080p · 15 s',
      'Cuesta 240 créditos (saldo 1000 → te quedan 760).',
      'Si la idea es nueva, conviene un borrador: 56 créditos (saldo 1000 → te quedan 944), y se finaliza a 1080p dentro de 7 días sin regenerar.',
    ].join('\n'),
  )
  expect(w.asks[0].options).toEqual(['Generar', 'Pasar a borrador', 'Cancelar'])

  // "Generar" ran the original params, and Claude got the untouched result.
  expect(w.generated).toHaveLength(1)
  expect(w.generated[0].params).toEqual(NEW_VIDEO)
  expect(out.result).toEqual([text(submitted)])

  expect(w.balanceCalls).toBe(1)
  expect(await bandText($)).toBe(
    '◆ UGC Studio  sesión 240 cr · saldo 760 cr   actores: Lucía 240   productos: Patas de sommier 240',
  )
})

test('Pasar a borrador runs the draft params, counts the draft price and tells Claude', async ($, on) => {
  const w = world(on, {
    answer: 'Pasar a borrador',
    price: (p) => (p.draft === true ? 56 : 240),
    balance: 944,
  })
  await $.session.start(START)
  const out = await $.tool.call({ tool: VIDEO, params: NEW_VIDEO })

  expect(w.generated).toHaveLength(1)
  expect(w.generated[0].params).toEqual({ model: 'seedance_2_5', duration: 15, prompt: NEW_VIDEO.prompt, draft: true })
  expect('resolution' in w.generated[0].params).toBe(false)

  expect(out.result).toHaveLength(2)
  expect(out.result[0]).toEqual(text(submitted))
  expect(out.result[1].type).toBe('text')
  expect(out.result[1].text).toContain('the user switched this generation to a 480p draft (draft: true)')
  expect(out.result[1].text).toContain('draft_job_id within 7 days')

  expect(await bandText($)).toBe('◆ UGC Studio  sesión 56 cr · saldo 944 cr')
})

test('Cancelar refuses the generation and counts nothing', async ($, on) => {
  const w = world(on, { answer: 'Cancelar', price: () => 240 })
  await $.session.start(START)
  const out = await $.tool.call({ tool: VIDEO, params: NEW_VIDEO })

  expect(w.asks).toHaveLength(1)
  expect(w.generated).toEqual([])
  expect(out.deny).toBe(
    'The user did not approve this Higgsfield generation in the UGC Studio spend guard, so it did not run and spent nothing. Ask the user what to change before trying again.',
  )
  expect(w.balanceCalls).toBe(0)
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 0 cr · saldo 1000 cr')
})

test('a dismissed question refuses the generation and counts nothing', async ($, on) => {
  const w = world(on, { answer: 'dismiss', price: () => 240 })
  await $.session.start(START)
  const out = await $.tool.call({ tool: VIDEO, params: NEW_VIDEO })

  expect(w.asks).toHaveLength(1)
  expect(w.generated).toEqual([])
  expect(out.deny).toBe(
    'The user did not approve this Higgsfield generation in the UGC Studio spend guard, so it did not run and spent nothing. Ask the user what to change before trying again.',
  )
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 0 cr · saldo 1000 cr')
})

test('typed text that is not an option refuses the generation and quotes the answer', async ($, on) => {
  const w = world(on, { answer: 'mejor dejala para mañana', price: () => 240 })
  await $.session.start(START)
  const out = await $.tool.call({ tool: VIDEO, params: NEW_VIDEO })

  expect(w.generated).toEqual([])
  expect(out.deny).toContain('The user answered: «mejor dejala para mañana».')
})

test('a draft, a finalize and an image offer only Generar and Cancelar', async ($, on) => {
  const w = world(on, { price: () => 10, balance: 990 })
  await $.session.start(START)

  await $.tool.call({ tool: VIDEO, params: { model: 'seedance_2_5', draft: true, duration: 15, prompt: 'p' } })
  await $.tool.call({ tool: VIDEO, params: { model: 'seedance_2_5', draft_job_id: 'job-9', resolution: '1080p' } })
  await $.tool.call({ tool: VIDEO, params: { model: 'seedance_2_5', resolution: '720p', duration: 5, prompt: 'p' } })
  await $.tool.call({ tool: IMAGE, params: { model: 'gpt_image_2_6', prompt: 'p' } })

  expect(w.asks.map((a) => a.options)).toEqual([
    ['Generar', 'Cancelar'],
    ['Generar', 'Cancelar'],
    ['Generar', 'Cancelar'],
    ['Generar', 'Cancelar'],
  ])
  expect(w.asks[0].question.split('\n')[0]).toBe('UGC Studio · ¿Generar video? seedance_2_5 · borrador 480p · 15 s')
  expect(w.asks[0].question).not.toContain('borrador:')
  expect(w.asks[1].question.split('\n')[0]).toBe('UGC Studio · ¿Generar video? seedance_2_5 · finalizar borrador')
  expect(w.asks[3].question).toBe('UGC Studio · ¿Generar imagen? gpt_image_2_6\nCuesta 10 créditos (saldo 990 → te quedan 980).')
  expect(w.generated).toHaveLength(4)
})

test('without a price from get_cost the question shows the estimate with ~', async ($, on) => {
  const w = world(on, { price: () => 'error' })
  await $.session.start(START)
  await $.tool.call({ tool: VIDEO, params: NEW_VIDEO })

  // 1080p costs 16 credits per second in references/costs.md; a draft 3.
  expect(w.asks[0].question).toBe(
    [
      'UGC Studio · ¿Generar video? seedance_2_5 · 1080p · 15 s',
      'Cuesta ~240 créditos (saldo 1000 → te quedan 760).',
      'Si la idea es nueva, conviene un borrador: ~45 créditos (saldo 1000 → te quedan 955), y se finaliza a 1080p dentro de 7 días sin regenerar.',
    ].join('\n'),
  )
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 240 cr · saldo 1010 cr')
})

test('without a price and without an estimate the question says so and nothing is counted', async ($, on) => {
  const w = world(on, { price: () => 'error' })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE, params: { model: 'otro_modelo', prompt: 'p' } })

  expect(w.asks[0].question).toBe('UGC Studio · ¿Generar imagen? otro_modelo\nCuesta un precio que no pude calcular.')
  expect(w.generated).toHaveLength(1)
  expect(w.balanceCalls).toBe(0)
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 0 cr · saldo 1000 cr')
})

test('an unlim_choice answer submitted nothing, so nothing is counted', async ($, on) => {
  const w = world(on, {
    price: () => 240,
    generationResult: { status: 'unlim_choice', message: 'Choose use_unlim true or false' },
  })
  await $.session.start(START)
  const out = await $.tool.call({ tool: VIDEO, params: NEW_VIDEO })

  expect(w.generated).toHaveLength(1)
  expect(out.result[0].text).toContain('unlim_choice')
  expect(w.balanceCalls).toBe(0)
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 0 cr · saldo 1000 cr')
})

test('a batch counts only the share that was submitted', async ($, on) => {
  const w = world(on, {
    price: () => 3,
    generationResult: { jobs: [{ id: 'a' }, { id: 'b' }], submitted_count: 2, failed_count: 1 },
    balance: 994,
  })
  await $.session.start(START)
  const requests = [1, 2, 3].map((n) => ({ params: { model: 'gpt_image_2_6', prompt: `p${n}` } }))
  await $.tool.call({ tool: IMAGE_BATCH, requests })

  // One get_cost per request, then one question for the whole batch.
  expect(w.priced.map((p) => p.args.params.prompt)).toEqual(['p1', 'p2', 'p3'])
  expect(w.priced.every((p) => p.tool === 'generate_image')).toBe(true)
  expect(w.asks).toHaveLength(1)
  expect(w.asks[0].question).toBe(
    'UGC Studio · ¿Generar imágenes? gpt_image_2_6 · 3 pedidos\nCuesta 9 créditos (saldo 1000 → te quedan 991).',
  )
  expect(w.asks[0].options).toEqual(['Generar', 'Cancelar'])
  expect(w.generated).toHaveLength(1)
  expect(w.generated[0].requests).toEqual(requests)

  // 9 credits * 2 submitted / 3 requests = 6
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 6 cr · saldo 994 cr')
})

test('an unknown owner counts only in the session total', async ($, on) => {
  world(on, { price: () => 15, recent: '' })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE, params: { model: 'gpt_image_2_6', prompt: 'p' } })

  const band = await bandText($)
  expect(band).toBe('◆ UGC Studio  sesión 15 cr · saldo 1010 cr')
})

test('the actor alone is attributed from an actor file', async ($, on) => {
  world(on, {
    price: () => 15,
    recent: 'actores/lucia/retrato.json\n',
    files: { 'actores/lucia/actor.json': { name: 'Lucía' } },
  })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE, params: { model: 'gpt_image_2_6', prompt: 'p' } })
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 15 cr · saldo 1010 cr   actores: Lucía 15')
})

test('the brand kit of a client is not counted as a product', async ($, on) => {
  world(on, { price: () => 15, recent: './clientes/acme/marca/kit.json\n' })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE, params: { model: 'gpt_image_2_6', prompt: 'p' } })
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 15 cr · saldo 1010 cr')
})

test('a name that cannot be read falls back to the folder id', async ($, on) => {
  world(on, { price: () => 15, recent: 'clientes/acme/MLA9/producto.json\n' })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE, params: { model: 'gpt_image_2_6', prompt: 'p' } })
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 15 cr · saldo 1010 cr   productos: MLA9 15')
})

test('spend adds up across generations and a new session starts the meter again', async ($, on) => {
  world(on, { price: () => 15, balance: 970, recent: 'actores/lucia/actor.json\n', files: { 'actores/lucia/actor.json': { name: 'Lucía' } } })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE, params: { model: 'gpt_image_2_6', prompt: 'a' } })
  await $.tool.call({ tool: IMAGE, params: { model: 'gpt_image_2_6', prompt: 'b' } })
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 30 cr · saldo 970 cr   actores: Lucía 30')

  await $.session.start(START)
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 0 cr · saldo 1000 cr')
})

test('a narrow band drops the breakdown and keeps the session and the balance', async ($, on) => {
  world(on, { price: () => 15, recent: 'actores/lucia/actor.json\n', files: { 'actores/lucia/actor.json': { name: 'Lucía' } } })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE, params: { model: 'gpt_image_2_6', prompt: 'a' } })
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 50 } })
  expect(await ui.find({ type: 'Text', text: /sesión 15 cr/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /actores:/ })).toBeUndefined()
  await ui.unmount()
})

test('a generation result given as a JSON string is read for unlim_choice and submitted_count', async ($, on) => {
  const w = world(on, {
    price: () => 3,
    generationAsString: true,
    generationResult: { jobs: [{ id: 'a' }], submitted_count: 1, failed_count: 1 },
  })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE_BATCH, requests: [{ params: { prompt: 'a' } }, { params: { prompt: 'b' } }] })
  expect(w.asks).toHaveLength(1)
  // 6 credits * 1 submitted / 2 requests = 3
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 3 cr · saldo 1010 cr')
})

test('a batch of one request that submitted nothing counts nothing', async ($, on) => {
  const w = world(on, {
    price: () => 3,
    generationResult: { jobs: [], submitted_count: 0, failed_count: 1 },
  })
  await $.session.start(START)
  await $.tool.call({ tool: IMAGE_BATCH, requests: [{ params: { model: 'gpt_image_2_6', prompt: 'a' } }] })
  expect(w.asks).toHaveLength(1)
  expect(w.balanceCalls).toBe(0)
  expect(await bandText($)).toBe('◆ UGC Studio  sesión 0 cr · saldo 1000 cr')
})

test('the band stays hidden while a survey is on screen', async ($, on) => {
  world(on)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })
  expect(await ui.find({ type: 'Text', text: /UGC Studio/ })).toBeUndefined()
  await ui.unmount()
})

// Not covered: the .catch handler that denies when the guard throws before next.
// The kit only accepts plain data, and with plain data every call the guard makes
// ($.fs, $.process, $.mcp, $.ui.ask) sits in a try/catch, so no input can make it
// throw from a test.
