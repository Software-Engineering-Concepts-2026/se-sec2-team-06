const configuredBasePath = import.meta.env?.VITE_API_BASE_PATH;
const defaultBasePath = configuredBasePath || '/api';

export class ApiError extends Error {
  constructor(status, message = 'ไม่สามารถเชื่อมต่อ API ได้') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
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
