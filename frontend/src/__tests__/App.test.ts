import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import App from '../App.vue'

describe('End-to-End Terminal and WindowCard Search Flow', () => {
  it('renders Terminal and executes help, ls, and clear commands', async () => {
    const wrapper = mount(App)
    const terminal = wrapper.find('.terminal')
    expect(terminal.exists()).toBe(true)

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)

    // Test help command
    await input.setValue('help')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    
    expect(wrapper.text()).toContain('Available commands:')
    expect(wrapper.text()).toContain('search <query>')
    expect(wrapper.text()).toContain('open <slug>')

    // Test ls command
    await input.setValue('ls')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('ark')
    expect(wrapper.text()).toContain('articles')
    expect(wrapper.text()).toContain('about')
    
    // Test clear command
    await input.setValue('clear')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Available commands:')
  })

  it('opens WindowCard via open command and renders sanitized markdown with code block', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    
    // WindowCard should not exist initially
    expect(wrapper.find('.window-pane').exists()).toBe(false)

    const input = wrapper.find('input')
    await input.setValue('open ark')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // WindowCard should appear
    const windowPane = wrapper.find('.window-pane')
    expect(windowPane.exists()).toBe(true)
    
    // Contains title and markdown content
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

    // WindowCard should disappear
    expect(wrapper.find('.window-pane').exists()).toBe(false)
    
    // Open again using cat
    await input.setValue('cat articles')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.find('.window-pane').exists()).toBe(true)
    expect(wrapper.text()).toContain('|_articles.exe')
    
    // Close using Escape key
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(escapeEvent)
    await flushPromises()
    
    expect(wrapper.find('.window-pane').exists()).toBe(false)
    wrapper.unmount()
  })

  it('executes search command, formats ASCII cards, and clicking slug opens document', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.find('input')

    // Execute search for '飞船'
    await input.setValue('search 飞船')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Verify ASCII card elements exist
    const asciiCard = wrapper.find('.ascii-card')
    expect(asciiCard.exists()).toBe(true)
    expect(wrapper.text()).toContain('MATCH ::')
    expect(wrapper.text()).toContain('ark')
    expect(wrapper.text()).toContain('Title:')
    expect(wrapper.text()).toContain('Excerpt:')

    // Click the slug link inside the ASCII card
    const slugLink = wrapper.find('.slug-link')
    expect(slugLink.exists()).toBe(true)
    await slugLink.trigger('click')
    await flushPromises()

    // Document WindowCard should be opened
    expect(wrapper.find('.window-pane').exists()).toBe(true)
    expect(wrapper.text()).toContain('|_ark.exe')
    expect(wrapper.text()).toContain('这是一艘飞船。')

    wrapper.unmount()
  })
})
