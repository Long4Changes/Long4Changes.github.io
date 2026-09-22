import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Terminal from '../components/Terminal.vue'
import { clearAuthSession, setApiBase } from '../services/api'

describe('Terminal with Virtual Shell Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAuthSession()
    setApiBase('')
  })

  it('executes neofetch and renders system specs in terminal stream', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')
    await input.setValue('neofetch')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('guest@long4changes')
    expect(wrapper.text()).toContain('CyberKB GNU/Linux')
    expect(wrapper.text()).toContain('梁晨')
  })

  it('executes cd and dynamically updates terminal prompt string', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')

    // Initial prompt has /
    expect(wrapper.text()).toContain('guest@long4changes:/$')

    // CD to ~
    await input.setValue('cd ~')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('guest@long4changes:~$')

    // CD to /docs
    await input.setValue('cd /docs')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Prompt updated to /docs
    expect(wrapper.text()).toContain('guest@long4changes:/docs$')
  })

  it('executes whoami, pwd, uname, and uptime', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark'], isActive: true }
    })
    const input = wrapper.find('input')

    await input.setValue('whoami')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('guest')

    await input.setValue('uname -a')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('Linux long4changes 6.6.0-cyberkb')
  })

  it('executes bat and renders bordered file header with line numbers', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark'], isActive: true }
    })
    const input = wrapper.find('input')

    await input.setValue('bat ark')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('File: ark.md')
    expect(wrapper.text()).toContain('扁舟 (Ark Project)')
  })

  it('completes tldr subcommands on Tab', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')
    await input.setValue('tldr sea')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()

    // Input buffer autocompleted to 'tldr search '
    expect((input.element as HTMLInputElement).value).toContain('tldr search')
  })

  it('completes bat/glow slugs on Tab', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')
    await input.setValue('bat ar')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()

    // Both match 'ark' and 'articles', common prefix is 'bat ar'
    // Now test unique match 'bat art'
    await input.setValue('bat art')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toContain('bat articles')
  })
})
