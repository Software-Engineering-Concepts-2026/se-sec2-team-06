const configuredBasePath = import.meta.env?.VITE_API_BASE_PATH;
const defaultBasePath = configuredBasePath || '/api';

export class ApiError extends Error {
  constructor(status, message = 'ไม่สามารถเชื่อมต่อ API ได้', detail = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (detail !== undefined) this.detail = detail;
  }
}

function normalizeBasePath(basePath) {
  const value = String(basePath || '/api').trim();
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function isHealthPayload(payload) {
  return payload !== null
    && typeof payload === 'object'
    && ['status', 'service', 'architecture', 'version'].every(
      (field) => typeof payload[field] === 'string' && payload[field].length > 0,
    );
}

export async function getApiHealth({ fetchImpl = globalThis.fetch, basePath = defaultBasePath } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new ApiError(0);
  }

  const url = `${normalizeBasePath(basePath)}/health`;
  let response;

  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(0);
  }

  if (!response?.ok) {
    throw new ApiError(response?.status ?? 0);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Invalid API health response');
  }

  if (!isHealthPayload(payload)) {
    throw new Error('Invalid API health response');
  }

  return {
    status: payload.status,
    service: payload.service,
    architecture: payload.architecture,
    version: payload.version,
  };
}

function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function safeFailureMessage(status, payload) {
  if (status >= 500) {
    return 'ขณะนี้ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง';
  }
  if (typeof payload?.detail === 'string' && payload.detail.length <= 300) {
    return payload.detail;
  }
  if (typeof payload?.detail?.message === 'string' && payload.detail.message.length <= 300) {
    return payload.detail.message;
  }
  return 'คำขอไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง';
}

function safeFailureDetail(payload) {
  const detail = payload?.detail;
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return undefined;
  const safe = {};
  if (typeof detail.code === 'string' && detail.code.length <= 80) safe.code = detail.code;
  if (typeof detail.message === 'string' && detail.message.length <= 300) safe.message = detail.message;
  if (Number.isSafeInteger(detail.conversation_id) && detail.conversation_id > 0) {
    safe.conversation_id = detail.conversation_id;
  }
  if (typeof detail.retryable === 'boolean') safe.retryable = detail.retryable;
  return Object.keys(safe).length > 0 ? safe : undefined;
}

async function requestJson(path, {
  fetchImpl = globalThis.fetch,
  basePath = defaultBasePath,
  method = 'GET',
  body,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new ApiError(0);
  }

  const headers = { Accept: 'application/json' };
  const options = { method, credentials: 'same-origin', headers };
  if (body !== undefined) {
    if (isFormData(body)) {
      options.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetchImpl(`${normalizeBasePath(basePath)}${path}`, options);
  } catch {
    throw new ApiError(0);
  }

  if (!response?.ok) {
    let payload;
    try {
      payload = await response?.json?.();
    } catch {
      payload = undefined;
    }
    throw new ApiError(
      response?.status ?? 0,
      safeFailureMessage(response?.status ?? 0, payload),
      safeFailureDetail(payload),
    );
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    throw new Error('Invalid API response');
  }
}

async function requestBlob(path, {
  fetchImpl = globalThis.fetch,
  basePath = defaultBasePath,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new ApiError(0);
  }

  let response;
  try {
    response = await fetchImpl(`${normalizeBasePath(basePath)}${path}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/pdf' },
    });
  } catch {
    throw new ApiError(0);
  }

  if (!response?.ok) {
    let payload;
    try {
      payload = await response?.json?.();
    } catch {
      payload = undefined;
    }
    throw new ApiError(
      response?.status ?? 0,
      safeFailureMessage(response?.status ?? 0, payload),
      safeFailureDetail(payload),
    );
  }

  try {
    return await response.blob();
  } catch {
    throw new Error('Invalid API response');
  }
}

function documentPathId(documentId) {
  const id = Number(documentId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError('documentId must be a positive safe integer');
  }
  return String(id);
}

function quizPathId(quizId) {
  const id = Number(quizId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError('quizId must be a positive safe integer');
  }
  return id;
}

function deadlinePathId(deadlineId) {
  const id = Number(deadlineId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError('deadlineId must be a positive safe integer');
  }
  return String(id);
}

function tutorConversationPathId(conversationId) {
  const id = Number(conversationId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError('conversationId must be a positive safe integer');
  }
  return String(id);
}

function progressTagPathId(tagId) {
  const id = Number(tagId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError('tagId must be a positive safe integer');
  }
  return String(id);
}

export function register(payload, options) {
  return requestJson('/auth/register', { ...options, method: 'POST', body: payload });
}

export function login(payload, options) {
  return requestJson('/auth/login', { ...options, method: 'POST', body: payload });
}

export function getCurrentUser(options) {
  return requestJson('/auth/me', options);
}

export function logout(options) {
  return requestJson('/auth/logout', { ...options, method: 'POST' });
}

export function getProfile(options) {
  return requestJson('/profile', options);
}

export function updateProfile(payload, options) {
  return requestJson('/profile', { ...options, method: 'PATCH', body: payload });
}

export function uploadAvatar(file, options) {
  const formData = new FormData();
  formData.append('file', file);
  return requestJson('/profile/avatar', { ...options, method: 'PUT', body: formData });
}

export function getQuizProviders(options) {
  return requestJson('/quizzes/providers', options);
}

export function getAiProviders(options) {
  return requestJson('/ai/providers', options);
}

export function generateQuiz(formData, options) {
  return requestJson('/quizzes/generate', { ...options, method: 'POST', body: formData });
}

export function listQuizzes({ limit, offset, q, tagId } = {}, options) {
  const query = new URLSearchParams();
  if (limit !== undefined) query.set('limit', String(limit));
  if (offset !== undefined) query.set('offset', String(offset));
  if (typeof q === 'string' && q.trim()) query.set('q', q.trim());
  if (tagId !== undefined && tagId !== null && tagId !== '') query.set('tag_id', String(tagId));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return requestJson(`/quizzes${suffix}`, options);
}

export function listTags(options) {
  return requestJson('/tags', options);
}

export function createTag(payload, options) {
  return requestJson('/tags', { ...options, method: 'POST', body: payload });
}

export function replaceQuizTags(quizId, payload, options) {
  return requestJson(`/quizzes/${quizId}/tags`, { ...options, method: 'PUT', body: payload });
}

export function getQuiz(quizId, options) {
  return requestJson(`/quizzes/${quizId}`, options);
}

export function renameQuiz(quizId, payload, options) {
  return requestJson(`/quizzes/${quizPathId(quizId)}`, { ...options, method: 'PATCH', body: payload });
}

export function deleteQuiz(quizId, options) {
  return requestJson(`/quizzes/${quizPathId(quizId)}`, { ...options, method: 'DELETE' });
}

export function submitQuizAttempt(quizId, payload, options) {
  return requestJson(`/quizzes/${quizId}/attempts`, { ...options, method: 'POST', body: payload });
}

export function getQuizAttempts(quizId, options) {
  return requestJson(`/quizzes/${quizId}/attempts`, options);
}

export function getQuizAttempt(quizId, attemptId, options) {
  return requestJson(`/quizzes/${quizId}/attempts/${attemptId}`, options);
}

export function listDocuments({ limit, offset, q, tagId } = {}, options) {
  const query = new URLSearchParams();
  if (limit !== undefined) query.set('limit', String(limit));
  if (offset !== undefined) query.set('offset', String(offset));
  if (typeof q === 'string' && q.trim()) query.set('q', q.trim());
  if (tagId !== undefined && tagId !== null && tagId !== '') query.set('tag_id', String(tagId));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return requestJson(`/documents${suffix}`, options);
}

export function uploadDocument(formData, options) {
  return requestJson('/documents', { ...options, method: 'POST', body: formData });
}

export function getDocument(documentId, options) {
  return requestJson(`/documents/${documentPathId(documentId)}`, options);
}

export function getDocumentContent(documentId, options) {
  return requestBlob(`/documents/${documentPathId(documentId)}/content`, options);
}

export function getDocumentDownloadUrl(documentId, { basePath = defaultBasePath } = {}) {
  return `${normalizeBasePath(basePath)}/documents/${documentPathId(documentId)}/download`;
}

export function getDocumentText(documentId, options) {
  return requestJson(`/documents/${documentPathId(documentId)}/text`, options);
}

export function renameDocument(documentId, payload, options) {
  return requestJson(`/documents/${documentPathId(documentId)}`, { ...options, method: 'PATCH', body: payload });
}

export function replaceDocumentTags(documentId, payload, options) {
  return requestJson(`/documents/${documentPathId(documentId)}/tags`, { ...options, method: 'PUT', body: payload });
}

export function saveDocumentProgress(documentId, payload, options) {
  return requestJson(`/documents/${documentPathId(documentId)}/progress`, { ...options, method: 'PUT', body: payload });
}

export function deleteDocument(documentId, options) {
  return requestJson(`/documents/${documentPathId(documentId)}`, { ...options, method: 'DELETE' });
}

export function listDeadlines(options) {
  return requestJson('/deadlines', options);
}

export function createDeadline(payload, options) {
  return requestJson('/deadlines', { ...options, method: 'POST', body: payload });
}

export function updateDeadline(deadlineId, payload, options) {
  return requestJson(`/deadlines/${deadlinePathId(deadlineId)}`, {
    ...options,
    method: 'PATCH',
    body: payload,
  });
}

export function deleteDeadline(deadlineId, options) {
  return requestJson(`/deadlines/${deadlinePathId(deadlineId)}`, {
    ...options,
    method: 'DELETE',
  });
}

export function listTutorConversations({ q, tagId } = {}, options) {
  const query = new URLSearchParams();
  if (typeof q === 'string' && q.trim()) query.set('q', q.trim());
  if (tagId !== undefined && tagId !== null && tagId !== '') query.set('tag_id', String(tagId));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return requestJson(`/tutor/conversations${suffix}`, options);
}

export function getTutorConversation(conversationId, options) {
  return requestJson(`/tutor/conversations/${tutorConversationPathId(conversationId)}`, options);
}

export function getTutorAttachmentUrl(conversationId, attachmentId) {
  return `${normalizeBasePath(defaultBasePath)}/tutor/conversations/${tutorConversationPathId(conversationId)}/attachments/${tutorConversationPathId(attachmentId)}`;
}

export function createTutorConversation(payload, options) {
  return requestJson('/tutor/conversations', { ...options, method: 'POST', body: payload });
}

export function createTutorConversationWithImages(formData, options) {
  return requestJson('/tutor/conversations/with-images', { ...options, method: 'POST', body: formData });
}

export function sendTutorMessage(conversationId, payload, options) {
  return requestJson(`/tutor/conversations/${tutorConversationPathId(conversationId)}/messages`, {
    ...options,
    method: 'POST',
    body: payload,
  });
}

export function sendTutorMessageWithImages(conversationId, formData, options) {
  return requestJson(`/tutor/conversations/${tutorConversationPathId(conversationId)}/messages/with-images`, {
    ...options,
    method: 'POST',
    body: formData,
  });
}

export function retryTutorMessage(conversationId, payloadOrOptions, options) {
  const hasSelection = payloadOrOptions !== undefined
    && (
      Object.hasOwn(payloadOrOptions, 'provider_id')
      || Object.hasOwn(payloadOrOptions, 'model_id')
      || Object.hasOwn(payloadOrOptions, 'response_language')
    );
  const requestOptions = hasSelection ? options : payloadOrOptions;
  return requestJson(`/tutor/conversations/${tutorConversationPathId(conversationId)}/retry`, {
    ...requestOptions,
    method: 'POST',
    ...(hasSelection ? { body: payloadOrOptions } : {}),
  });
}

export function getProgress({ q, tagId } = {}, options) {
  const query = new URLSearchParams();
  if (typeof q === 'string' && q.trim()) query.set('q', q.trim());
  if (tagId !== undefined && tagId !== null && tagId !== '') query.set('tag_id', String(tagId));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return requestJson(`/progress${suffix}`, options);
}

export function getDashboardOverview({ period = 'day', timeZone = 'UTC' } = {}, options) {
  const query = new URLSearchParams({ period, time_zone: timeZone });
  return requestJson(`/dashboard/overview?${query.toString()}`, options);
}

export function getProgressTopic(tagId, options) {
  return requestJson(`/progress/topics/${progressTagPathId(tagId)}`, options);
}
