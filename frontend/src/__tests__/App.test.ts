import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App.vue'
import { clearAuthSession, setApiBase } from '../services/api'

describe('End-to-End Terminal, Search, and Owner Auth Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAuthSession()
    setApiBase('')
  })

  it('renders Terminal and executes help, ls, and clear commands', async () => {
    const wrapper = mount(App)
    const terminal = wrapper.find('.terminal')
    expect(terminal.exists()).toBe(true)

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)

    // Initial prompt should be guest
    expect(wrapper.text()).toContain('guest@long4changes:/$')

    // Test help command
    await input.setValue('help')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    
    expect(wrapper.text()).toContain('Available commands:')
    expect(wrapper.text()).toContain('sudo su / auth')
    expect(wrapper.text()).toContain('logout')
    expect(wrapper.text()).toContain('search <query>')

    // Test ls command
    await input.setValue('ls')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('docs/')
    expect(wrapper.text()).toContain('bin/')

    // Test ls docs command
    await input.setValue('ls docs')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('hello-world.md')
    
    // Test clear command
    await input.setValue('clear')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Available commands:')
  })

  it('opens WindowCard via open command and renders sanitized markdown with code block', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    
    expect(wrapper.find('.window-pane').exists()).toBe(false)

    const input = wrapper.find('input')
    await input.setValue('open hello-world')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // WindowCard should appear
    expect(wrapper.find('.window-pane').exists()).toBe(true)
    expect(wrapper.text()).toContain('|_hello-world.exe')
    expect(wrapper.text()).toContain('你好，世界')
    expect(wrapper.text()).toContain('这是直接保存在本地')

    // Code block with syntax highlighting should be rendered
    const codeBlock = wrapper.find('pre.code-block code.hljs')
    expect(codeBlock.exists()).toBe(true)

    // Click to close
    const closeBtn = wrapper.find('.controls')
    await closeBtn.trigger('click')
    await flushPromises()

    expect(wrapper.find('.window-pane').exists()).toBe(false)
    wrapper.unmount()
  })

  it('blocks guest from opening private documents and preserves terminal state', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url)
      if (u.includes('/api/documents/secret-vault')) {
        return new Response(JSON.stringify({ detail: "Document 'secret-vault' is private." }), { status: 403 })
      }
      return new Response(JSON.stringify({ documents: [] }), { status: 200 })
    })

    const wrapper = mount(App)
    const input = wrapper.find('input')

    await input.setValue('open secret-vault')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // WindowCard must NOT be opened
    expect(wrapper.find('.window-pane').exists()).toBe(false)
    // Terminal shows visibility restriction error
    expect(wrapper.text()).toContain("Visibility restricted: 'secret-vault' is private")
  })

  it('handles sudo su password authentication, prompt switch to root, private search, and logout', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
      const u = String(url)
      if (u.includes('/api/auth')) {
        const body = JSON.parse(init?.body || '{}')
        if (body.passkey === 'correct-secret') {
          return new Response(JSON.stringify({
            access_token: 'test-root-token',
            token_type: 'bearer',
            role: 'root'
          }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ detail: 'Invalid administrative passkey' }), { status: 401 })
      }

      if (u.includes('/api/search')) {
        return new Response(JSON.stringify({
          query: 'secret',
          results: [
            {
              slug: 'secret-vault',
              title: '私有保险箱',
              chunk_index: 0,
              content: '机密知识切片',
              similarity: 0.95,
              visibility: 'private'
            }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (u.includes('/api/documents/secret-vault')) {
        return new Response(JSON.stringify({
          slug: 'secret-vault',
          title: '私有保险箱',
          content: '# 机密知识切片\n仅限 root 访问。',
          visibility: 'private',
          updated_at: '2026-09-22T00:00:00Z'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (u.includes('/api/documents')) {
        return new Response(JSON.stringify({ documents: [] }), { status: 200 })
      }

      return new Response(JSON.stringify({}), { status: 404 })
    })

    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.find('input')

    // 1. Initiate sudo su
    await input.setValue('sudo su')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Prompt switches to password prompt
    expect(wrapper.text()).toContain('[sudo] password for guest:')

    // 2. Submit wrong password (401 from backend)
    await input.setValue('wrong-password')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('sudo: 1 incorrect password attempt')
    expect(wrapper.text()).toContain('guest@long4changes:/$')

    // 3. Initiate auth and enter correct password (200 from backend)
    await input.setValue('auth')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await input.setValue('correct-secret')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('Authentication successful')
    // Dynamic prompt switches to root
    expect(wrapper.text()).toContain('root@long4changes:~#')

    // 4. Search while authenticated as root (returns private chunk)
    await input.setValue('search secret')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Verify [PRIVATE] tag is rendered
    expect(wrapper.text()).toContain('[PRIVATE]')
    expect(wrapper.text()).toContain('secret-vault')

    // 5. Open private document as root (200 from backend)
    await input.setValue('open secret-vault')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.find('.window-pane').exists()).toBe(true)
    expect(wrapper.text()).toContain('|_secret-vault.exe')
    expect(wrapper.text()).toContain('机密知识切片')

    // 6. Logout command closes private WindowCard and reverts prompt to guest
    await input.setValue('logout')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('Session closed. Reverted to guest privileges.')
    expect(wrapper.text()).toContain('guest@long4changes:/$')
    // Private WindowCard is closed on logout
    expect(wrapper.find('.window-pane').exists()).toBe(false)

    wrapper.unmount()
  })

  it('streams RAG response on ask command and clicking citation opens WindowCard', async () => {
    setApiBase('http://localhost:8000')

    const sseBody = [
      'event: delta',
      'data: {"content": "扁舟项目是一个"}',
      '',
      'event: delta',
      'data: {"content": "飞船终端。"}',
      '',
      'event: citations',
      'data: {"citations": [{"slug": "ark", "title": "扁舟 (Ark Project)", "visibility": "public"}]}',
      '',
      'event: done',
      'data: [DONE]',
      ''
    ].join('\n')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url)
      if (u.includes('/api/ask')) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseBody))
            controller.close()
          }
        })
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' }
        })
      }
      if (u.includes('/api/documents/ark')) {
        return new Response(JSON.stringify({
          slug: 'ark',
          title: '扁舟 (Ark Project)',
          content: '这是一艘飞船。',
          visibility: 'public'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ documents: [] }), { status: 200 })
    })

    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.find('input')

    // Ask question
    await input.setValue('ask 什么是扁舟？')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Answer rendered
    expect(wrapper.text()).toContain('扁舟项目是一个飞船终端。')

    // Citation badge rendered
    const citationBadge = wrapper.find('.citation-badge')
    expect(citationBadge.exists()).toBe(true)
    expect(citationBadge.text()).toContain('ark')

    // Click citation badge -> opens WindowCard
    await citationBadge.trigger('click')
    await flushPromises()

    expect(wrapper.find('.window-pane').exists()).toBe(true)
    expect(wrapper.text()).toContain('|_ark.exe')
    expect(wrapper.text()).toContain('这是一艘飞船。')

    wrapper.unmount()
  })

  it('blocks guest from sync command and executes sync successfully for root', async () => {
    setApiBase('http://localhost:8000')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
      const u = String(url)
      if (u.includes('/api/auth')) {
        return new Response(JSON.stringify({
          access_token: 'root-token',
          token_type: 'bearer',
          role: 'root'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (u.includes('/api/sync')) {
        const auth = init?.headers?.['Authorization']
        if (auth && auth.includes('root-token')) {
          return new Response(JSON.stringify({
            status: 'synchronized',
            synced_documents: ['sample-public', 'sample-private'],
            total: 2
          }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ detail: "Permission denied: 'sync' requires root" }), { status: 403 })
      }
      return new Response(JSON.stringify({ documents: [] }), { status: 200 })
    })

    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.find('input')

    // 1. Guest tries sync -> blocked
    await input.setValue('sync')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain("Permission denied: 'sync' requires root administrative privileges")

    // 2. Authenticate as root
    await input.setValue('auth')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await input.setValue('valid-passkey')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('root@long4changes:~#')

    // 3. Root executes sync -> successful ingestion summary
    await input.setValue('sync')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('GITOPS INGESTION SUMMARY')
    expect(wrapper.text()).toContain('SYNCHRONIZED')
    expect(wrapper.text()).toContain('sample-public')
    expect(wrapper.text()).toContain('sample-private')

    wrapper.unmount()
  })

  it('supports Tab key autocomplete for commands and document slugs', async () => {
    const wrapper = mount(App)
    const input = wrapper.find('input')

    // 1. Tab autocomplete unique command prefix: "se" -> "search "
    await input.setValue('se')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('search ')

    // 2. Tab autocomplete unique command prefix: "cl" -> "clear "
    await input.setValue('cl')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('clear ')

    // 3. Tab autocomplete document slug with unique prefix: "open he" -> "open hello-world"
    await input.setValue('open he')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('open hello-world')

    // 4. Tab autocomplete with multiple candidates: "c" displays candidates in terminal
    await input.setValue('c')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()
    expect(wrapper.text()).toContain('cat')
    expect(wrapper.text()).toContain('cd')
    expect(wrapper.text()).toContain('clear')

    // 5. Tab autocomplete sub-command: "sudo " -> "sudo su"
    await input.setValue('sudo ')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('sudo su')

    wrapper.unmount()
  })

  it('supports ArrowUp and ArrowDown keys to traverse command history', async () => {
    const wrapper = mount(App)
    const input = wrapper.find('input')

    // Execute sequence of commands
    await input.setValue('help')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await input.setValue('ls')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Start typing a draft
    await input.setValue('my draft')

    // ArrowUp 1: recall last command ('ls')
    await input.trigger('keydown', { key: 'ArrowUp' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('ls')

    // ArrowUp 2: recall previous command ('help')
    await input.trigger('keydown', { key: 'ArrowUp' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('help')

    // ArrowDown 1: forward to 'ls'
    await input.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('ls')

    // ArrowDown 2: return to original draft
    await input.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('my draft')

    wrapper.unmount()
  })
})


