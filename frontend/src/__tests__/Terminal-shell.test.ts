import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Terminal from '../components/Terminal.vue'
import { clearAuthSession, setApiBase } from '../services/api'

describe('Terminal with Virtual Shell Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAuthSession()
    setApiBase('')

    if (typeof Range !== 'undefined') {
      if (!Range.prototype.getClientRects) {
        Range.prototype.getClientRects = () => [] as unknown as DOMRectList
      }
      if (!Range.prototype.getBoundingClientRect) {
        Range.prototype.getBoundingClientRect = () => ({
          top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}
        }) as DOMRect
      }
    }
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

  it('handles mv command and blocks guest permissions', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')
    await input.setValue('mv ark.md ark_new.md')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain("cannot move 'ark.md' to 'ark_new.md': Permission denied")
  })

  it('handles rm command and blocks guest permissions', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')
    await input.setValue('rm ark.md')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain("cannot remove 'ark.md': Permission denied")
  })

  it('blocks guest from opening vim editor', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true },
      attachTo: document.body
    })
    const input = wrapper.find('input')
    await input.setValue('vim ark')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const editor = document.body.querySelector('[data-testid="vim-editor"]')
    expect(editor).toBeNull()
    expect(wrapper.text()).toContain("Permission denied: 'vim' requires root")
    wrapper.unmount()
  })

  it('opens vim editor when executing vim <slug> as root', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true },
      attachTo: document.body
    })
    // Switch to root
    wrapper.vm.role = 'root'

    const input = wrapper.find('input')
    await input.setValue('vim ark')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const editor = document.body.querySelector('[data-testid="vim-editor"]')
    expect(editor).not.toBeNull()
    expect(editor?.textContent).toContain('[VIM]')
    expect(editor?.textContent).toContain('ark.md')
    wrapper.unmount()
  })

  it('opens nvim editor when executing nvim <slug> as root', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true },
      attachTo: document.body
    })
    // Switch to root
    wrapper.vm.role = 'root'

    const input = wrapper.find('input')
    await input.setValue('nvim ark')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const editor = document.body.querySelector('[data-testid="vim-editor"]')
    expect(editor).not.toBeNull()
    expect(editor?.textContent).toContain('[NVIM]')
    expect(editor?.textContent).toContain('ark.md')
    wrapper.unmount()
  })
})

