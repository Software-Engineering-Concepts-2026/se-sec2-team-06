// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderTutorPage } from '../src/pages/TutorPage.js';

const tagCatalog = {
  tags: [
    { id: 1, name: 'คณิตศาสตร์', color: 'blue', is_builtin: true, parent_id: null },
    { id: 11, name: 'เซต', parent_id: 1, color: 'violet', is_builtin: false },
    { id: 2, name: 'ฟิสิกส์', color: 'cyan', is_builtin: true, parent_id: null },
  ],
};

const aiCatalog = {
  providers: [
    { id: 'gemini', name: 'Gemini', models: [{ id: 'gemini-3.8-flash', name: 'gemini-3.8-flash', supports_images: false }] },
    { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5.4-mini', name: 'gpt-5.4-mini', supports_images: false }] },
  ],
  default_selection: { provider_id: 'gemini', model_id: 'gemini-3.8-flash' },
};

const imageAiCatalog = {
  providers: [
    { id: 'gemini', name: 'Gemini', models: [{ id: 'gemini-3.8-flash', name: 'gemini-3.8-flash', supports_images: true }] },
    { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5.4-mini', name: 'gpt-5.4-mini', supports_images: true }] },
  ],
  default_selection: { provider_id: 'openai', model_id: 'gpt-5.4-mini' },
};

function message(id, role, kind, content, sequence = id) {
  return { id, sequence, role, kind, content, created_at: '2026-10-12T09:00:00Z' };
}

function conversation(overrides = {}) {
  return {
    id: 7,
    title: 'อธิบายเซตว่าง',
    status: 'answered',
    provider_id: 'openai',
    model_id: 'gpt-5.6-luna-pro',
    created_at: '2026-10-12T09:00:00Z',
    updated_at: '2026-10-12T09:02:00Z',
    tags: [{ id: 1, name: 'คณิตศาสตร์', color: 'blue', parent_id: null, is_builtin: true }],
    messages: [
      message(1, 'user', 'question', 'อธิบายเซตว่าง'),
      message(2, 'assistant', 'answer', 'เซตว่างเป็นสับเซตของทุกเซต'),
    ],
    ...overrides,
  };
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function submit(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function chooseImages(page, files) {
  const input = page.querySelector('[data-role="tutor-image-input"]');
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function mount(overrides = {}) {
  const dependencies = {
    loadConversations: vi.fn().mockResolvedValue([]),
    loadConversation: vi.fn().mockResolvedValue(conversation()),
    createConversation: vi.fn().mockResolvedValue(conversation()),
    createConversationWithImages: vi.fn().mockResolvedValue(conversation()),
    sendMessage: vi.fn().mockResolvedValue(conversation()),
    sendMessageWithImages: vi.fn().mockResolvedValue(conversation()),
    retryMessage: vi.fn().mockResolvedValue(conversation()),
    loadTags: vi.fn().mockResolvedValue(tagCatalog),
    loadProviders: vi.fn().mockResolvedValue(aiCatalog),
    createTag: vi.fn(),
    navigate: vi.fn(),
    ...overrides,
  };
  const page = renderTutorPage(dependencies);
  document.body.replaceChildren(page);
  return { page, dependencies };
}

afterEach(() => document.body.replaceChildren());

describe('AI tutor page', () => {
  it('test_tutor_provider_model_and_language_selects_keep_labels', async () => {
    const { page } = mount();
    await flushPromises();

    const selects = ['[data-role="tutor-provider"]', '[data-role="tutor-model"]', '[data-role="tutor-response-language"]', '[data-role="tutor-tag-filter"]']
      .map((selector) => page.querySelector(selector));
    for (const select of selects) {
      expect(select.tagName).toBe('SELECT');
      expect(select.classList.contains('themed-select')).toBe(true);
      expect(select.getAttribute('aria-label') || select.labels[0]?.textContent.trim()).toBeTruthy();
    }
    expect(selects.slice(0, 3).map(({ value }) => value)).toEqual(['gemini', 'gemini-3.8-flash', 'th']);
  });

  it('keeps the composer submit control as an icon with an accessible action label', async () => {
    const page = await renderTutorPage();
    const submit = page.querySelector('[data-action="send-tutor-message"]');
    const icon = submit.querySelector('svg[aria-hidden="true"]');

    expect(icon).not.toBeNull();
    expect(icon.querySelectorAll('path')).toHaveLength(2);
    expect(icon.querySelector('path')?.getAttribute('d')).toBe('m22 2-7 20-4-9-9-4Z');
    expect(submit.textContent.trim()).toBe('');
    expect(submit.getAttribute('aria-label')).toBe('ส่งคำถาม');
  });

  it('starts the composer at two rows and grows until ten rows before scrolling', async () => {
    const page = await renderTutorPage();
    const input = page.querySelector('[data-role="tutor-input"]');
    expect(input.rows).toBe(2);
    expect(input.dataset.maxRows).toBe('10');

    let contentHeight = 48;
    Object.defineProperty(input, 'scrollHeight', {
      configurable: true,
      get: () => contentHeight,
    });
    const initialHeight = Number.parseFloat(input.style.height);

    contentHeight = 140;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const expandedHeight = Number.parseFloat(input.style.height);
    expect(expandedHeight).toBeGreaterThan(initialHeight);
    expect(input.style.overflowY).toBe('hidden');

    contentHeight = 500;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const cappedHeight = Number.parseFloat(input.style.height);
    expect(cappedHeight).toBeLessThan(contentHeight);
    expect(cappedHeight).toBeGreaterThan(expandedHeight);
    expect(input.style.overflowY).toBe('auto');
  });

  it('keeps Tutor inside the shared app shell and uses theme tokens for its workspace', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).not.toMatch(/#app\.app--tutor > \.app-navigation[\s\S]{0,100}display:\s*none/);
    expect(styles).toMatch(/#app\.app--tutor\s*\{[^}]*--tutor-background:\s*var\(--page\)/);
    expect(styles).toMatch(/#app\.app--tutor\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
    expect(styles).toMatch(/#app\.app--tutor > main\s*\{[^}]*padding:\s*0 0 calc\(5\.8rem \+ env\(safe-area-inset-bottom\)\)/);
    expect(styles).toMatch(/#app\.app--tutor \.tutor-send-button\s*\{[^}]*min-height:\s*2\.45rem/);
  });

  it('does not submit a blank question and asks the learner to enter one', async () => {
    const { page, dependencies } = mount();
    await flushPromises();

    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(dependencies.createConversation).not.toHaveBeenCalled();
    expect(dependencies.sendMessage).not.toHaveBeenCalled();
    expect(page.querySelector('[data-role="tutor-page-message"]')?.textContent).toContain('กรุณาพิมพ์คำถาม');
  });

  it('shows a processing state, then renders the assistant clarification', async () => {
    let resolveRequest;
    const pending = new Promise((resolve) => { resolveRequest = resolve; });
    const createConversation = vi.fn().mockReturnValue(pending);
    const { page } = mount({ createConversation });
    await flushPromises();

    page.querySelector('[data-role="tutor-input"]').value = 'เซตว่างเป็นสับเซตของทุกเซตได้อย่างไร';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(page.querySelector('[data-role="tutor-status"]')?.textContent).toContain('กำลังประมวลผล');
    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      message: 'เซตว่างเป็นสับเซตของทุกเซตได้อย่างไร',
      tag_ids: [],
      request_id: expect.any(String),
    }));

    resolveRequest(conversation({
      status: 'awaiting_clarification',
      messages: [
        message(1, 'user', 'question', 'เซตว่างเป็นสับเซตของทุกเซตได้อย่างไร'),
        message(2, 'assistant', 'clarification', 'กำลังถามถึงนิยามสับเซตใช่ไหม'),
      ],
    }));
    await flushPromises();

    expect(page.querySelector('[data-role="tutor-status"]')?.textContent).toContain('รอคำตอบเพิ่มเติม');
    expect(page.querySelector('[data-role="tutor-messages"]')?.textContent).toContain('กำลังถามถึงนิยามสับเซตใช่ไหม');
  });

  it('reopens a pending clarification and sends the learner reply into the same conversation', async () => {
    const pendingConversation = conversation({
      id: 18,
      status: 'awaiting_clarification',
      messages: [
        message(1, 'user', 'question', 'ช่วยอธิบายเรื่องเซต'),
        message(2, 'assistant', 'clarification', 'ติดตรงการเป็นสับเซตหรือการรวมเซต'),
      ],
    });
    const { page, dependencies } = mount({
      loadConversations: vi.fn().mockResolvedValue([pendingConversation]),
      loadConversation: vi.fn().mockResolvedValue(pendingConversation),
      sendMessage: vi.fn().mockResolvedValue(conversation({
        id: 18,
        messages: [...pendingConversation.messages, message(3, 'user', 'clarification_reply', 'การเป็นสับเซต', 3), message(4, 'assistant', 'answer', 'เข้าใจแล้ว', 4)],
      })),
    });
    await flushPromises();

    page.querySelector('[data-conversation-id="18"] [data-action="open-conversation"]').click();
    await flushPromises();
    expect(page.querySelector('[data-role="tutor-status"]')?.textContent).toContain('รอคำตอบเพิ่มเติม');

    page.querySelector('[data-role="tutor-input"]').value = 'การเป็นสับเซต';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(dependencies.sendMessage).toHaveBeenCalledWith(18, {
      message: 'การเป็นสับเซต',
      request_id: expect.any(String),
      provider_id: 'openai',
      model_id: 'gpt-5.4-mini',
      response_language: 'th',
    });
    expect(page.querySelector('[data-role="tutor-messages"]')?.textContent).toContain('เข้าใจแล้ว');
  });

  it('retries an uncertain start without duplicating the question or changing its request ID', async () => {
    const savedConversation = conversation({ status: 'answered' });
    const createConversation = vi.fn()
      .mockRejectedValueOnce(new Error('การเชื่อมต่อขาดหาย'))
      .mockResolvedValueOnce(savedConversation);
    const { page } = mount({ createConversation });
    await flushPromises();

    page.querySelector('[data-role="tutor-input"]').value = '  อธิบายเซตว่าง  ';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();
    const firstPayload = createConversation.mock.calls[0][0];
    expect(page.querySelector('[data-role="tutor-messages"]')?.textContent).toContain('อธิบายเซตว่าง');
    expect(page.querySelector('[data-action="retry-tutor"]')).not.toBeNull();
    expect(page.querySelector('[data-role="tutor-page-message"]')?.textContent).toContain('การเชื่อมต่อขาดหาย');

    page.querySelector('[data-action="retry-tutor"]').click();
    await flushPromises();

    expect(createConversation).toHaveBeenCalledTimes(2);
    expect(createConversation.mock.calls[1][0]).toEqual(firstPayload);
    expect(page.querySelector('[data-role="tutor-messages"]')?.textContent).toContain('เซตว่างเป็นสับเซตของทุกเซต');
  });

  it('retries a server-saved failure by conversation ID instead of creating a duplicate', async () => {
    const saved = conversation({ id: 29, status: 'retryable_error' });
    const providerError = new Error('บริการ AI ยังไม่พร้อม');
    providerError.detail = { code: 'tutor_provider_unavailable', conversation_id: 29, retryable: true };
    const createConversation = vi.fn().mockRejectedValue(providerError);
    const retryMessage = vi.fn().mockResolvedValue(conversation({ id: 29 }));
    const { page } = mount({
      createConversation,
      loadConversation: vi.fn().mockResolvedValue(saved),
      retryMessage,
    });
    await flushPromises();

    page.querySelector('[data-role="tutor-input"]').value = 'อธิบายเซตว่าง';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();
    const retry = page.querySelector('[data-action="retry-tutor"]');
    expect(retry.dataset.conversationId).toBe('29');
    expect(page.querySelector('[data-role="tutor-messages"]')?.textContent).toContain('อธิบายเซตว่าง');

    retry.click();
    await flushPromises();

    expect(createConversation).toHaveBeenCalledOnce();
    expect(retryMessage).toHaveBeenCalledWith(29, {
      provider_id: 'gemini',
      model_id: 'gemini-3.8-flash',
      response_language: 'th',
    });
    expect(page.querySelector('[data-role="tutor-status"]')?.textContent).toContain('ตอบแล้ว');
  });

  it('replays an uncertain follow-up with its request ID instead of retrying the previous AI turn', async () => {
    const saved = conversation({ id: 31 });
    const completed = conversation({
      id: 31,
      messages: [
        ...saved.messages,
        message(3, 'user', 'clarification_reply', 'ช่วยยกตัวอย่างเพิ่ม', 3),
        message(4, 'assistant', 'answer', 'ตัวอย่างเพิ่มเติม', 4),
      ],
    });
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error('การเชื่อมต่อขาดหาย'))
      .mockResolvedValueOnce(completed);
    const retryMessage = vi.fn();
    const { page } = mount({
      loadConversations: vi.fn().mockResolvedValue([saved]),
      loadConversation: vi.fn().mockResolvedValue(saved),
      sendMessage,
      retryMessage,
    });
    await flushPromises();

    page.querySelector('[data-conversation-id="31"] [data-action="open-conversation"]').click();
    await flushPromises();
    page.querySelector('[data-role="tutor-input"]').value = 'ช่วยยกตัวอย่างเพิ่ม';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();
    const firstPayload = sendMessage.mock.calls[0][1];

    expect(page.querySelector('[data-role="tutor-status"]')?.textContent).toContain('ตอบแล้ว');
    page.querySelector('[data-action="retry-tutor"]').click();
    await flushPromises();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[1]).toEqual([31, firstPayload]);
    expect(retryMessage).not.toHaveBeenCalled();
    expect(page.querySelector('[data-role="tutor-messages"]')?.textContent).toContain('ตัวอย่างเพิ่มเติม');
  });

  it('filters conversation history by search and a shared subject tag', async () => {
    const physics = conversation({ id: 21, title: 'แรงและการเคลื่อนที่', tags: [tagCatalog.tags[2]] });
    const mathematics = conversation({ id: 22, title: 'ทฤษฎีเซต', tags: [tagCatalog.tags[0]] });
    const loadConversations = vi.fn()
      .mockResolvedValueOnce([physics, mathematics])
      .mockResolvedValueOnce([physics]);
    const { page } = mount({ loadConversations });
    await flushPromises();

    const filter = page.querySelector('[data-role="tutor-tag-filter"]');
    expect(filter.querySelector('option[value="2"]')?.textContent).toBe('ฟิสิกส์');
    page.querySelector('[data-role="tutor-search"]').value = 'แรง';
    filter.value = '2';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    submit(page.querySelector('[data-role="tutor-search-form"]'));
    await flushPromises();

    expect(loadConversations).toHaveBeenLastCalledWith({ q: 'แรง', tagId: 2 });
    expect([...page.querySelectorAll('.tutor-history-card')].map((item) => item.dataset.conversationId)).toEqual(['21']);
  });

  it('sends the selected provider and model with a new tutor message', async () => {
    const createConversation = vi.fn().mockResolvedValue(conversation());
    const { page } = mount({ createConversation });
    await flushPromises();

    const provider = page.querySelector('[data-role="tutor-provider"]');
    const model = page.querySelector('[data-role="tutor-model"]');
    expect(provider.value).toBe('gemini');
    expect(model.value).toBe('gemini-3.8-flash');
    provider.value = 'openai';
    provider.dispatchEvent(new Event('change', { bubbles: true }));
    expect([...model.options].map((option) => option.value)).toEqual(['gpt-5.4-mini']);
    model.value = 'gpt-5.4-mini';

    page.querySelector('[data-role="tutor-input"]').value = 'ช่วยอธิบายเรื่องเซต';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      message: 'ช่วยอธิบายเรื่องเซต',
      provider_id: 'openai',
      model_id: 'gpt-5.4-mini',
    }));
  });

  it('opens the provider and model picker from the composer and closes after choosing a model', async () => {
    const createConversation = vi.fn().mockResolvedValue(conversation());
    const { page } = mount({ createConversation });
    await flushPromises();

    const trigger = page.querySelector('[data-action="open-tutor-model-picker"]');
    const picker = page.querySelector('[data-role="tutor-model-picker"]');
    expect(trigger).not.toBeNull();
    expect(picker?.hidden).toBe(true);

    trigger.querySelector('.tutor-provider-trigger__label').click();
    expect(picker.hidden).toBe(false);
    const providerToggle = picker.querySelector('[data-action="toggle-tutor-provider-options"]');
    expect(providerToggle.textContent).toContain('Gemini');
    expect(picker.querySelector('[data-role="tutor-provider-choices"]').hidden).toBe(true);
    expect(picker.querySelector('[data-role="tutor-model-choices"]').hidden).toBe(false);
    providerToggle.click();
    expect(picker.querySelector('[data-role="tutor-model-choices"]').hidden).toBe(true);
    expect([...picker.querySelectorAll('.tutor-provider-choice')].map((button) => button.textContent.trim())).toEqual(['Gemini', 'OpenAI']);
    picker.querySelector('.tutor-provider-choice[data-provider-id="openai"]').click();
    expect(picker.querySelector('[data-role="tutor-provider-choices"]').hidden).toBe(true);
    expect(picker.querySelector('[data-role="tutor-model-choices"]').hidden).toBe(false);
    expect(picker.hidden).toBe(false);
    const modelChoices = [...picker.querySelectorAll('.tutor-model-choice')];
    expect(modelChoices.map((button) => button.dataset.modelId)).toEqual(['gpt-5.4-mini']);
    expect(modelChoices[0].querySelector('.tutor-model-choice__check')?.textContent).toBe('✓');
    modelChoices[0].click();
    expect(picker.hidden).toBe(true);
    expect(trigger.textContent).toContain('OpenAI');
    expect(trigger.getAttribute('aria-label')).toContain('gpt-5.4-mini');

    page.querySelector('[data-role="tutor-input"]').value = 'ช่วยอธิบายเรื่องเซต';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();
    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      message: 'ช่วยอธิบายเรื่องเซต',
      provider_id: 'openai',
      model_id: 'gpt-5.4-mini',
    }));
  });

  it('keeps the provider trigger caret decorative and out of the accessible control name', async () => {
    const { page } = mount();
    await flushPromises();

    const trigger = page.querySelector('[data-action="open-tutor-model-picker"]');
    const caret = trigger.querySelector('.tutor-provider-trigger__chevron');

    expect(caret).not.toBeNull();
    expect(caret.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.getAttribute('aria-label')).toContain('Gemini');
  });

  it('keeps the provider picker caret decorative and out of the accessible control name', async () => {
    const { page } = mount();
    await flushPromises();

    page.querySelector('[data-action="open-tutor-model-picker"]').click();
    const toggle = page.querySelector('[data-action="toggle-tutor-provider-options"]');
    const caret = toggle.querySelector('.tutor-provider-selector__chevron');

    expect(caret).not.toBeNull();
    expect(caret.getAttribute('aria-hidden')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toContain('Gemini');
  });

  it('keeps provider choices in a separate readable menu and marks the selected model', async () => {
    const { page } = mount();
    await flushPromises();

    page.querySelector('[data-action="open-tutor-model-picker"]').click();
    const picker = page.querySelector('[data-role="tutor-model-picker"]');
    const providerToggle = picker.querySelector('[data-action="toggle-tutor-provider-options"]');
    const providerChoices = picker.querySelector('[data-role="tutor-provider-choices"]');

    expect(providerToggle.textContent).toContain('Gemini');
    expect(providerToggle.getAttribute('aria-expanded')).toBe('false');
    expect(providerChoices.hidden).toBe(true);
    const selectedGeminiModel = picker.querySelector('.tutor-model-choice[aria-pressed="true"]');
    expect(selectedGeminiModel?.dataset.modelId).toBe('gemini-3.8-flash');
    expect(selectedGeminiModel?.querySelector('.tutor-model-choice__check')?.textContent).toBe('✓');

    providerToggle.click();
    expect(providerChoices.hidden).toBe(false);
    expect(providerToggle.getAttribute('aria-expanded')).toBe('true');
    providerChoices.querySelector('.tutor-provider-choice[data-provider-id="openai"]').click();

    expect(providerChoices.hidden).toBe(true);
    expect(providerToggle.getAttribute('aria-expanded')).toBe('false');
    expect(providerToggle.textContent).toContain('OpenAI');
    expect(picker.querySelector('.tutor-model-choice[aria-pressed="true"]')?.dataset.modelId).toBe('gpt-5.4-mini');
  });

  it('keeps the selected model when the already-selected provider is confirmed again', async () => {
    const catalog = {
      providers: [
        { id: 'gemini', name: 'Gemini', models: [
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', supports_images: false },
          { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', supports_images: false },
        ] },
        { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', supports_images: false }] },
      ],
      default_selection: { provider_id: 'gemini', model_id: 'gemini-3.8-flash' },
    };
    const { page } = mount({ loadProviders: vi.fn().mockResolvedValue(catalog) });
    await flushPromises();
    const model = page.querySelector('[data-role="tutor-model"]');
    model.value = 'gemini-3.5-flash';
    model.dispatchEvent(new Event('change', { bubbles: true }));

    page.querySelector('[data-action="open-tutor-model-picker"]').click();
    page.querySelector('[data-action="toggle-tutor-provider-options"]').click();
    page.querySelector('.tutor-provider-choice[data-provider-id="gemini"]').click();

    expect(page.querySelector('[data-role="tutor-model"]').value).toBe('gemini-3.5-flash');
    expect(page.querySelector('.tutor-model-choice[aria-pressed="true"]')?.dataset.modelId).toBe('gemini-3.5-flash');
  });

  it('shows a provider with no models as empty and disables selection when the catalog has no providers', async () => {
    const { page: noModelPage } = mount({
      loadProviders: vi.fn().mockResolvedValue({ providers: [{ id: 'claude', name: 'Claude', models: [] }] }),
    });
    await flushPromises();
    noModelPage.querySelector('[data-action="open-tutor-model-picker"]').click();
    expect(noModelPage.querySelector('[data-role="tutor-model-empty"]')?.textContent).toContain('ไม่มีโมเดล');
    expect(noModelPage.querySelectorAll('.tutor-model-choice')).toHaveLength(0);

    const { page: noProviderPage } = mount({
      loadProviders: vi.fn().mockResolvedValue({ providers: [], default_selection: null }),
    });
    await flushPromises();
    expect(noProviderPage.querySelector('[data-action="open-tutor-model-picker"]').disabled).toBe(true);
  });

  it('closes the model dialog with Escape and restores focus to its composer trigger', async () => {
    const { page } = mount();
    await flushPromises();
    const trigger = page.querySelector('[data-action="open-tutor-model-picker"]');
    const picker = page.querySelector('[data-role="tutor-model-picker"]');
    trigger.click();

    expect(page.ownerDocument.activeElement).toBe(page.querySelector('[data-action="toggle-tutor-provider-options"]'));
    picker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(picker.hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(page.ownerDocument.activeElement).toBe(trigger);
  });

  it('closes only the topmost Tutor overlay for each Escape press', async () => {
    const { page } = mount();
    await flushPromises();
    const history = page.querySelector('[data-role="tutor-history"]');
    const historyToggle = page.querySelector('[data-action="toggle-tutor-history"]');
    const trigger = page.querySelector('[data-action="open-tutor-model-picker"]');
    const picker = page.querySelector('[data-role="tutor-model-picker"]');

    historyToggle.click();
    trigger.click();
    page.ownerDocument.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(picker.hidden).toBe(true);
    expect(history.hidden).toBe(false);
    expect(page.ownerDocument.activeElement).toBe(trigger);

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(history.hidden).toBe(true);
    expect(page.ownerDocument.activeElement).toBe(historyToggle);
  });

  it('disables model choices that cannot process an attached image and re-enables supported choices', async () => {
    const mixedCatalog = {
      providers: [
        { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-vision', name: 'GPT Vision', supports_images: true }] },
        { id: 'gemini', name: 'Gemini', models: [{ id: 'gemini-text', name: 'Gemini Text', supports_images: false }] },
      ],
      default_selection: { provider_id: 'openai', model_id: 'gpt-vision' },
    };
    const { page } = mount({ loadProviders: vi.fn().mockResolvedValue(mixedCatalog) });
    await flushPromises();
    chooseImages(page, [new File(['image'], 'diagram.png', { type: 'image/png' })]);
    page.querySelector('[data-action="open-tutor-model-picker"]').click();

    page.querySelector('[data-action="toggle-tutor-provider-options"]').click();
    const geminiChoice = page.querySelector('.tutor-provider-choice[data-provider-id="gemini"]');
    geminiChoice.click();
    expect(page.querySelector('.tutor-model-choice[data-model-id="gemini-text"]').disabled).toBe(true);

    page.querySelector('[data-action="toggle-tutor-provider-options"]').click();
    page.querySelector('.tutor-provider-choice[data-provider-id="openai"]').click();
    expect(page.querySelector('.tutor-model-choice[data-model-id="gpt-vision"]').disabled).toBe(false);
  });

  it('uses recognizable rail icons with labels revealed on hover or keyboard focus', async () => {
    const { page } = mount();
    await flushPromises();

    const rail = page.querySelector('[data-role="tutor-left-rail"]');
    const actions = [...rail.querySelectorAll('.tutor-left-rail__button')];
    const labels = ['เริ่มคำถามใหม่', 'เปิดประวัติการถาม', 'หน้าหลัก', 'คลังข้อสอบ', 'คลังเอกสาร'];

    expect(actions.map((action) => action.getAttribute('data-tooltip'))).toEqual(labels);
    expect(actions.map((action) => action.getAttribute('aria-label'))).toEqual(labels);
    expect(actions.every((action) => action.querySelector('svg[aria-hidden="true"]'))).toBe(true);
    expect(actions.every((action) => !action.hasAttribute('title'))).toBe(true);

    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.tutor-left-rail__button\[data-tooltip\]:hover::after/);
    expect(styles).toMatch(/\.tutor-left-rail__button\[data-tooltip\]:focus-visible::after/);
    expect(styles).toMatch(/content:\s*attr\(data-tooltip\)/);
  });

  it('keeps the conversation before history in document order for narrow screens', async () => {
    const { page } = mount();
    await flushPromises();

    const layout = page.querySelector('.tutor-layout');
    expect(layout.querySelector('[data-role="tutor-left-rail"]')).not.toBeNull();
    expect(layout.children[0].classList.contains('tutor-left-rail')).toBe(true);
    expect(layout.querySelector('.tutor-conversation__toolbar')).not.toBeNull();
    expect(layout.querySelector('[data-role="tutor-context-panel"]')).toBeNull();
    expect(layout.children[layout.children.length - 1].classList.contains('tutor-conversation')).toBe(true);
    expect(page.querySelector('.tutor-heading')).toBeNull();
  });

  it('opens history from the left rail and closes the drawer after a conversation is selected', async () => {
    const saved = conversation({ id: 7 });
    const { page } = mount({
      loadConversations: vi.fn().mockResolvedValue([saved]),
      loadConversation: vi.fn().mockResolvedValue(saved),
    });
    await flushPromises();

    const history = page.querySelector('[data-role="tutor-history"]');
    const historyToggle = page.querySelector('[data-action="toggle-tutor-history"]');
    expect(history.hidden).toBe(true);
    expect(historyToggle.getAttribute('aria-expanded')).toBe('false');

    historyToggle.click();
    expect(history.hidden).toBe(false);
    expect(historyToggle.getAttribute('aria-expanded')).toBe('true');
    expect(history.querySelector('[data-role="tutor-search"]')).not.toBeNull();
    expect(history.querySelector('[data-role="tutor-tag-filter"]')).not.toBeNull();

    history.querySelector('[data-conversation-id="7"] [data-action="open-conversation"]').click();
    await flushPromises();
    expect(history.hidden).toBe(true);
    expect(historyToggle.getAttribute('aria-expanded')).toBe('false');
    expect(page.querySelector('[data-role="tutor-conversation-title"]').textContent).toBe(saved.title);
  });

  it('dismisses history drawer without clearing its searchable controls', async () => {
    const { page } = mount();
    await flushPromises();

    const history = page.querySelector('[data-role="tutor-history"]');
    const close = history.querySelector('[data-action="close-tutor-history"]');
    expect(close.getAttribute('aria-label')).toBe('ปิดประวัติการถาม');
    expect(close.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(close.classList.contains('button-danger')).toBe(true);

    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/#app\.app--tutor \.tutor-history__close\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;[^}]*line-height:\s*1/);
    expect(styles).toMatch(/#app\.app--tutor \.tutor-history__close\s*\{[^}]*background:\s*var\(--error-soft\)/);

    page.querySelector('[data-action="toggle-tutor-history"]').click();
    close.click();

    expect(history.hidden).toBe(true);
    expect(history.querySelector('[data-role="tutor-search"]')).not.toBeNull();
    expect(history.querySelector('[data-role="tutor-tag-filter"]')).not.toBeNull();
  });

  it('removes the empty collapsed context rail and gives its column back to the conversation', async () => {
    const { page } = mount();
    await flushPromises();

    expect(page.querySelector('[data-role="tutor-context-panel"]')).toBeNull();
    expect(page.querySelector('[data-action="toggle-tutor-context"]')).toBeNull();

    const app = document.createElement('div');
    app.id = 'app';
    app.className = 'app--tutor';
    const stylesheet = document.createElement('style');
    stylesheet.textContent = readFileSync('src/styles.css', 'utf8');
    app.append(stylesheet, page);
    document.body.replaceChildren(app);

    const layout = page.querySelector('.tutor-layout');
    const collapsedColumns = getComputedStyle(layout).gridTemplateColumns;
    expect(collapsedColumns).toContain('3.8rem');
    expect(collapsedColumns).not.toContain('3.25rem');

    layout.classList.add('tutor-layout--history-open');
    const expandedColumns = getComputedStyle(layout).gridTemplateColumns;
    expect(expandedColumns).toContain('15rem');
    expect(expandedColumns).not.toContain('3.25rem');
  });

  it('opens the subject and tag picker in a dialog instead of the right context panel', async () => {
    const { page } = mount();
    await flushPromises();

    const trigger = page.querySelector('[data-action="open-tutor-tag-picker"]');
    const dialogLayer = page.querySelector('[data-role="tutor-tag-dialog-layer"]');
    const dialog = page.querySelector('[data-role="tutor-tag-dialog"]');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
    expect(dialogLayer.hidden).toBe(true);

    trigger.click();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(dialogLayer.hidden).toBe(false);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.querySelector('.tag-picker')).not.toBeNull();
    expect(dialog.querySelector('.tag-picker-create').hidden).toBe(true);
    expect(page.querySelector('[data-role="tutor-context-panel"]')).toBeNull();
    expect(page.ownerDocument.activeElement).toBe(dialog.querySelector('.tag-picker-search'));

    dialog.querySelector('[data-action="close-tutor-tag-dialog"]').click();
    expect(dialogLayer.hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(page.ownerDocument.activeElement).toBe(trigger);
  });

  it('keeps the tag dialog close mark red in its default and hover states', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/#app\.app--tutor \.tutor-tag-dialog__close\s*\{[^}]*color:\s*var\(--error\)/);
    expect(styles).toMatch(/#app\.app--tutor \.tutor-tag-dialog__close:hover\s*\{[^}]*color:\s*var\(--error\)/);
  });

  it('closes the tag dialog on Escape and restores focus to its trigger', async () => {
    const { page } = mount();
    await flushPromises();
    const trigger = page.querySelector('[data-action="open-tutor-tag-picker"]');
    const dialog = page.querySelector('[data-role="tutor-tag-dialog"]');

    trigger.click();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(page.querySelector('[data-role="tutor-tag-dialog-layer"]').hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(page.ownerDocument.activeElement).toBe(trigger);
  });

  it('keeps the original color-chip tag picker inside the floating dialog', async () => {
    const { page } = mount();
    await flushPromises();
    page.querySelector('[data-action="open-tutor-tag-picker"]').click();

    const dialog = page.querySelector('[data-role="tutor-tag-dialog"]');
    const search = dialog.querySelector('.tag-picker-search');
    const list = dialog.querySelector('.tag-picker-groups');
    const subject = list.querySelector('[data-tag-id="1"]');
    const topic = list.querySelector('[data-tag-id="2"]');

    expect(search.placeholder).toBe('ค้นหาวิชา หรือหัวข้อ');
    expect(list.getAttribute('role')).toBe('group');
    expect(list.getAttribute('aria-label')).toBe('รายการวิชาและหัวข้อ');
    expect(list.classList.contains('tutor-tag-dialog__chips')).toBe(true);
    expect(subject.getAttribute('aria-pressed')).toBe('false');
    expect(topic.getAttribute('aria-pressed')).toBe('false');

    subject.click();
    topic.click();
    expect(subject.getAttribute('aria-pressed')).toBe('true');
    expect(topic.getAttribute('aria-pressed')).toBe('true');
    subject.click();
    expect(subject.getAttribute('aria-pressed')).toBe('false');
    expect(topic.getAttribute('aria-pressed')).toBe('true');

    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/#app\.app--tutor \.tutor-tag-dialog__chips\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/);
    expect(styles).toMatch(/\.tag-picker-tag\[aria-pressed="true"\]\s*\{[^}]*background:\s*var\(--tag-color\)/);
  });

  it('keeps keyboard focus inside the tag dialog while it is open', async () => {
    const { page } = mount();
    await flushPromises();
    const trigger = page.querySelector('[data-action="open-tutor-tag-picker"]');
    const dialog = page.querySelector('[data-role="tutor-tag-dialog"]');
    const closeButton = dialog.querySelector('[data-action="close-tutor-tag-dialog"]');
    const lastControl = [...dialog.querySelectorAll('.tag-picker-tag')].at(-1);

    trigger.click();
    closeButton.focus();
    const backwardTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    closeButton.dispatchEvent(backwardTab);
    expect(page.ownerDocument.activeElement).toBe(lastControl);

    lastControl.focus();
    lastControl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(page.ownerDocument.activeElement).toBe(closeButton);
  });

  it('uses tags selected in the tag dialog when starting a tutor conversation', async () => {
    const createConversation = vi.fn().mockResolvedValue(conversation());
    const { page } = mount({ createConversation });
    await flushPromises();

    page.querySelector('[data-action="open-tutor-tag-picker"]').click();
    page.querySelector('[data-role="tutor-tag-dialog"] [data-tag-id="2"]').click();
    page.querySelector('[data-role="tutor-input"]').value = 'ช่วยอธิบายแรง';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      message: 'ช่วยอธิบายแรง',
      tag_ids: [2],
    }));
  });

  it('positions the model picker as an anchored drop-up instead of a centered modal', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/#app\.app--tutor \.tutor-model-picker\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*calc\(100%/);
  });

  it('defaults to Thai answers and sends the selected English language with a new message', async () => {
    const createConversation = vi.fn().mockResolvedValue(conversation());
    const { page } = mount({ createConversation });
    await flushPromises();

    const language = page.querySelector('[data-role="tutor-response-language"]');
    expect(language?.value).toBe('th');
    expect([...language.options].map((option) => option.value)).toEqual(['th', 'en']);
    language.value = 'en';
    language.dispatchEvent(new Event('change', { bubbles: true }));
    page.querySelector('[data-role="tutor-input"]').value = 'Explain sets';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Explain sets',
      response_language: 'en',
    }));
  });

  it('restores the last response language when reopening a Tutor conversation', async () => {
    const saved = conversation({ messages: [
      { ...message(1, 'user', 'question', 'Explain the empty set'), response_language: 'en' },
      { ...message(2, 'assistant', 'answer', 'The empty set is a subset of every set'), response_language: 'en' },
    ] });
    const sendMessage = vi.fn().mockResolvedValue(saved);
    const { page } = mount({
      loadConversations: vi.fn().mockResolvedValue([saved]),
      loadConversation: vi.fn().mockResolvedValue(saved),
      sendMessage,
    });
    await flushPromises();

    page.querySelector('[data-conversation-id="7"] [data-action="open-conversation"]').click();
    await flushPromises();
    expect(page.querySelector('[data-role="tutor-response-language"]')?.value).toBe('en');

    page.querySelector('[data-role="tutor-input"]').value = 'Give another example';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({
      message: 'Give another example',
      response_language: 'en',
    }));
  });

  it('restores a conversation model and labels only replies with a recorded selection', async () => {
    const saved = conversation({
      provider_id: 'openai',
      model_id: 'gpt-5.4-mini',
      messages: [
        message(1, 'user', 'question', 'อธิบายเซตว่าง'),
        { ...message(2, 'assistant', 'answer', 'คำตอบจากโมเดลที่บันทึกไว้'), provider_id: 'openai', model_id: 'gpt-5.4-mini' },
        message(3, 'assistant', 'answer', 'คำตอบเก่าที่ไม่มีข้อมูลโมเดล'),
      ],
    });
    const { page } = mount({
      loadConversations: vi.fn().mockResolvedValue([saved]),
      loadConversation: vi.fn().mockResolvedValue(saved),
    });
    await flushPromises();

    page.querySelector('[data-conversation-id="7"] [data-action="open-conversation"]').click();
    await flushPromises();

    expect(page.querySelector('[data-role="tutor-provider"]').value).toBe('openai');
    expect(page.querySelector('[data-role="tutor-model"]').value).toBe('gpt-5.4-mini');
    const labels = [...page.querySelectorAll('.tutor-message__model')];
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toContain('OpenAI');
    expect(labels[0].textContent).toContain('gpt-5.4-mini');
  });

  it('keeps an image selected and blocks sending while the model has no confirmed image support', async () => {
    const { page, dependencies } = mount();
    await flushPromises();
    chooseImages(page, [new File(['png'], 'diagram.png', { type: 'image/png' })]);

    expect(page.querySelector('[data-role="tutor-image-previews"]')?.textContent).toContain('diagram.png');
    expect(page.querySelector('[data-role="tutor-image-capability"]')?.textContent).toContain('ยังไม่มีโมเดลที่ยืนยัน');
    expect(page.querySelector('[data-action="send-tutor-message"]').disabled).toBe(true);
    page.querySelector('[data-role="tutor-input"]').value = 'ช่วยอ่านภาพนี้';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(dependencies.createConversationWithImages).not.toHaveBeenCalled();
    expect(page.querySelector('[data-role="tutor-input"]').value).toBe('ช่วยอ่านภาพนี้');
    expect(page.querySelector('[data-role="tutor-image-previews"]')?.textContent).toContain('diagram.png');
  });

  it('sends a valid image and selected model as multipart data', async () => {
    const saved = conversation({
      messages: [
        { ...message(1, 'user', 'question', 'ช่วยอ่านภาพนี้'), attachments: [{ id: 55, filename: 'diagram.png', mime_type: 'image/png', byte_size: 3 }] },
        { ...message(2, 'assistant', 'answer', 'นี่คือแผนภาพ'), provider_id: 'openai', model_id: 'gpt-5.4-mini' },
      ],
    });
    const createConversationWithImages = vi.fn().mockResolvedValue(saved);
    const { page } = mount({
      loadProviders: vi.fn().mockResolvedValue(imageAiCatalog),
      createConversationWithImages,
    });
    await flushPromises();
    const language = page.querySelector('[data-role="tutor-response-language"]');
    language.value = 'en';
    language.dispatchEvent(new Event('change', { bubbles: true }));
    chooseImages(page, [new File(['png'], 'diagram.png', { type: 'image/png' })]);
    page.querySelector('[data-role="tutor-input"]').value = 'ช่วยอ่านภาพนี้';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(createConversationWithImages).toHaveBeenCalledOnce();
    const formData = createConversationWithImages.mock.calls[0][0];
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('response_language')).toBe('en');
    expect(formData.get('provider_id')).toBe('openai');
    expect(formData.get('model_id')).toBe('gpt-5.4-mini');
    expect(formData.get('message')).toBe('ช่วยอ่านภาพนี้');
    expect(formData.get('images').name).toBe('diagram.png');
    expect(page.querySelector('[data-role="tutor-image-previews"]')?.children).toHaveLength(0);
  });

  it.each([
    ['more than three images', [1, 2, 3, 4].map((index) => new File(['x'], `image-${index}.png`, { type: 'image/png' }))],
    ['an unsupported image type', [new File(['x'], 'photo.gif', { type: 'image/gif' })]],
    ['a file larger than five MiB', [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })]],
  ])('rejects %s without dropping previously selected images', async (_label, files) => {
    const { page } = mount({ loadProviders: vi.fn().mockResolvedValue(imageAiCatalog) });
    await flushPromises();
    chooseImages(page, [new File(['x'], 'kept.png', { type: 'image/png' })]);
    chooseImages(page, files);

    expect(page.querySelector('[data-role="tutor-image-previews"]')?.textContent).toContain('kept.png');
    expect(page.querySelector('[data-role="tutor-page-message"]')?.textContent).toContain('ไม่รับไฟล์ภาพ');
  });

  it('reuses a saved image by attachment ID from the conversation history', async () => {
    const saved = conversation({ messages: [{
      ...message(1, 'user', 'question', 'ภาพต้นฉบับ'),
      attachments: [{ id: 77, filename: 'diagram.png', mime_type: 'image/png', byte_size: 3 }],
    }] });
    const sendMessage = vi.fn().mockResolvedValue(conversation({
      messages: [...saved.messages, message(2, 'user', 'clarification_reply', 'ช่วยขยายความ', 2)],
    }));
    const { page } = mount({
      loadConversations: vi.fn().mockResolvedValue([saved]),
      loadConversation: vi.fn().mockResolvedValue(saved),
      loadProviders: vi.fn().mockResolvedValue(imageAiCatalog),
      sendMessage,
    });
    await flushPromises();
    page.querySelector('[data-conversation-id="7"] [data-action="open-conversation"]').click();
    await flushPromises();

    const image = page.querySelector('.tutor-message__image');
    expect(image?.alt).toBe('diagram.png');
    expect(image?.getAttribute('src')).toBe('/api/tutor/conversations/7/attachments/77');
    page.querySelector('[data-action="reuse-tutor-attachment"]').click();
    page.querySelector('[data-role="tutor-input"]').value = 'ช่วยขยายความ';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({
      message: 'ช่วยขยายความ', provider_id: 'openai', model_id: 'gpt-5.4-mini', attachment_ids: [77],
    }));
  });

  it('retains the question and image for retry after provider failure', async () => {
    const failure = new Error('Provider quota reached');
    failure.detail = { conversation_id: 41, retryable: true, code: 'tutor_provider_quota' };
    const saved = conversation({
      id: 41,
      status: 'retryable_error',
      messages: [{ ...message(1, 'user', 'question', 'อ่านแผนภาพนี้'), attachments: [
        { id: 88, filename: 'diagram.png', mime_type: 'image/png', byte_size: 3 },
      ] }],
    });
    const createConversationWithImages = vi.fn().mockRejectedValue(failure);
    const retryMessage = vi.fn().mockResolvedValue(conversation({ id: 41 }));
    const { page } = mount({
      loadProviders: vi.fn().mockResolvedValue(imageAiCatalog),
      createConversationWithImages,
      loadConversation: vi.fn().mockResolvedValue(saved),
      retryMessage,
    });
    await flushPromises();
    chooseImages(page, [new File(['x'], 'diagram.png', { type: 'image/png' })]);
    page.querySelector('[data-role="tutor-input"]').value = 'อ่านแผนภาพนี้';
    submit(page.querySelector('[data-role="tutor-message-form"]'));
    await flushPromises();

    expect(page.querySelector('[data-role="tutor-messages"]')?.textContent).toContain('อ่านแผนภาพนี้');
    expect(page.querySelector('[data-role="tutor-image-previews"]')?.textContent).toContain('diagram.png');
    page.querySelector('[data-action="retry-tutor"]').click();
    await flushPromises();

    expect(retryMessage).toHaveBeenCalledWith(41, {
      provider_id: 'openai', model_id: 'gpt-5.4-mini', response_language: 'th',
    });
  });

  it.each([['at the bottom', true], ['reading older messages', false]])(
    'scrolls new messages only when the reader is %s', async (_label, atBottom) => {
      const saved = conversation({ messages: [
        message(1, 'user', 'question', 'คำถามก่อนหน้า'),
        message(2, 'assistant', 'answer', 'คำตอบก่อนหน้า'),
      ] });
      const completed = conversation({ messages: [
        ...saved.messages,
        message(3, 'user', 'clarification_reply', 'ถามต่อ', 3),
        message(4, 'assistant', 'answer', 'คำตอบใหม่', 4),
      ] });
      const { page } = mount({
        loadConversations: vi.fn().mockResolvedValue([saved]),
        loadConversation: vi.fn().mockResolvedValue(saved),
        sendMessage: vi.fn().mockResolvedValue(completed),
      });
      await flushPromises();
      page.querySelector('[data-conversation-id="7"] [data-action="open-conversation"]').click();
      await flushPromises();
      const list = page.querySelector('[data-role="tutor-messages"]');
      let top = atBottom ? 100 : 0;
      Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 });
      Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => list.children.length * 100 });
      Object.defineProperty(list, 'scrollTop', { configurable: true, get: () => top, set: (value) => { top = value; } });
      page.querySelector('[data-role="tutor-input"]').value = 'ถามต่อ';
      submit(page.querySelector('[data-role="tutor-message-form"]'));
      await flushPromises();

      expect(list.scrollTop).toBe(atBottom ? list.scrollHeight - list.clientHeight : 0);
    },
  );
});
