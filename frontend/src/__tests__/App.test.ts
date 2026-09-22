import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import App from '../App.vue'
import { clearAuthSession } from '../services/api'

describe('End-to-End Terminal, Search, and Owner Auth Flow', () => {
  beforeEach(() => {
    clearAuthSession()
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

    // Test ls command (guest only sees public docs)
    await input.setValue('ls')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('ark')
    expect(wrapper.text()).toContain('articles')
    expect(wrapper.text()).toContain('about')
    expect(wrapper.text()).not.toContain('secret-vault')
    
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
    await input.setValue('open ark')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // WindowCard should appear
    expect(wrapper.find('.window-pane').exists()).toBe(true)
    expect(wrapper.text()).toContain('|_ark.exe')
    expect(wrapper.text()).toContain('扁舟 (Ark Project)')
    expect(wrapper.text()).toContain('这是一艘飞船。')

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

  it('blocks guest from opening private documents', async () => {
    const wrapper = mount(App)
    const input = wrapper.find('input')

    await input.setValue('open secret-vault')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // WindowCard must NOT be opened
    expect(wrapper.find('.window-pane').exists()).toBe(false)
    // Terminal shows permission denied error
    expect(wrapper.text()).toContain("Permission denied: 'secret-vault' is a private document")
  })

  it('handles sudo su password authentication, prompt switch to root, private search, and logout', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.find('input')

    // 1. Initiate sudo su
    await input.setValue('sudo su')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Prompt switches to password prompt
    expect(wrapper.text()).toContain('[sudo] password for guest:')

    // 2. Submit wrong password
    await input.setValue('wrong-password')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('sudo: 1 incorrect password attempt')
    expect(wrapper.text()).toContain('guest@long4changes:/$')

    // 3. Initiate auth and enter correct password
    await input.setValue('auth')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await input.setValue('cyberkb-root-secret')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('Authentication successful')
    // Dynamic prompt switches to root
    expect(wrapper.text()).toContain('root@long4changes:~#')

    // 4. Search for private content while authenticated as root
    await input.setValue('search 机密')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Verify [PRIVATE] tag is rendered
    expect(wrapper.text()).toContain('[PRIVATE]')
    expect(wrapper.text()).toContain('secret-vault')

    // 5. Open private document as root
    await input.setValue('open secret-vault')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.find('.window-pane').exists()).toBe(true)
    expect(wrapper.text()).toContain('|_secret-vault.exe')
    expect(wrapper.text()).toContain('机密知识切片')

    // 6. Logout command reverts to guest
    await input.setValue('logout')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('Session closed. Reverted to guest privileges.')
    expect(wrapper.text()).toContain('guest@long4changes:/$')

    wrapper.unmount()
  })
})
