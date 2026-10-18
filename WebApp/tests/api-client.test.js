import { describe, expect, it, vi } from 'vitest';
import * as apiClient from '../src/api/client.js';
import {
  ApiError,
  getApiHealth,
  getAiProviders,
  getCurrentUser,
  getDashboardOverview,
  getProfile,
  login,
  logout,
  register,
  updateProfile,
  uploadAvatar,
} from '../src/api/client.js';

describe('getApiHealth', () => {
  it('requests the same-origin health endpoint and returns the contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'healthy',
        service: 'synapsesync-api',
        architecture: 'modular-monolith',
        version: '0.1.0'
      })
    });

    await expect(getApiHealth({ fetchImpl })).resolves.toEqual({
      status: 'healthy',
      service: 'synapsesync-api',
      architecture: 'modular-monolith',
      version: '0.1.0'
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/health', { headers: { Accept: 'application/json' } });
  });

  it('turns a failed response into a safe ApiError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(getApiHealth({ fetchImpl })).rejects.toMatchObject({ status: 503 });
    await expect(getApiHealth({ fetchImpl })).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a response that does not match the health contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'healthy' }) });
    await expect(getApiHealth({ fetchImpl })).rejects.toThrow('Invalid API health response');
  });
});

describe('home dashboard API client', () => {
  it('sends the selected period and browser timezone to the authenticated overview endpoint', async () => {
    const overview = { quiz_activity: [], task_status: {}, documents_by_tag: [], topics_to_review: [] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => overview });

    await expect(getDashboardOverview({ period: 'week', timeZone: 'Asia/Bangkok' }, { fetchImpl }))
      .resolves.toEqual(overview);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/dashboard/overview?period=week&time_zone=Asia%2FBangkok',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });
});

describe('account and profile API client', () => {
  it('registers and logs in using same-origin cookie credentials', async () => {
    const user = { id: 7, email: 'learner@example.com', display_name: 'Learner' };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => user });

    await expect(register({ email: user.email, password: 'studyPlan42', display_name: user.display_name }, { fetchImpl }))
      .resolves.toEqual(user);
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email: user.email, password: 'studyPlan42', display_name: user.display_name }),
    }));

    await login({ email: user.email, password: 'studyPlan42' }, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
    }));
  });

  it('reads session/profile, updates profile, and logs out with the expected HTTP methods', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url, options = {}) => ({
      ok: true,
      status: options.method === 'POST' ? 204 : 200,
      json: async () => ({ id: 7, display_name: 'Learner' }),
    }));

    await getCurrentUser({ fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'same-origin' }));
    await getProfile({ fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/profile', expect.objectContaining({ credentials: 'same-origin' }));
    await updateProfile({ display_name: 'New name', bio: 'Hello' }, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/profile', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'New name', bio: 'Hello' }),
    }));
    await logout({ fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('uploads a profile image as multipart data without setting a fake content type', async () => {
    const image = new Blob(['image-bytes'], { type: 'image/png' });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ avatar_url: '/api/profile/avatar' }),
    });

    await expect(uploadAvatar(image, { fetchImpl })).resolves.toEqual({ avatar_url: '/api/profile/avatar' });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/profile/avatar');
    expect(options.method).toBe('PUT');
    expect(options.credentials).toBe('same-origin');
    expect(options.headers).not.toHaveProperty('Content-Type');
    expect(options.body).toBeInstanceOf(FormData);
    const uploadedFile = options.body.get('file');
    expect(uploadedFile).toBeInstanceOf(Blob);
    expect(uploadedFile.type).toBe('image/png');
    await expect(uploadedFile.text()).resolves.toBe('image-bytes');
  });

  it('does not expose server exception details through ApiError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'C:\\private\\db.sqlite failed at internal stack trace' }),
    });

    await expect(getCurrentUser({ fetchImpl })).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: expect.not.stringContaining('private'),
    });
  });
});

describe('quiz generation API client', () => {
  it('loads the authenticated provider and model catalog', async () => {
    const catalog = { providers: [{ id: 'gemini', name: 'Gemini', models: [{ id: 'gemini-2.5-flash-lite', name: 'Gemini Flash Lite' }] }] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => catalog });

    expect(apiClient.getQuizProviders).toBeTypeOf('function');
    await expect(apiClient.getQuizProviders({ fetchImpl })).resolves.toEqual(catalog);
    expect(fetchImpl).toHaveBeenCalledWith('/api/quizzes/providers', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('submits quiz generation as same-origin multipart data', async () => {
    const quiz = { id: 9, title: 'Network Basics', question_count: 5, questions: [] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => quiz });
    const formData = new FormData();
    formData.append('file', new Blob(['notes'], { type: 'text/markdown' }), 'notes.md');
    formData.append('provider', 'gemini');
    formData.append('model', 'gemini-2.5-flash-lite');
    formData.append('question_count', '5');

    expect(apiClient.generateQuiz).toBeTypeOf('function');
    await expect(apiClient.generateQuiz(formData, { fetchImpl })).resolves.toEqual(quiz);
    expect(fetchImpl).toHaveBeenCalledWith('/api/quizzes/generate', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    }));
    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
  });

  it('shows the selected provider quota message returned in a structured error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        detail: { code: 'provider_quota_full', provider: 'gemini', message: 'โควตาของ Gemini เต็มแล้ว กรุณาเลือก Provider อื่น' },
      }),
    });
    const formData = new FormData();

    expect(apiClient.generateQuiz).toBeTypeOf('function');
    await expect(apiClient.generateQuiz(formData, { fetchImpl })).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      message: 'โควตาของ Gemini เต็มแล้ว กรุณาเลือก Provider อื่น',
    });
  });
});

describe('quiz tag API client', () => {
  it('loads the authenticated tag catalog', async () => {
    const catalog = { tags: [{ id: 1, name: 'Mathematics', color: 'blue', parent_id: null, is_builtin: true }] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => catalog });

    expect(apiClient.listTags).toBeTypeOf('function');
    await expect(apiClient.listTags({ fetchImpl })).resolves.toEqual(catalog);
    expect(fetchImpl).toHaveBeenCalledWith('/api/tags', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('creates a flat tag with a same-origin JSON request', async () => {
    const tag = { id: 8, name: 'Sets', color: 'cyan', parent_id: null, is_builtin: false };
    const payload = { name: 'Sets', color: 'cyan' };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => tag });

    expect(apiClient.createTag).toBeTypeOf('function');
    await expect(apiClient.createTag(payload, { fetchImpl })).resolves.toEqual(tag);
    expect(fetchImpl).toHaveBeenCalledWith('/api/tags', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }));
  });

  it('replaces quiz tags with a same-origin JSON request', async () => {
    const item = { id: 42, title: 'Sets', tags: [{ id: 1, name: 'Mathematics' }] };
    const payload = { tag_ids: [1, 8] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => item });

    expect(apiClient.replaceQuizTags).toBeTypeOf('function');
    await expect(apiClient.replaceQuizTags(42, payload, { fetchImpl })).resolves.toEqual(item);
    expect(fetchImpl).toHaveBeenCalledWith('/api/quizzes/42/tags', expect.objectContaining({
      method: 'PUT',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }));
  });
});

describe('quiz library and attempt API client', () => {
  it('lists quizzes with URL-encoded pagination and same-origin credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });

    expect(apiClient.listQuizzes).toBeTypeOf('function');
    await expect(apiClient.listQuizzes({ limit: 12, offset: 24 }, { fetchImpl })).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledWith('/api/quizzes?limit=12&offset=24', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('searches quiz titles and tags and omits empty filters', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });

    await apiClient.listQuizzes({ limit: 5, offset: 2, q: '  sets & groups  ', tagId: 8 }, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      '/api/quizzes?limit=5&offset=2&q=sets+%26+groups&tag_id=8',
      expect.objectContaining({ credentials: 'same-origin' }),
    );

    await apiClient.listQuizzes({ q: '   ', tagId: null }, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/quizzes', expect.objectContaining({
      credentials: 'same-origin',
    }));
  });

  it('reads quiz details and attempt history using numeric resource paths', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 42 }) });

    expect(apiClient.getQuiz).toBeTypeOf('function');
    expect(apiClient.getQuizAttempts).toBeTypeOf('function');
    expect(apiClient.getQuizAttempt).toBeTypeOf('function');
    await apiClient.getQuiz(42, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/quizzes/42', expect.objectContaining({
      method: 'GET', credentials: 'same-origin',
    }));
    await apiClient.getQuizAttempts(42, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/quizzes/42/attempts', expect.objectContaining({
      method: 'GET', credentials: 'same-origin',
    }));
    await apiClient.getQuizAttempt(42, 7, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/quizzes/42/attempts/7', expect.objectContaining({
      method: 'GET', credentials: 'same-origin',
    }));
  });

  it('renames quizzes and submits attempts as same-origin JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 42 }) });
    const title = { title: 'Sets: an introduction' };
    const attempt = { answers: [{ question_id: 1, selected_choice_index: 2 }] };

    expect(apiClient.renameQuiz).toBeTypeOf('function');
    expect(apiClient.submitQuizAttempt).toBeTypeOf('function');
    await apiClient.renameQuiz(42, title, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/quizzes/42', expect.objectContaining({
      method: 'PATCH',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(title),
    }));
    await apiClient.submitQuizAttempt(42, attempt, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/quizzes/42/attempts', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(attempt),
    }));
  });

  it('deletes a quiz with a validated positive ID and same-origin request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 204 });

    expect(apiClient.deleteQuiz).toBeTypeOf('function');
    await expect(apiClient.deleteQuiz(42, { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith('/api/quizzes/42', expect.objectContaining({
      method: 'DELETE', credentials: 'same-origin',
    }));
    expect(() => apiClient.deleteQuiz(0, { fetchImpl })).toThrow(TypeError);
    expect(() => apiClient.deleteQuiz('../42', { fetchImpl })).toThrow(TypeError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe('document library API client', () => {
  it('lists documents with URL-encoded search, tag filters, and paging', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });

    expect(apiClient.listDocuments).toBeTypeOf('function');
    await apiClient.listDocuments(
      { limit: 12, offset: 24, q: '  sets & groups  ', tagId: 8 },
      { fetchImpl },
    );
    expect(fetchImpl).toHaveBeenLastCalledWith(
      '/api/documents?limit=12&offset=24&q=sets+%26+groups&tag_id=8',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('uploads multipart data without overriding its boundary and returns the PDF content as a Blob', async () => {
    const file = new Blob(['notes'], { type: 'text/markdown' });
    const formData = new FormData();
    formData.append('file', file, 'notes.md');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 5 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(['pdf'], { type: 'application/pdf' }) });

    await expect(apiClient.uploadDocument(formData, { fetchImpl })).resolves.toEqual({ id: 5 });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/documents', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    }));
    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');

    const pdf = await apiClient.getDocumentContent(5, { fetchImpl });
    expect(pdf).toBeInstanceOf(Blob);
    await expect(pdf.text()).resolves.toBe('pdf');
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/documents/5/content', expect.objectContaining({
      method: 'GET', credentials: 'same-origin',
    }));
  });

  it('returns a validated same-origin PDF download route without exposing a storage URL', () => {
    expect(apiClient.getDocumentDownloadUrl).toBeTypeOf('function');
    expect(apiClient.getDocumentDownloadUrl(5)).toBe('/api/documents/5/download');
    expect(() => apiClient.getDocumentDownloadUrl(0)).toThrow(TypeError);
    expect(() => apiClient.getDocumentDownloadUrl('../5')).toThrow(TypeError);
  });

  it('uses the expected routes and methods for document details and updates', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url, options = {}) => ({
      ok: true,
      status: options.method === 'DELETE' ? 204 : 200,
      json: async () => ({ id: 5 }),
    }));

    expect(apiClient.getDocument).toBeTypeOf('function');
    await apiClient.getDocument(5, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/documents/5', expect.objectContaining({ credentials: 'same-origin' }));
    await apiClient.getDocumentText(5, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/documents/5/text', expect.objectContaining({ credentials: 'same-origin' }));
    await apiClient.renameDocument(5, { title: 'Sets' }, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/documents/5', expect.objectContaining({ method: 'PATCH', body: '{"title":"Sets"}' }));
    await apiClient.replaceDocumentTags(5, { tag_ids: [1, 9] }, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/documents/5/tags', expect.objectContaining({ method: 'PUT' }));
    await apiClient.saveDocumentProgress(5, { page: 3 }, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/documents/5/progress', expect.objectContaining({ method: 'PUT' }));
    await expect(apiClient.deleteDocument(5, { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/documents/5', expect.objectContaining({ method: 'DELETE' }));
  });
});

describe('deadline planner API client', () => {
  const task = {
    id: 12,
    title: 'Review set theory',
    subject: 'คณิตศาสตร์',
    due_at: '2026-11-10T02:30:00Z',
    priority: 'medium',
    is_completed: false,
  };

  it('lists tasks using same-origin credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [task],
    });

    expect(apiClient.listDeadlines).toBeTypeOf('function');
    await expect(apiClient.listDeadlines({ fetchImpl })).resolves.toEqual([task]);
    expect(fetchImpl).toHaveBeenCalledWith('/api/deadlines', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('creates a task with a same-origin JSON request', async () => {
    const payload = { title: task.title, subject: task.subject, due_at: task.due_at, priority: task.priority };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => task });

    expect(apiClient.createDeadline).toBeTypeOf('function');
    await expect(apiClient.createDeadline(payload, { fetchImpl })).resolves.toEqual(task);
    expect(fetchImpl).toHaveBeenCalledWith('/api/deadlines', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }));
  });

  it('updates only the completion value with a same-origin JSON request', async () => {
    const payload = { is_completed: true };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...task, is_completed: true }),
    });

    expect(apiClient.updateDeadline).toBeTypeOf('function');
    await expect(apiClient.updateDeadline(task.id, payload, { fetchImpl }))
      .resolves.toMatchObject({ id: task.id, is_completed: true });
    expect(fetchImpl).toHaveBeenCalledWith('/api/deadlines/12', expect.objectContaining({
      method: 'PATCH',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }));
  });

  it('deletes a task and parses the empty 204 response as null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 204 });

    expect(apiClient.deleteDeadline).toBeTypeOf('function');
    await expect(apiClient.deleteDeadline(task.id, { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith('/api/deadlines/12', expect.objectContaining({
      method: 'DELETE',
      credentials: 'same-origin',
    }));
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe task IDs before calling fetch (%s)',
    (deadlineId) => {
      const fetchImpl = vi.fn();

      expect(() => apiClient.updateDeadline(deadlineId, { is_completed: true }, { fetchImpl }))
        .toThrow(TypeError);
      expect(() => apiClient.deleteDeadline(deadlineId, { fetchImpl })).toThrow(TypeError);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe('AI tutor API client', () => {
  const conversation = {
    id: 23,
    title: 'ทำไมเซตว่างเป็นสับเซตของทุกเซต',
    status: 'awaiting_clarification',
    provider_id: 'openai',
    model_id: 'gpt-5.6-luna-pro',
    created_at: '2026-10-12T09:00:00Z',
    updated_at: '2026-10-12T09:02:00Z',
    tags: [{ id: 1, name: 'คณิตศาสตร์', color: 'blue', parent_id: null, is_builtin: true }],
    messages: [{
      id: 1, sequence: 1, role: 'user', kind: 'question', content: 'อธิบายเซตว่าง',
      created_at: '2026-10-12T09:00:00Z',
    }],
  };

  it('searches tutor history by text and shared tag', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [conversation] });

    expect(apiClient.listTutorConversations).toBeTypeOf('function');
    await expect(apiClient.listTutorConversations({ q: '  เซต & ความสัมพันธ์ ', tagId: 8 }, { fetchImpl }))
      .resolves.toEqual([conversation]);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/tutor/conversations?q=%E0%B9%80%E0%B8%8B%E0%B8%95+%26+%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1%E0%B8%AA%E0%B8%B1%E0%B8%A1%E0%B8%9E%E0%B8%B1%E0%B8%99%E0%B8%98%E0%B9%8C&tag_id=8',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('loads the authenticated AI provider and model catalog', async () => {
    const catalog = {
      providers: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5.4-mini', name: 'gpt-5.4-mini', supports_images: false }] }],
      default_selection: { provider_id: 'openai', model_id: 'gpt-5.4-mini' },
    };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => catalog });

    expect(getAiProviders).toBeTypeOf('function');
    await expect(getAiProviders({ fetchImpl })).resolves.toEqual(catalog);
    expect(fetchImpl).toHaveBeenCalledWith('/api/ai/providers', expect.objectContaining({
      method: 'GET', credentials: 'same-origin',
    }));
  });

  it('creates a conversation and sends a follow-up with the request ID', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => conversation });
    const initial = { message: 'อธิบายเซตว่าง', tag_ids: [1], request_id: 'req-start-1' };
    const followup = { message: 'หมายถึงเซตว่างจริง ๆ', request_id: 'req-reply-2' };

    expect(apiClient.createTutorConversation).toBeTypeOf('function');
    expect(apiClient.sendTutorMessage).toBeTypeOf('function');
    await apiClient.createTutorConversation(initial, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/tutor/conversations', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify(initial),
    }));
    await apiClient.sendTutorMessage(23, followup, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/tutor/conversations/23/messages', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify(followup),
    }));
  });

  it('loads and retries a saved tutor conversation and exposes only safe retry metadata', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => conversation })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => conversation })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ detail: {
          code: 'tutor_provider_unavailable',
          message: 'บริการ AI ยังไม่พร้อม ข้อความของคุณถูกบันทึกแล้วและลองส่งใหม่ได้',
          conversation_id: 23,
          retryable: true,
          debug: 'private stack trace',
        } }),
      });

    expect(apiClient.getTutorConversation).toBeTypeOf('function');
    expect(apiClient.retryTutorMessage).toBeTypeOf('function');
    await apiClient.getTutorConversation(23, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/tutor/conversations/23', expect.objectContaining({ credentials: 'same-origin' }));
    await apiClient.retryTutorMessage(23, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/tutor/conversations/23/retry', expect.objectContaining({
      method: 'POST', credentials: 'same-origin',
    }));
    let error;
    try {
      await apiClient.retryTutorMessage(23, { fetchImpl });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      name: 'ApiError', status: 503, detail: {
        code: 'tutor_provider_unavailable', conversation_id: 23, retryable: true,
      },
    });
    expect(error.detail).not.toHaveProperty('debug');
  });

  it('sends an alternate provider/model when retrying a saved tutor response', async () => {
    const selection = { provider_id: 'openai', model_id: 'gpt-5.4-mini' };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => conversation });

    await apiClient.retryTutorMessage(23, selection, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith('/api/tutor/conversations/23/retry', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify(selection),
    }));
  });

  it('sends a response-language-only override when retrying a saved Tutor response', async () => {
    const language = { response_language: 'en' };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => conversation });

    await apiClient.retryTutorMessage(23, language, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith('/api/tutor/conversations/23/retry', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify(language),
    }));
  });

  it('sends new image turns as multipart without overriding the browser boundary', async () => {
    const formData = new FormData();
    formData.append('message', 'ช่วยดูภาพนี้');
    formData.append('provider_id', 'openai');
    formData.append('model_id', 'vision-test');
    formData.append('images', new Blob(['image-bytes'], { type: 'image/png' }), 'diagram.png');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => conversation });

    expect(apiClient.createTutorConversationWithImages).toBeTypeOf('function');
    expect(apiClient.sendTutorMessageWithImages).toBeTypeOf('function');
    await apiClient.createTutorConversationWithImages(formData, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/tutor/conversations/with-images', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: formData,
      headers: expect.not.objectContaining({ 'Content-Type': expect.anything() }),
    }));
    await apiClient.sendTutorMessageWithImages(23, formData, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith('/api/tutor/conversations/23/messages/with-images', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: formData,
      headers: expect.not.objectContaining({ 'Content-Type': expect.anything() }),
    }));
  });

  it('builds only same-origin attachment URLs and rejects unsafe path IDs', () => {
    expect(apiClient.getTutorAttachmentUrl(23, 91)).toBe('/api/tutor/conversations/23/attachments/91');
    expect(() => apiClient.getTutorAttachmentUrl('../23', 91)).toThrow(TypeError);
    expect(() => apiClient.getTutorAttachmentUrl(23, 0)).toThrow(TypeError);
  });
});

describe('learner progress API client', () => {
  it('searches progress by quiz title or shared tag with same-origin credentials', async () => {
    const overview = { topics_practiced: 0, latest_attempt: null, recent_attempts: [], topics: [] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => overview });

    expect(apiClient.getProgress).toBeTypeOf('function');
    await expect(apiClient.getProgress({ q: '  sets & functions ', tagId: 8 }, { fetchImpl }))
      .resolves.toEqual(overview);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/progress?q=sets+%26+functions&tag_id=8',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('loads selected-topic attempt history by numeric tag ID', async () => {
    const topic = { tag_id: 8, name: 'Sets', color: 'violet', parent_id: 1, attempts: [] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => topic });

    expect(apiClient.getProgressTopic).toBeTypeOf('function');
    await expect(apiClient.getProgressTopic(8, { fetchImpl })).resolves.toEqual(topic);
    expect(fetchImpl).toHaveBeenCalledWith('/api/progress/topics/8', expect.objectContaining({
      method: 'GET', credentials: 'same-origin',
    }));
  });
});
