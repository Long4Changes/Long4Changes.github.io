import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Terminal from '../components/Terminal.vue'
import { clearAuthSession, setApiBase } from '../services/api'

describe('Reproduce Bug Symptoms: Chinese IME Input & Password Authentication', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAuthSession()
    setApiBase('')
  })

  it('REPRO 1: Chinese IME composition - pressing Enter during composition should NOT submit command', async () => {
    const wrapper = mount(Terminal, {
      props: {
        catalog: ['ark', 'articles'],
        isActive: true
      }
    })
    const input = wrapper.find('input')

    // Simulate user typing Chinese Pinyin e.g. "ceshi" (测试)
    // 1. compositionstart event
    await input.trigger('compositionstart')
    await input.setValue('ceshi')

    // 2. User presses Enter to confirm pinyin or select candidate in IME
    await input.trigger('keydown', { key: 'Enter', isComposing: true })
    await flushPromises()

    // EXPECTATION: The command "ceshi" should NOT have been executed or added to history as an error
    // If bug exists, history will contain "Command not found: ceshi"
    const text = wrapper.text()
    expect(text).not.toContain('Command not found: ceshi')
  })

  it('REPRO 2: Password copy-paste with trailing newline/whitespace must authenticate successfully', async () => {
    setApiBase('http://localhost:8000')
    let sentPasskey = ''
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url: any, init?: any) => {
      const body = JSON.parse(init?.body || '{}')
      sentPasskey = body.passkey
      if (body.passkey === 'cyberkb-root-secret') {
        return new Response(JSON.stringify({
          access_token: 'valid-token',
          token_type: 'bearer',
          role: 'root'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ detail: 'Invalid administrative passkey' }), { status: 401 })
    })

    const wrapper = mount(Terminal, {
      props: {
        catalog: ['ark'],
        isActive: true
      }
    })
    const input = wrapper.find('input')

    // Enter sudo su
    await input.setValue('sudo su')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Paste password with copied newline/spaces
    await input.setValue('cyberkb-root-secret\n')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Sent passkey should be trimmed and authentication should succeed
    expect(sentPasskey).toBe('cyberkb-root-secret')
    expect(wrapper.text()).toContain('Authentication successful')
  })

  it('REPRO 3: Offline / Static mode authentication fallback', async () => {
    // When apiBase is empty (e.g. GitHub Pages or offline)
    setApiBase('')
    const wrapper = mount(Terminal, {
      props: {
        catalog: ['ark'],
        isActive: true
      }
    })
    const input = wrapper.find('input')

    // Enter auth
    await input.setValue('auth')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Submit default root secret
    await input.setValue('cyberkb-root-secret')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Must not fail with "backend service not configured"
    expect(wrapper.text()).not.toContain('backend service not configured')
    expect(wrapper.text()).toContain('Authentication successful')
  })

  it('REPRO 4: Chinese IME composition - previewing english pinyin on screen before candidate selection', async () => {
    const wrapper = mount(Terminal, {
      props: {
        catalog: ['ark', 'articles'],
        isActive: true
      }
    })
    const input = wrapper.find('input')

    // Simulate user typing Chinese Pinyin e.g. "ceshi" (测试)
    await input.trigger('compositionstart')
    await input.trigger('compositionupdate', { data: 'ceshi' })
    await flushPromises()

    // During composition, the user expects to see the typed pinyin letters on the screen
    const inputDisplay = wrapper.find('.input-display')
    expect(inputDisplay.text()).toContain('ceshi')

    // When candidate is selected (e.g. "测试" chosen):
    // 1. compositionend fires
    // 2. input value updates with "测试"
    await input.trigger('compositionend', { data: '测试' })
    await input.setValue('测试')
    await flushPromises()

    // The composition preview disappears and the confirmed Chinese text takes its place
    expect(inputDisplay.text()).toBe('测试')
    expect(wrapper.find('.composition-preview').exists()).toBe(false)
  })

  it('REPRO 5: Password mode must mask composition preview and not leak plain text', async () => {
    const wrapper = mount(Terminal, {
      props: {
        catalog: ['ark'],
        isActive: true
      }
    })
    const input = wrapper.find('input')

    // Enter sudo su to enter password mode
    await input.setValue('sudo su')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Start composition while in password mode
    await input.trigger('compositionstart')
    await input.trigger('compositionupdate', { data: 'secret' })
    await flushPromises()

    const inputDisplay = wrapper.find('.input-display')
    // Plain text "secret" MUST NOT appear
    expect(inputDisplay.text()).not.toContain('secret')
    // Masked asterisks should appear
    expect(inputDisplay.text()).toContain('******')
  })
})


