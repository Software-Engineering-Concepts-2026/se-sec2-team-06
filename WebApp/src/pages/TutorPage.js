import {
  createTutorConversation as createTutorConversationRequest,
  createTutorConversationWithImages as createTutorConversationWithImagesRequest,
  getAiProviders as getAiProvidersRequest,
  getTutorAttachmentUrl as getTutorAttachmentUrlRequest,
  getTutorConversation as getTutorConversationRequest,
  listTags as listTagsRequest,
  listTutorConversations as listTutorConversationsRequest,
  retryTutorMessage as retryTutorMessageRequest,
  sendTutorMessage as sendTutorMessageRequest,
  sendTutorMessageWithImages as sendTutorMessageWithImagesRequest,
} from '../api/client.js';
import { renderTagChips, renderTagFilter, renderTagPicker } from '../tags/tag-components.js';

const STATUS_LABELS = {
  processing: 'กำลังประมวลผล',
  awaiting_clarification: 'รอคำตอบเพิ่มเติม',
  retryable_error: 'ส่งไม่สำเร็จ · ลองใหม่ได้',
  answered: 'ตอบแล้ว',
};

function element(tagName, className = '', text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function resizeTutorTextarea(input) {
  const styles = window.getComputedStyle(input);
  const fontSize = Number.parseFloat(styles.fontSize) || 16;
  const lineHeight = Number.parseFloat(styles.lineHeight) || fontSize * 1.6;
  const verticalPadding = (Number.parseFloat(styles.paddingTop) || 0)
    + (Number.parseFloat(styles.paddingBottom) || 0);
  const minHeight = lineHeight * 2 + verticalPadding;
  const maxHeight = lineHeight * Number(input.dataset.maxRows || 10) + verticalPadding;

  input.style.height = 'auto';
  const contentHeight = Math.max(input.scrollHeight, minHeight);
  input.style.height = `${Math.min(contentHeight, maxHeight)}px`;
  input.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'ไม่ระบุเวลา'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusLabel(status) {
  return STATUS_LABELS[status] || 'ยังไม่มีสถานะ';
}

function requestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `tutor-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function routeLink(label, path, navigate) {
  const link = element('a', 'button button-secondary', label);
  link.href = path;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate?.(path);
  });
  return link;
}

const TUTOR_RAIL_ICON_PATHS = {
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  compose: '<path d="M12 20H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/><path d="m16 3 5 5"/><path d="m11 13 7.5-7.5a2.12 2.12 0 0 1 3 3L14 16l-4 1z"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  home: '<path d="m3 10 9-7 9 7"/><path d="M5.5 9v11h13V9"/><path d="M9.5 20v-6h5v6"/>',
  quiz: '<path d="M8 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-2"/><rect x="8" y="2.5" width="8" height="4" rx="1"/><path d="M8 11h8M8 15h8M8 18h5"/>',
  documents: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
};

function tutorRailIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = TUTOR_RAIL_ICON_PATHS[name];
  return svg;
}

function setTutorRailButton(button, iconName, label) {
  button.replaceChildren(tutorRailIcon(iconName));
  button.setAttribute('aria-label', label);
  button.dataset.tooltip = label;
  button.removeAttribute('title');
}

function renderConversationCard(item, onOpen) {
  const card = element('article', 'tutor-history-card');
  card.dataset.conversationId = String(item.id);
  const open = element('button', 'tutor-history-card__open');
  open.type = 'button';
  open.dataset.action = 'open-conversation';
  open.append(
    element('strong', 'tutor-history-card__title', item.title || 'คำถามใหม่'),
    element('span', 'tutor-history-card__status', statusLabel(item.status)),
    element('span', 'tutor-history-card__date', formatDate(item.updated_at || item.created_at)),
  );
  open.addEventListener('click', () => onOpen(item.id));
  const tags = renderTagChips(item.tags || []);
  tags.classList.add('tutor-history-card__tags');
  card.append(open, tags);
  return card;
}

function renderTutorMessage(item, catalog, conversationId, onReuseAttachment, getAttachmentUrl) {
  const row = element('article', `tutor-message tutor-message--${item.role === 'user' ? 'learner' : 'assistant'}`);
  row.dataset.messageId = String(item.id ?? `pending-${item.sequence ?? ''}`);
  row.dataset.role = 'tutor-message-row';
  row.append(element('span', 'tutor-message__author', item.role === 'user' ? 'คุณ' : 'AI ติวเตอร์'));
  if (item.role === 'assistant' && item.provider_id && item.model_id) {
    const provider = catalog.providers.find((candidate) => candidate.id === item.provider_id);
    row.append(element('span', 'tutor-message__model', `${provider?.name || item.provider_id} · ${item.model_id}`));
  }
  if (Array.isArray(item.attachments) && item.attachments.length > 0) {
    const attachments = element('div', 'tutor-message__attachments');
    for (const attachment of item.attachments) {
      const card = element('figure', 'tutor-message__attachment');
      const image = element('img', 'tutor-message__image');
      image.src = getAttachmentUrl(conversationId, attachment.id);
      image.alt = attachment.filename || 'ภาพที่แนบ';
      image.loading = 'lazy';
      card.append(image, element('figcaption', 'tutor-message__filename', attachment.filename || 'ภาพที่แนบ'));
      if (item.role === 'user' && conversationId) {
        const reuse = element('button', 'button button-secondary tutor-message__reuse', 'ใช้ภาพนี้อีกครั้ง');
        reuse.type = 'button';
        reuse.dataset.action = 'reuse-tutor-attachment';
        reuse.dataset.attachmentId = String(attachment.id);
        reuse.addEventListener('click', () => onReuseAttachment(attachment));
        card.append(reuse);
      }
      attachments.append(card);
    }
    row.append(attachments);
  }
  row.append(element('p', 'tutor-message__content', item.content || ''));
  return row;
}

function emptyState(title, description) {
  const state = element('section', 'tutor-empty-state');
  state.append(element('h3', '', title), element('p', '', description));
  return state;
}

export function renderTutorPage({
  loadConversations = listTutorConversationsRequest,
  loadConversation = getTutorConversationRequest,
  createConversation = createTutorConversationRequest,
  createConversationWithImages = createTutorConversationWithImagesRequest,
  sendMessage = sendTutorMessageRequest,
  sendMessageWithImages = sendTutorMessageWithImagesRequest,
  retryMessage = retryTutorMessageRequest,
  loadProviders = getAiProvidersRequest,
  loadTags = listTagsRequest,
  getAttachmentUrl = getTutorAttachmentUrlRequest,
  navigate,
} = {}) {
  const page = element('section', 'page tutor-page');
  page.setAttribute('aria-labelledby', 'tutor-title');
  const title = element('h1', 'tutor-sr-only', 'AI ติวเตอร์');
  title.id = 'tutor-title';
  const layout = element('div', 'tutor-layout');
  const leftRail = element('nav', 'tutor-left-rail');
  leftRail.dataset.role = 'tutor-left-rail';
  leftRail.setAttribute('aria-label', 'เมนู AI ติวเตอร์');
  const railBrand = element('span', 'tutor-left-rail__brand', 'S');
  railBrand.setAttribute('aria-label', 'SynapseSync');
  const newConversationButton = element('button', 'button button-secondary');
  newConversationButton.classList.add('tutor-left-rail__button');
  newConversationButton.type = 'button';
  newConversationButton.dataset.action = 'new-conversation';
  setTutorRailButton(newConversationButton, 'compose', 'เริ่มคำถามใหม่');
  const historyToggle = element('button', 'button button-secondary tutor-left-rail__button');
  historyToggle.type = 'button';
  historyToggle.dataset.action = 'toggle-tutor-history';
  historyToggle.setAttribute('aria-expanded', 'false');
  historyToggle.setAttribute('aria-controls', 'tutor-history-panel');
  setTutorRailButton(historyToggle, 'history', 'เปิดประวัติการถาม');
  const homeLink = routeLink('', '/', navigate);
  homeLink.className = 'tutor-left-rail__button tutor-left-rail__link';
  setTutorRailButton(homeLink, 'home', 'หน้าหลัก');
  const quizLink = routeLink('', '/quizzes', navigate);
  quizLink.className = 'tutor-left-rail__button tutor-left-rail__link';
  setTutorRailButton(quizLink, 'quiz', 'คลังข้อสอบ');
  const documentsLink = routeLink('', '/documents', navigate);
  documentsLink.className = 'tutor-left-rail__button tutor-left-rail__link';
  setTutorRailButton(documentsLink, 'documents', 'คลังเอกสาร');
  leftRail.append(railBrand, newConversationButton, historyToggle, homeLink, quizLink, documentsLink);

  const pageMessage = element('p', 'tutor-page-message');
  pageMessage.dataset.role = 'tutor-page-message';
  pageMessage.setAttribute('role', 'status');
  pageMessage.setAttribute('aria-live', 'polite');

  const historyPanel = element('aside', 'tutor-panel tutor-history');
  historyPanel.hidden = true;
  historyPanel.id = 'tutor-history-panel';
  historyPanel.dataset.role = 'tutor-history';
  historyPanel.setAttribute('aria-labelledby', 'tutor-history-title');
  const historyHeading = element('div', 'tutor-history__heading');
  const historyTitle = element('h2', '', 'ประวัติการถาม');
  historyTitle.id = 'tutor-history-title';
  const historyClose = element('button', 'button button-danger tutor-history__close');
  historyClose.type = 'button';
  historyClose.dataset.action = 'close-tutor-history';
  historyClose.setAttribute('aria-label', 'ปิดประวัติการถาม');
  historyClose.append(tutorRailIcon('close'));
  historyHeading.append(historyTitle, historyClose);
  const searchForm = element('form', 'tutor-history-search');
  searchForm.dataset.role = 'tutor-search-form';
  const searchInput = element('input', 'tutor-history-search__input');
  searchInput.type = 'search';
  searchInput.placeholder = 'ค้นหาคำถามหรือคำตอบ';
  searchInput.setAttribute('aria-label', 'ค้นหาประวัติคำถาม');
  searchInput.dataset.role = 'tutor-search';
  const searchControls = element('div', 'tutor-history-search__controls');
  let tagCatalog = { tags: [] };
  let selectedFilterTagId = null;
  let activeQuery = '';
  let activeTagId = null;
  let tagFilter = renderTagFilter(tagCatalog, selectedFilterTagId, (id) => {
    selectedFilterTagId = id;
  });
  tagFilter.dataset.role = 'tutor-tag-filter';
  tagFilter.setAttribute('aria-label', 'กรองประวัติตามวิชาหรือแท็ก');
  const searchButton = element('button', 'button button-primary', 'ค้นหา');
  searchButton.type = 'submit';
  searchControls.append(tagFilter, searchButton);
  searchForm.append(searchInput, searchControls);
  const historyMessage = element('p', 'tutor-history__message');
  historyMessage.dataset.role = 'tutor-history-message';
  historyMessage.setAttribute('role', 'status');
  const historyList = element('div', 'tutor-history-list');
  historyList.dataset.role = 'tutor-history-list';
  historyPanel.append(historyHeading, searchForm, historyMessage, historyList);

  const conversationPanel = element('section', 'tutor-panel tutor-conversation');
  conversationPanel.setAttribute('aria-label', 'บทสนทนากับ AI ติวเตอร์');
  const conversationHeader = element('header', 'tutor-conversation__header');
  const conversationTitle = element('h2', '', 'เริ่มต้นด้วยคำถามของคุณ');
  conversationTitle.dataset.role = 'tutor-conversation-title';
  conversationTitle.tabIndex = -1;
  const conversationToolbar = element('div', 'tutor-conversation__toolbar');
  const conversationTags = element('div', 'tutor-conversation__tags');
  const status = element('p', 'tutor-status');
  status.dataset.role = 'tutor-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  conversationToolbar.append(conversationTitle, conversationTags);
  conversationHeader.append(conversationToolbar, status);
  const messages = element('div', 'tutor-messages');
  messages.dataset.role = 'tutor-messages';
  messages.setAttribute('aria-live', 'polite');

  const form = element('form', 'tutor-message-form');
  form.dataset.role = 'tutor-message-form';
  form.noValidate = true;
  const inputLabel = element('label', 'tutor-message-form__label tutor-message-form__label--sr-only', 'คำถามหรือคำตอบเพิ่มเติม');
  const modelPicker = element('section', 'tutor-model-picker');
  modelPicker.dataset.role = 'tutor-model-picker';
  modelPicker.id = 'tutor-model-picker';
  modelPicker.hidden = true;
  modelPicker.setAttribute('role', 'dialog');
  modelPicker.setAttribute('aria-modal', 'false');
  modelPicker.setAttribute('aria-labelledby', 'tutor-model-picker-title');
  const modelPickerHeader = element('div', 'tutor-model-picker__header');
  const modelPickerTitle = element('h3', '', 'เลือกโมเดล AI');
  modelPickerTitle.id = 'tutor-model-picker-title';
  const modelPickerClose = element('button', 'tutor-model-picker__close', '×');
  modelPickerClose.type = 'button';
  modelPickerClose.dataset.action = 'close-tutor-model-picker';
  modelPickerClose.setAttribute('aria-label', 'ปิดตัวเลือก Provider และ Model');
  modelPickerHeader.append(modelPickerTitle, modelPickerClose);
  const providerChoices = element('div', 'tutor-provider-choices');
  providerChoices.dataset.role = 'tutor-provider-choices';
  providerChoices.id = 'tutor-provider-choices';
  providerChoices.hidden = true;
  providerChoices.setAttribute('role', 'group');
  providerChoices.setAttribute('aria-label', 'เลือกผู้ให้บริการ AI');
  const providerSelector = element('div', 'tutor-provider-selector');
  const providerSelectorLabel = element('span', 'tutor-provider-selector__label', 'Provider');
  const providerToggle = element('button', 'tutor-provider-selector__toggle');
  providerToggle.type = 'button';
  providerToggle.dataset.action = 'toggle-tutor-provider-options';
  providerToggle.setAttribute('aria-expanded', 'false');
  providerToggle.setAttribute('aria-controls', providerChoices.id);
  const providerToggleLabel = element('span', 'tutor-provider-selector__name', 'เลือก Provider');
  const providerToggleChevron = element('span', 'tutor-provider-selector__chevron');
  providerToggleChevron.setAttribute('aria-hidden', 'true');
  providerToggle.append(providerToggleLabel, providerToggleChevron);
  providerSelector.append(providerSelectorLabel, providerToggle, providerChoices);
  const modelChoiceHeading = element('p', 'tutor-model-choices__label', 'เลือกรุ่นโมเดล');
  const modelChoiceList = element('div', 'tutor-model-choices');
  modelChoiceList.dataset.role = 'tutor-model-choices';
  modelChoiceList.setAttribute('role', 'group');
  modelChoiceList.setAttribute('aria-label', 'เลือกรุ่นโมเดล');
  const modelEmpty = element('p', 'tutor-model-empty', 'ไม่มีโมเดลสำหรับ Provider นี้');
  modelEmpty.dataset.role = 'tutor-model-empty';
  const modelControls = element('div', 'tutor-model-controls');
  const providerField = element('label', 'tutor-model-field', 'Provider');
  providerField.hidden = true;
  const providerSelect = element('select', 'tutor-model-select themed-select');
  providerSelect.dataset.role = 'tutor-provider';
  providerSelect.setAttribute('aria-label', 'เลือก Provider สำหรับข้อความถัดไป');
  providerField.append(providerSelect);
  const modelField = element('label', 'tutor-model-field', 'Model');
  modelField.hidden = true;
  const modelSelect = element('select', 'tutor-model-select themed-select');
  modelSelect.dataset.role = 'tutor-model';
  modelSelect.setAttribute('aria-label', 'เลือก Model สำหรับข้อความถัดไป');
  modelField.append(modelSelect);
  const responseLanguageField = element('label', 'tutor-model-field', 'ภาษาคำตอบ');
  const responseLanguageSelect = element('select', 'tutor-model-select themed-select');
  responseLanguageSelect.dataset.role = 'tutor-response-language';
  responseLanguageSelect.setAttribute('aria-label', 'เลือกภาษาคำตอบ');
  for (const [value, label] of [['th', 'ไทย'], ['en', 'English']]) {
    const option = element('option', '', label);
    option.value = value;
    responseLanguageSelect.append(option);
  }
  responseLanguageField.append(responseLanguageSelect);
  modelControls.append(providerField, modelField);
  modelPicker.append(modelPickerHeader, providerSelector, modelControls, modelChoiceHeading, modelChoiceList, modelEmpty);
  const composer = element('div', 'tutor-composer');
  const input = element('textarea', 'tutor-message-form__input');
  input.id = 'tutor-message-input';
  input.rows = 2;
  input.dataset.maxRows = '10';
  input.maxLength = 4000;
  input.placeholder = 'พิมพ์สิ่งที่สงสัย หรือให้บริบทเพิ่มเติม…';
  input.setAttribute('aria-label', 'พิมพ์คำถามหรือคำตอบเพิ่มเติม');
  input.addEventListener('input', () => resizeTutorTextarea(input));
  resizeTutorTextarea(input);
  input.dataset.role = 'tutor-input';
  inputLabel.htmlFor = input.id;
  const selectedTagIds = new Set();
  let tagPicker;
  const tagDialogLayer = element('div', 'tutor-tag-dialog-layer');
  tagDialogLayer.hidden = true;
  tagDialogLayer.dataset.role = 'tutor-tag-dialog-layer';
  const tagDialog = element('section', 'tutor-tag-dialog');
  tagDialog.id = 'tutor-tag-dialog';
  tagDialog.dataset.role = 'tutor-tag-dialog';
  tagDialog.setAttribute('role', 'dialog');
  tagDialog.setAttribute('aria-modal', 'true');
  tagDialog.setAttribute('aria-labelledby', 'tutor-tag-dialog-title');
  const tagDialogHeader = element('div', 'tutor-tag-dialog__header');
  const tagDialogTitle = element('h2', '', 'เลือกวิชาและหัวข้อ');
  tagDialogTitle.id = 'tutor-tag-dialog-title';
  const tagDialogClose = element('button', 'button button-secondary tutor-tag-dialog__close', '×');
  tagDialogClose.type = 'button';
  tagDialogClose.dataset.action = 'close-tutor-tag-dialog';
  tagDialogClose.setAttribute('aria-label', 'ปิดหน้าต่างเลือกวิชาและหัวข้อ');
  tagDialogHeader.append(tagDialogTitle, tagDialogClose);
  const tagDialogHint = element('p', 'tutor-tag-dialog__hint', 'เลือกแท็กที่ต้องการใช้กับคำถามใหม่');
  tagDialogHint.hidden = true;
  const tagPickerContainer = element('div', 'tutor-tag-dialog__content');
  tagPicker = renderTagPicker({
    catalog: tagCatalog,
    onToggle: (id, selected) => {
      if (selected) selectedTagIds.add(id);
      else selectedTagIds.delete(id);
    },
  });
  const tagPickerSearch = tagPicker.querySelector('.tag-picker-search');
  if (tagPickerSearch) {
    tagPickerSearch.setAttribute('aria-label', 'ค้นหาวิชาและหัวข้อ');
    tagPickerSearch.placeholder = 'ค้นหาวิชา หรือหัวข้อ';
  }
  const tagPickerList = tagPicker.querySelector('.tag-picker-groups');
  if (tagPickerList) {
    tagPickerList.classList.add('tutor-tag-dialog__chips');
    tagPickerList.setAttribute('role', 'group');
    tagPickerList.setAttribute('aria-label', 'รายการวิชาและหัวข้อ');
  }
  const tagCreateButton = tagPicker.querySelector('.tag-picker-create');
  if (tagCreateButton) tagCreateButton.hidden = true;
  tagPickerContainer.append(tagPicker);
  tagDialog.append(tagDialogHeader, tagDialogHint, tagPickerContainer);
  tagDialogLayer.append(tagDialog);
  const attachmentControls = element('div', 'tutor-attachment-controls');
  const attachmentInput = element('input', 'tutor-attachment-input');
  attachmentInput.type = 'file';
  attachmentInput.accept = 'image/jpeg,image/png,image/webp';
  attachmentInput.multiple = true;
  attachmentInput.hidden = true;
  attachmentInput.dataset.role = 'tutor-image-input';
  attachmentInput.setAttribute('aria-label', 'เลือกภาพประกอบคำถาม');
  const attachmentButton = element('button', 'button button-secondary tutor-attach-button', '+');
  attachmentButton.type = 'button';
  attachmentButton.dataset.action = 'choose-tutor-images';
  attachmentButton.setAttribute('aria-label', 'แนบภาพ');
  attachmentControls.append(attachmentButton, attachmentInput);
  const attachmentPreviews = element('div', 'tutor-image-previews');
  attachmentPreviews.dataset.role = 'tutor-image-previews';
  const imageCapability = element('p', 'tutor-image-capability');
  imageCapability.dataset.role = 'tutor-image-capability';
  imageCapability.setAttribute('role', 'status');
  imageCapability.setAttribute('aria-live', 'polite');
  const composerControls = element('div', 'tutor-composer__controls');
  const composerLeft = element('div', 'tutor-composer__left');
  const contextTrigger = element('button', 'tutor-composer__context-trigger', '＋ วิชา / หัวข้อ');
  contextTrigger.type = 'button';
  contextTrigger.dataset.action = 'open-tutor-tag-picker';
  contextTrigger.setAttribute('aria-label', 'เลือกวิชาและหัวข้อสำหรับคำถามใหม่');
  contextTrigger.setAttribute('aria-haspopup', 'dialog');
  contextTrigger.setAttribute('aria-expanded', 'false');
  contextTrigger.setAttribute('aria-controls', tagDialog.id);
  const responseLanguageLabel = element('label', 'tutor-response-language');
  responseLanguageLabel.append(element('span', 'tutor-sr-only', 'ภาษาคำตอบ'), responseLanguageSelect);
  composerLeft.append(attachmentControls, contextTrigger, responseLanguageLabel);
  const providerTrigger = element('button', 'tutor-provider-trigger');
  providerTrigger.type = 'button';
  providerTrigger.dataset.action = 'open-tutor-model-picker';
  providerTrigger.setAttribute('aria-haspopup', 'dialog');
  providerTrigger.setAttribute('aria-expanded', 'false');
  providerTrigger.setAttribute('aria-controls', modelPicker.id);
  const providerTriggerLabel = element('span', 'tutor-provider-trigger__label', 'เลือก Provider');
  const providerTriggerChevron = element('span', 'tutor-provider-trigger__chevron');
  providerTriggerChevron.setAttribute('aria-hidden', 'true');
  providerTrigger.append(providerTriggerLabel, providerTriggerChevron);
  const formActions = element('div', 'tutor-message-form__actions');
  const submitButton = element('button', 'button button-primary tutor-send-button');
  submitButton.type = 'submit';
  submitButton.dataset.action = 'send-tutor-message';
  submitButton.setAttribute('aria-label', 'ส่งคำถาม');
  submitButton.append(tutorRailIcon('send'));
  const retryButton = element('button', 'button button-secondary', 'ลองส่งใหม่');
  retryButton.type = 'button';
  retryButton.dataset.action = 'retry-tutor';
  retryButton.hidden = true;
  formActions.append(submitButton, retryButton);
  composerControls.append(composerLeft, providerTrigger, formActions);
  composer.append(modelPicker, inputLabel, input, attachmentPreviews, imageCapability, composerControls);

  function openTagDialog() {
    if (!modelPicker.hidden) closeModelPicker();
    tagDialogLayer.hidden = false;
    contextTrigger.setAttribute('aria-expanded', 'true');
    const firstControl = tagPickerContainer.hidden
      ? tagDialogClose
      : tagPicker.querySelector('.tag-picker-search');
    firstControl?.focus();
  }

  function closeTagDialog({ returnFocus = false } = {}) {
    if (tagDialogLayer.hidden) return;
    tagDialogLayer.hidden = true;
    contextTrigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) contextTrigger.focus();
  }

  function closeHistoryPanel({ focusConversation = false, returnFocus = false } = {}) {
    historyPanel.hidden = true;
    historyToggle.setAttribute('aria-expanded', 'false');
    historyToggle.setAttribute('aria-label', 'เปิดประวัติการถาม');
    historyToggle.dataset.tooltip = 'เปิดประวัติการถาม';
    layout.classList.remove('tutor-layout--history-open');
    if (focusConversation) conversationTitle.focus();
    else if (returnFocus) historyToggle.focus();
  }

  function openHistoryPanel() {
    historyPanel.hidden = false;
    historyToggle.setAttribute('aria-expanded', 'true');
    historyToggle.setAttribute('aria-label', 'ปิดประวัติการถาม');
    historyToggle.dataset.tooltip = 'ปิดประวัติการถาม';
    layout.classList.add('tutor-layout--history-open');
    searchInput.focus();
  }

  function setProviderChoiceMenuOpen(open) {
    providerChoices.hidden = !open;
    providerToggle.setAttribute('aria-expanded', String(open));
    modelChoiceHeading.hidden = open;
    modelChoiceList.hidden = open;
    modelEmpty.hidden = open || modelChoiceList.childElementCount > 0;
  }

  function closeModelPicker({ returnFocus = false } = {}) {
    modelPicker.hidden = true;
    providerTrigger.setAttribute('aria-expanded', 'false');
    setProviderChoiceMenuOpen(false);
    if (returnFocus) providerTrigger.focus();
  }

  function openModelPicker() {
    if (providerTrigger.disabled) return;
    modelPicker.hidden = false;
    providerTrigger.setAttribute('aria-expanded', 'true');
    providerToggle.focus();
    modelChoiceList.querySelector('.tutor-model-choice[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }

  function toggleProviderChoices() {
    if (providerToggle.disabled) return;
    const open = providerChoices.hidden;
    setProviderChoiceMenuOpen(open);
    if (open) {
      (providerChoices.querySelector('.tutor-provider-choice[aria-pressed="true"]')
        || providerChoices.querySelector('.tutor-provider-choice'))?.focus();
    }
  }

  form.append(composer);
  conversationPanel.append(conversationHeader, messages, form);
  layout.append(leftRail, historyPanel, conversationPanel);
  page.append(title, pageMessage, layout, tagDialogLayer);

  let conversations = [];
  let activeConversation = null;
  let activeConversationId = null;
  let isLoadingHistory = false;
  let historyError = '';
  let isBusy = false;
  let pendingSubmission = null;
  let aiCatalog = { providers: [], default_selection: null };
  let selectedProviderId = '';
  let selectedModelId = '';
  let selectedResponseLanguage = 'th';
  const selectedImages = [];
  const selectedAttachmentRefs = new Map();

  function providerById(id) {
    return aiCatalog.providers.find((provider) => provider.id === id);
  }

  function renderModelControls() {
    const defaultSelection = aiCatalog.default_selection;
    const fallbackProvider = providerById(defaultSelection?.provider_id) || aiCatalog.providers[0];
    const currentProvider = providerById(selectedProviderId) || fallbackProvider;
    selectedProviderId = currentProvider?.id || '';
    providerSelect.replaceChildren();
    for (const provider of aiCatalog.providers) {
      const option = element('option', '', provider.name);
      option.value = provider.id;
      providerSelect.append(option);
    }
    providerSelect.disabled = isBusy || aiCatalog.providers.length === 0;
    providerSelect.value = selectedProviderId;
    providerChoices.replaceChildren();
    providerToggleLabel.textContent = currentProvider?.name || 'เลือก Provider';
    providerToggle.disabled = isBusy || aiCatalog.providers.length === 0;
    providerToggle.setAttribute('aria-label', `Provider ปัจจุบัน: ${currentProvider?.name || 'ยังไม่มี'} · เปลี่ยน Provider`);
    for (const provider of aiCatalog.providers) {
      const choice = element('button', 'tutor-provider-choice', provider.name);
      choice.type = 'button';
      choice.dataset.providerId = provider.id;
      choice.setAttribute('aria-pressed', String(provider.id === selectedProviderId));
      choice.disabled = isBusy;
      choice.addEventListener('click', () => {
        setProviderChoiceMenuOpen(false);
        if (provider.id !== selectedProviderId) {
          providerSelect.value = provider.id;
          providerSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        providerToggle.focus();
      });
      providerChoices.append(choice);
    }
    providerTrigger.disabled = isBusy || aiCatalog.providers.length === 0;
    providerTriggerLabel.textContent = currentProvider?.name || 'เลือก Provider';
    const currentModelName = currentProvider?.models.find((model) => model.id === selectedModelId)?.name;
    providerTrigger.setAttribute('aria-label', currentModelName
      ? `${currentProvider.name} · ${currentModelName} · เปลี่ยน Provider หรือ Model`
      : `${currentProvider?.name || 'เลือก Provider'} · เลือก Model`);

    const models = currentProvider?.models || [];
    const defaultModel = defaultSelection && defaultSelection.provider_id === currentProvider?.id
      ? defaultSelection.model_id
      : '';
    const selectedModel = models.some((model) => model.id === selectedModelId)
      ? selectedModelId
      : (models.some((model) => model.id === defaultModel) ? defaultModel : models[0]?.id || '');
    selectedModelId = selectedModel;
    modelSelect.replaceChildren();
    for (const model of models) {
      const option = element('option', '', model.name);
      option.value = model.id;
      option.dataset.supportsImages = String(Boolean(model.supports_images));
      option.disabled = hasSelectedAttachments() && !model.supports_images;
      modelSelect.append(option);
    }
    if (models.length === 0) {
      const option = element('option', '', 'ไม่มีโมเดลให้เลือก');
      option.value = '';
      modelSelect.append(option);
    }
    modelSelect.disabled = isBusy || models.length === 0;
    modelSelect.value = selectedModelId;
    modelChoiceList.replaceChildren();
    for (const model of models) {
      const choice = element('button', 'tutor-model-choice');
      choice.type = 'button';
      choice.dataset.modelId = model.id;
      choice.setAttribute('aria-pressed', String(model.id === selectedModelId));
      choice.disabled = isBusy || (hasSelectedAttachments() && !model.supports_images);
      choice.append(element('span', 'tutor-model-choice__name', model.name || model.id));
      if (model.id && model.name && model.id !== model.name) {
        choice.append(element('span', 'tutor-model-choice__detail', model.id));
      }
      const selectedMark = element('span', 'tutor-model-choice__check', '✓');
      selectedMark.setAttribute('aria-hidden', 'true');
      choice.append(selectedMark);
      choice.addEventListener('click', () => {
        modelSelect.value = model.id;
        modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      modelChoiceList.append(choice);
    }
    modelEmpty.hidden = models.length > 0 || !providerChoices.hidden;
    responseLanguageSelect.disabled = isBusy;
    responseLanguageSelect.value = selectedResponseLanguage;
  }

  function currentSelectionPayload() {
    if (!selectedProviderId || !selectedModelId) return {};
    return { provider_id: selectedProviderId, model_id: selectedModelId };
  }

  function hasSelectedAttachments() {
    return selectedImages.length + selectedAttachmentRefs.size > 0;
  }

  function currentModel() {
    return providerById(selectedProviderId)?.models.find((model) => model.id === selectedModelId) || null;
  }

  function selectedModelSupportsImages() {
    return Boolean(currentModel()?.supports_images);
  }

  function renderAttachmentPreviews() {
    attachmentPreviews.replaceChildren();
    selectedImages.forEach((entry, index) => {
      const card = element('div', 'tutor-image-preview');
      if (entry.previewUrl) {
        const image = element('img', 'tutor-image-preview__image');
        image.src = entry.previewUrl;
        image.alt = `ตัวอย่าง ${entry.file.name}`;
        card.append(image);
      }
      card.append(element('span', 'tutor-image-preview__name', entry.file.name));
      const remove = element('button', 'button button-secondary tutor-image-preview__remove', 'นำออก');
      remove.type = 'button';
      remove.dataset.action = 'remove-tutor-image';
      remove.addEventListener('click', () => {
        const [removed] = selectedImages.splice(index, 1);
        if (removed?.previewUrl) globalThis.URL?.revokeObjectURL?.(removed.previewUrl);
        renderAttachmentPreviews();
        renderModelControls();
        renderAttachmentCapability();
      });
      card.append(remove);
      attachmentPreviews.append(card);
    });
    for (const attachment of selectedAttachmentRefs.values()) {
      const card = element('div', 'tutor-image-preview tutor-image-preview--saved');
      card.append(element('span', 'tutor-image-preview__name', `ภาพเดิม · ${attachment.filename || 'ภาพที่แนบ'}`));
      const remove = element('button', 'button button-secondary tutor-image-preview__remove', 'นำออก');
      remove.type = 'button';
      remove.dataset.action = 'remove-tutor-attachment';
      remove.addEventListener('click', () => {
        selectedAttachmentRefs.delete(attachment.id);
        renderAttachmentPreviews();
        renderModelControls();
        renderAttachmentCapability();
      });
      card.append(remove);
      attachmentPreviews.append(card);
    }
  }

  function renderAttachmentCapability() {
    const hasAttachments = hasSelectedAttachments();
    const modelSupportsImages = selectedModelSupportsImages();
    imageCapability.hidden = !hasAttachments || modelSupportsImages;
    if (hasAttachments && !modelSupportsImages) {
      const anyImageModel = aiCatalog.providers.some((provider) => provider.models.some((model) => model.supports_images));
      imageCapability.textContent = anyImageModel
        ? 'โมเดลที่เลือกยังไม่รองรับภาพ กรุณาเลือกโมเดลที่รองรับ หรือเอาภาพออกก่อนส่ง'
        : 'ยังไม่มีโมเดลที่ยืนยันการรองรับภาพ ภาพและข้อความจะยังคงอยู่จนกว่าจะเลือกโมเดลที่รองรับ';
    } else {
      imageCapability.textContent = '';
    }
    submitButton.disabled = isBusy
      || Boolean(pendingSubmission)
      || !selectedProviderId
      || !selectedModelId
      || (hasAttachments && !modelSupportsImages);
    attachmentButton.disabled = isBusy;
  }

  function addAttachmentReference(attachment) {
    if (selectedAttachmentRefs.has(attachment.id)) return;
    if (hasSelectedAttachments() && selectedImages.length + selectedAttachmentRefs.size >= 3) {
      setPageMessage('แนบภาพได้ไม่เกิน 3 ภาพต่อข้อความ', true);
      return;
    }
    selectedAttachmentRefs.set(attachment.id, attachment);
    renderAttachmentPreviews();
    renderModelControls();
    renderAttachmentCapability();
    setPageMessage('');
  }

  function clearSelectedAttachments() {
    for (const entry of selectedImages) {
      if (entry.previewUrl) globalThis.URL?.revokeObjectURL?.(entry.previewUrl);
    }
    selectedImages.splice(0);
    selectedAttachmentRefs.clear();
    renderAttachmentPreviews();
    renderModelControls();
    renderAttachmentCapability();
  }

  function addSelectedImageFiles(fileList) {
    const incoming = [...(fileList || [])];
    if (incoming.length === 0) return;
    const currentCount = selectedImages.length + selectedAttachmentRefs.size;
    const currentBytes = selectedImages.reduce((total, entry) => total + entry.file.size, 0)
      + [...selectedAttachmentRefs.values()].reduce((total, attachment) => total + attachment.byte_size, 0);
    const incomingBytes = incoming.reduce((total, file) => total + file.size, 0);
    const invalidType = incoming.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    const invalidSize = incoming.some((file) => file.size <= 0 || file.size > 5 * 1024 * 1024);
    if (currentCount + incoming.length > 3) {
      setPageMessage('ไม่รับไฟล์ภาพ: แนบได้ไม่เกิน 3 ภาพต่อข้อความ', true);
      return;
    }
    if (invalidType) {
      setPageMessage('ไม่รับไฟล์ภาพ: รองรับเฉพาะ JPEG, PNG และ WebP', true);
      return;
    }
    if (invalidSize) {
      setPageMessage('ไม่รับไฟล์ภาพ: แต่ละภาพต้องมีขนาดมากกว่า 0 และไม่เกิน 5 MB', true);
      return;
    }
    if (currentBytes + incomingBytes > 15 * 1024 * 1024) {
      setPageMessage('ไม่รับไฟล์ภาพ: ขนาดรวมต่อข้อความต้องไม่เกิน 15 MB', true);
      return;
    }
    for (const file of incoming) {
      let previewUrl = '';
      try {
        if (typeof globalThis.URL?.createObjectURL === 'function') {
          previewUrl = globalThis.URL.createObjectURL(file);
        }
      } catch {
        previewUrl = '';
      }
      selectedImages.push({ file, previewUrl });
    }
    renderAttachmentPreviews();
    renderModelControls();
    renderAttachmentCapability();
    setPageMessage('');
  }

  function buildImageFormData(submission) {
    const formData = new FormData();
    formData.append('message', submission.message);
    formData.append('request_id', submission.requestId);
    formData.append('response_language', submission.response_language || 'th');
    if (submission.provider_id) formData.append('provider_id', submission.provider_id);
    if (submission.model_id) formData.append('model_id', submission.model_id);
    for (const tagId of submission.tagIds || []) formData.append('tag_ids', String(tagId));
    for (const attachmentId of selectedAttachmentRefs.keys()) formData.append('attachment_ids', String(attachmentId));
    for (const { file } of selectedImages) formData.append('images', file, file.name);
    return formData;
  }

  function setPageMessage(text, isError = false) {
    pageMessage.textContent = text;
    pageMessage.setAttribute('role', isError ? 'alert' : 'status');
    if (isError) pageMessage.dataset.state = 'error';
    else delete pageMessage.dataset.state;
  }

  function renderHistory() {
    historyList.replaceChildren();
    if (isLoadingHistory) {
      historyMessage.textContent = 'กำลังโหลดประวัติ…';
      return;
    }
    historyMessage.textContent = historyError;
    historyMessage.setAttribute('role', historyError ? 'alert' : 'status');
    if (historyError) {
      historyList.append(emptyState('โหลดประวัติไม่สำเร็จ', 'ตรวจสอบการเชื่อมต่อแล้วลองค้นหาอีกครั้ง'));
      return;
    }
    if (conversations.length === 0) {
      historyList.append(emptyState(
        activeQuery || activeTagId ? 'ไม่พบประวัติที่ตรงกัน' : 'ยังไม่มีประวัติการถาม',
        activeQuery || activeTagId ? 'ลองเปลี่ยนคำค้นหาหรือเลือกแท็กอื่น' : 'เมื่อเริ่มถาม ระบบจะเก็บบทสนทนาของคุณไว้ที่นี่',
      ));
      return;
    }
    historyList.append(...conversations.map((item) => renderConversationCard(item, openConversation)));
  }

  function renderConversation() {
    const wasAtBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight <= 48;
    const statusValue = activeConversation?.status || (pendingSubmission ? 'processing' : null);
    conversationTitle.textContent = activeConversation?.title || (activeConversationId ? 'บทสนทนา' : 'เริ่มต้นด้วยคำถามของคุณ');
    conversationTags.replaceChildren(renderTagChips(activeConversation?.tags || []));
    if (statusValue) status.textContent = statusLabel(statusValue);
    else status.textContent = 'เขียนคำถามได้เลย ระบบจะเก็บประวัติไว้ให้';
    messages.replaceChildren();
    const currentMessages = [...(activeConversation?.messages || [])];
    if (pendingSubmission && !currentMessages.some((item) => item.request_id === pendingSubmission.requestId)) {
      const lastMessage = currentMessages.at(-1);
      const duplicateOptimistic = lastMessage?.role === 'user' && lastMessage.content === pendingSubmission.message;
      if (!duplicateOptimistic) {
        currentMessages.push({
          id: `pending-${pendingSubmission.requestId}`,
          sequence: currentMessages.length + 1,
          role: 'user',
          kind: pendingSubmission.mode === 'reply' ? 'clarification_reply' : 'question',
          content: pendingSubmission.message,
        });
      }
    }
    if (currentMessages.length > 0) {
      messages.append(...currentMessages.map((item) => renderTutorMessage(
        item,
        aiCatalog,
        activeConversationId,
        addAttachmentReference,
        getAttachmentUrl,
      )));
    } else {
      messages.append(emptyState('ถามได้ทุกเมื่อ', 'พิมพ์คำถามไว้ด้านล่าง แล้ว AI จะช่วยอธิบายหรือถามกลับหากต้องการบริบทเพิ่ม'));
    }

    const awaitingClarification = statusValue === 'awaiting_clarification';
    inputLabel.textContent = awaitingClarification ? 'คำตอบเพิ่มเติม' : 'คำถามหรือข้อความเพิ่มเติม';
    input.placeholder = awaitingClarification
      ? 'ตอบคำถามเพิ่มเติมเพื่อให้ AI อธิบายได้ตรงจุด…'
      : 'พิมพ์สิ่งที่สงสัย หรือให้บริบทเพิ่มเติม…';
    input.disabled = isBusy;
    retryButton.hidden = !pendingSubmission || isBusy;
    retryButton.disabled = isBusy;
    providerSelect.disabled = isBusy || aiCatalog.providers.length === 0;
    providerTrigger.disabled = isBusy || aiCatalog.providers.length === 0;
    modelSelect.disabled = isBusy || !selectedModelId;
    responseLanguageSelect.disabled = isBusy;
    responseLanguageSelect.value = selectedResponseLanguage;
    retryButton.textContent = statusValue === 'processing' ? 'ตรวจสอบสถานะ' : 'ลองส่งใหม่';
    tagPickerContainer.hidden = Boolean(activeConversationId);
    tagDialogHint.hidden = !activeConversationId;
    submitButton.setAttribute('aria-label', activeConversationId
      ? (awaitingClarification ? 'ส่งคำตอบ' : 'ส่งข้อความ')
      : 'ส่งคำถาม');
    newConversationButton.disabled = isBusy;
    retryButton.dataset.requestId = pendingSubmission?.requestId || '';
    retryButton.dataset.conversationId = String(pendingSubmission?.conversationId || activeConversationId || '');
    renderAttachmentCapability();
    if (wasAtBottom) messages.scrollTop = Math.max(0, messages.scrollHeight - messages.clientHeight);
  }

  async function refreshHistory() {
    isLoadingHistory = true;
    renderHistory();
    try {
      const result = await loadConversations({ q: activeQuery, tagId: activeTagId });
      conversations = Array.isArray(result) ? result : [];
      historyError = '';
    } catch (error) {
      conversations = [];
      historyError = error?.message || 'โหลดประวัติไม่สำเร็จ กรุณาลองอีกครั้ง';
    } finally {
      isLoadingHistory = false;
      renderHistory();
    }
  }

  async function reloadTagCatalog() {
    const catalog = await loadTags();
    tagCatalog = catalog && Array.isArray(catalog.tags) ? catalog : { tags: [] };
    tagPicker.setCatalog(tagCatalog);
    const replacement = renderTagFilter(tagCatalog, selectedFilterTagId, (id) => {
      selectedFilterTagId = id;
    });
    replacement.dataset.role = 'tutor-tag-filter';
    replacement.setAttribute('aria-label', 'กรองประวัติตามวิชาหรือแท็ก');
    tagFilter.replaceWith(replacement);
    tagFilter = replacement;
  }

  async function openConversation(id) {
    if (isBusy) return;
    setPageMessage('กำลังเปิดบทสนทนา…');
    try {
      const detail = await loadConversation(id);
      const numericId = Number(detail?.id);
      if (!Number.isSafeInteger(numericId) || numericId <= 0) throw new Error('ข้อมูลบทสนทนาไม่ถูกต้อง');
      activeConversationId = numericId;
      activeConversation = detail;
      const latestUserMessage = [...(detail.messages || [])].reverse().find((item) => item.role === 'user');
      selectedResponseLanguage = latestUserMessage?.response_language === 'en' ? 'en' : 'th';
      responseLanguageSelect.value = selectedResponseLanguage;
      if (detail.provider_id && detail.model_id) {
        selectedProviderId = detail.provider_id;
        selectedModelId = detail.model_id;
        renderModelControls();
      }
      pendingSubmission = detail.status === 'retryable_error'
        ? {
          message: [...(detail.messages || [])].reverse().find((item) => item.role === 'user')?.content || '',
          requestId: '',
          tagIds: [],
          response_language: latestUserMessage?.response_language === 'en' ? 'en' : 'th',
          mode: 'retry-saved',
          conversationId: numericId,
        }
        : null;
      setPageMessage('');
      renderConversation();
      closeHistoryPanel({ focusConversation: true });
    } catch (error) {
      setPageMessage(error?.message || 'เปิดบทสนทนาไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    }
  }

  function setOptimisticSubmission(submission) {
    pendingSubmission = submission;
    const existing = activeConversation?.messages || [];
    activeConversation = {
      id: activeConversationId,
      title: activeConversation?.title || submission.message.slice(0, 160),
      status: 'processing',
      tags: activeConversation?.tags || [],
      messages: existing,
    };
    renderConversation();
  }

  async function executeSubmission(submission, { retry = false } = {}) {
    if (isBusy) return;
    isBusy = true;
    setPageMessage(retry ? 'กำลังลองส่งคำถามเดิมอีกครั้ง…' : 'กำลังส่งคำถาม…');
    setOptimisticSubmission(submission);
    renderConversation();
    try {
      let result;
      const conversationId = submission.conversationId || activeConversationId;
      const selection = submission.provider_id && submission.model_id
        ? { provider_id: submission.provider_id, model_id: submission.model_id }
        : {};
      const responseLanguage = submission.response_language === 'en' ? 'en' : 'th';
      const attachmentIds = [...selectedAttachmentRefs.keys()];
      if (retry && conversationId && submission.mode === 'retry-saved') {
        result = await retryMessage(conversationId, { ...selection, response_language: responseLanguage });
      } else if (selectedImages.length > 0) {
        const formData = buildImageFormData(submission);
        result = conversationId && submission.mode !== 'start'
          ? await sendMessageWithImages(conversationId, formData)
          : await createConversationWithImages(formData);
      } else if (conversationId && submission.mode !== 'start') {
        result = await sendMessage(conversationId, {
          message: submission.message,
          request_id: submission.requestId,
          response_language: responseLanguage,
          ...selection,
          ...(attachmentIds.length > 0 ? { attachment_ids: attachmentIds } : {}),
        });
      } else {
        result = await createConversation({
          message: submission.message,
          tag_ids: submission.tagIds,
          request_id: submission.requestId,
          response_language: responseLanguage,
          ...selection,
        });
      }
      const resultId = Number(result?.id);
      if (!Number.isSafeInteger(resultId) || resultId <= 0) throw new Error('ระบบไม่ได้ส่งข้อมูลบทสนทนากลับมา');
      activeConversationId = resultId;
      activeConversation = result;
      pendingSubmission = result?.status === 'retryable_error' || result?.status === 'processing'
        ? {
          ...submission,
          conversationId: resultId,
          mode: result.status === 'retryable_error' ? 'retry-saved' : submission.mode,
        }
        : null;
      if (result.status !== 'retryable_error') {
        if (input.value.trim() === submission.message) {
          input.value = '';
          resizeTutorTextarea(input);
        }
        clearSelectedAttachments();
      }
      setPageMessage(result?.status === 'processing' ? 'คำถามกำลังประมวลผลอยู่ คุณตรวจสอบสถานะได้อีกครั้ง' : '');
      renderConversation();
      await refreshHistory();
    } catch (error) {
      const failedConversationId = Number(error?.detail?.conversation_id);
      const usableConversationId = Number.isSafeInteger(failedConversationId) && failedConversationId > 0
        ? failedConversationId
        : submission.conversationId || activeConversationId;
      if (usableConversationId) {
        activeConversationId = usableConversationId;
        submission.conversationId = usableConversationId;
        try {
          const saved = await loadConversation(usableConversationId);
          activeConversation = saved;
          if (saved.status === 'retryable_error') submission.mode = 'retry-saved';
        } catch {
          activeConversation = { ...activeConversation, id: usableConversationId };
        }
      }
      pendingSubmission = submission;
      setPageMessage(error?.message || 'ส่งคำถามไม่สำเร็จ ข้อความยังอยู่ ลองส่งอีกครั้งได้', true);
      renderConversation();
      await refreshHistory();
    } finally {
      isBusy = false;
      renderConversation();
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (isBusy) return;
    if (pendingSubmission) {
      pendingSubmission.response_language = selectedResponseLanguage;
      await executeSubmission(pendingSubmission, { retry: true });
      return;
    }
    const text = input.value.trim();
    if (!text) {
      setPageMessage('กรุณาพิมพ์คำถามก่อนส่ง', true);
      input.focus();
      return;
    }
    if (!selectedProviderId || !selectedModelId) {
      setPageMessage('เลือกรายการ Provider และ Model ก่อนส่งคำถาม', true);
      openModelPicker();
      return;
    }
    if (hasSelectedAttachments() && !selectedModelSupportsImages()) {
      renderAttachmentCapability();
      setPageMessage(imageCapability.textContent, true);
      return;
    }
    const submission = {
      message: text,
      tagIds: activeConversationId ? [] : [...selectedTagIds],
      requestId: requestId(),
      response_language: selectedResponseLanguage,
      ...currentSelectionPayload(),
      attachmentIds: [...selectedAttachmentRefs.keys()],
      mode: activeConversationId ? 'reply' : 'start',
      conversationId: activeConversationId,
    };
    await executeSubmission(submission);
  }

  function startNewConversation() {
    if (isBusy) return;
    if (pendingSubmission && !activeConversationId) {
      setPageMessage('มีคำถามที่ยังส่งไม่สำเร็จ กรุณาลองส่งคำถามเดิมก่อน', true);
      return;
    }
    activeConversationId = null;
    activeConversation = null;
    pendingSubmission = null;
    clearSelectedAttachments();
    selectedResponseLanguage = 'th';
    responseLanguageSelect.value = selectedResponseLanguage;
    selectedTagIds.clear();
    tagPicker.setSelectedTagIds([]);
    tagPickerContainer.hidden = false;
    tagDialogHint.hidden = true;
    input.value = '';
    resizeTutorTextarea(input);
    setPageMessage('');
    renderConversation();
    closeHistoryPanel();
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    activeQuery = searchInput.value.trim();
    activeTagId = selectedFilterTagId;
    void refreshHistory();
  });
  form.addEventListener('submit', (event) => { void submitMessage(event); });
  attachmentButton.addEventListener('click', () => attachmentInput.click());
  attachmentInput.addEventListener('change', () => {
    addSelectedImageFiles(attachmentInput.files);
    attachmentInput.value = '';
  });
  retryButton.addEventListener('click', () => {
    if (pendingSubmission) {
      Object.assign(pendingSubmission, currentSelectionPayload(), {
        response_language: selectedResponseLanguage,
      });
      void executeSubmission(pendingSubmission, { retry: true });
    }
  });
  providerSelect.addEventListener('change', () => {
    selectedProviderId = providerSelect.value;
    selectedModelId = '';
    setProviderChoiceMenuOpen(false);
    renderModelControls();
    renderAttachmentCapability();
  });
  modelSelect.addEventListener('change', () => {
    selectedModelId = modelSelect.value;
    renderModelControls();
    renderAttachmentCapability();
    closeModelPicker({ returnFocus: true });
  });
  providerTrigger.addEventListener('click', openModelPicker);
  providerToggle.addEventListener('click', toggleProviderChoices);
  modelPickerClose.addEventListener('click', () => closeModelPicker({ returnFocus: true }));
  contextTrigger.addEventListener('click', openTagDialog);
  tagDialogClose.addEventListener('click', () => closeTagDialog({ returnFocus: true }));
  tagDialogLayer.addEventListener('click', (event) => {
    if (event.target === tagDialogLayer) closeTagDialog({ returnFocus: true });
  });
  page.addEventListener('click', (event) => {
    const clickPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const clickedInsidePicker = clickPath.includes(modelPicker) || modelPicker.contains(event.target);
    if (!modelPicker.hidden && !clickedInsidePicker && !providerTrigger.contains(event.target)) {
      closeModelPicker();
    }
  });
  responseLanguageSelect.addEventListener('change', () => {
    selectedResponseLanguage = responseLanguageSelect.value === 'en' ? 'en' : 'th';
  });
  newConversationButton.addEventListener('click', startNewConversation);
  historyToggle.addEventListener('click', () => {
    if (historyPanel.hidden) openHistoryPanel();
    else closeHistoryPanel({ returnFocus: true });
  });
  historyClose.addEventListener('click', () => closeHistoryPanel({ returnFocus: true }));
  page.addEventListener('keydown', (event) => {
    if (!tagDialogLayer.hidden && event.key === 'Tab') {
      const focusable = [...tagDialog.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
        .filter((control) => !control.closest('[hidden]'))
        .sort((first, second) => {
          if (first === second) return 0;
          return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
      if (!focusable.length) {
        event.preventDefault();
        tagDialogClose.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !tagDialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !tagDialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key !== 'Escape') return;
    if (!tagDialogLayer.hidden) {
      event.preventDefault();
      closeTagDialog({ returnFocus: true });
      return;
    }
    if (!modelPicker.hidden) {
      event.preventDefault();
      closeModelPicker({ returnFocus: true });
      return;
    }
    if (!historyPanel.hidden) {
      event.preventDefault();
      closeHistoryPanel({ returnFocus: true });
    }
  });

  void refreshHistory();
  void reloadTagCatalog().catch((error) => {
    setPageMessage(error?.message || 'โหลดแท็กไม่สำเร็จ แต่ยังเริ่มถามได้', true);
  });
  void loadProviders().then((catalog) => {
    aiCatalog = catalog && Array.isArray(catalog.providers)
      ? catalog
      : { providers: [], default_selection: null };
    const activeSelection = activeConversation?.provider_id && activeConversation?.model_id
      ? { provider_id: activeConversation.provider_id, model_id: activeConversation.model_id }
      : aiCatalog.default_selection;
    selectedProviderId = activeSelection?.provider_id || '';
    selectedModelId = activeSelection?.model_id || '';
    renderModelControls();
    renderConversation();
  }).catch((error) => {
    aiCatalog = { providers: [], default_selection: null };
    renderModelControls();
    renderConversation();
    setPageMessage(error?.message || 'โหลดรายการ Provider/Model ไม่สำเร็จ กรุณาลองใหม่', true);
  });
  renderModelControls();
  renderConversation();
  return page;
}
