const PUBLIC_ROUTES = new Map([
  ['/', 'home'],
  ['/login', 'login'],
  ['/register', 'register'],
]);

export function markRoutePage(page, routeUrl, previousRouteUrl, reducedMotion = false) {
  if (!page?.classList) return previousRouteUrl ?? null;

  page.classList.toggle('page-enter', typeof routeUrl === 'string' && routeUrl !== previousRouteUrl);
  page.style.animationDuration = reducedMotion ? '0ms' : '';
  page.style.transitionDuration = reducedMotion ? '0ms' : '';
  return typeof routeUrl === 'string' ? routeUrl : previousRouteUrl ?? null;
}

export function applyTutorAppMode(appRoot, isTutor) {
  if (!appRoot?.classList) return;
  appRoot.classList.toggle('app--tutor', Boolean(isTutor));
}

function normalizePath(pathname) {
  const path = typeof pathname === 'string' && pathname.startsWith('/') ? pathname : '/';
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}

function safeReturnTo(search) {
  const candidate = new URLSearchParams(search).get('next');
  if (candidate === '/quizzes/create' || candidate === '/quizzes' || candidate === '/deadlines' || candidate === '/tutor' || candidate === '/progress') return candidate;
  return matchQuizRoute(candidate) || matchDocumentRoute(candidate) ? candidate : null;
}

function matchDocumentRoute(path) {
  if (path === '/documents') return { page: 'documents-library', params: {} };
  const match = path?.match(/^\/documents\/([1-9]\d*)$/);
  if (!match) return null;
  const documentId = Number(match[1]);
  return Number.isSafeInteger(documentId)
    ? { page: 'document-reader', params: { documentId } }
    : null;
}

function matchQuizRoute(path) {
  if (path === '/quizzes') return { page: 'quiz-library', params: {} };

  let match = path?.match(/^\/quizzes\/([1-9]\d*)$/);
  if (match) {
    const quizId = Number(match[1]);
    return Number.isSafeInteger(quizId) ? { page: 'quiz-detail', params: { quizId } } : null;
  }

  match = path?.match(/^\/quizzes\/([1-9]\d*)\/take$/);
  if (match) {
    const quizId = Number(match[1]);
    return Number.isSafeInteger(quizId) ? { page: 'quiz-take', params: { quizId } } : null;
  }

  match = path?.match(/^\/quizzes\/([1-9]\d*)\/attempts\/([1-9]\d*)$/);
  if (match) {
    const quizId = Number(match[1]);
    const attemptId = Number(match[2]);
    return Number.isSafeInteger(quizId) && Number.isSafeInteger(attemptId)
      ? { page: 'quiz-attempt-review', params: { quizId, attemptId } }
      : null;
  }

  return null;
}

export function resolveRoute(pathname, user, search = '') {
  const normalizedPath = normalizePath(pathname);

  if (normalizedPath === '/deadlines') {
    return user
      ? { path: normalizedPath, page: 'deadlines' }
      : { path: '/login', page: 'login', returnTo: normalizedPath };
  }

  if (normalizedPath === '/tutor') {
    return user
      ? { path: normalizedPath, page: 'tutor' }
      : { path: '/login', page: 'login', returnTo: normalizedPath };
  }

  if (normalizedPath === '/progress') {
    return user
      ? { path: normalizedPath, page: 'progress' }
      : { path: '/login', page: 'login', returnTo: normalizedPath };
  }

  if (normalizedPath === '/profile') {
    return user ? { path: normalizedPath, page: 'profile' } : { path: '/login', page: 'login' };
  }

  if (normalizedPath === '/quizzes/create') {
    return user
      ? { path: normalizedPath, page: 'quiz-create' }
      : { path: '/login', page: 'login', returnTo: normalizedPath };
  }

  const documentRoute = matchDocumentRoute(normalizedPath);
  if (documentRoute) {
    return user
      ? { path: normalizedPath, ...documentRoute }
      : { path: '/login', page: 'login', returnTo: normalizedPath };
  }

  const quizRoute = matchQuizRoute(normalizedPath);
  if (quizRoute) {
    return user
      ? { path: normalizedPath, ...quizRoute }
      : { path: '/login', page: 'login', returnTo: normalizedPath };
  }

  if (!PUBLIC_ROUTES.has(normalizedPath)) return { path: '/', page: 'home' };

  const route = { path: normalizedPath, page: PUBLIC_ROUTES.get(normalizedPath) };
  const returnTo = ['login', 'register'].includes(route.page) ? safeReturnTo(search) : null;
  return returnTo ? { ...route, returnTo } : route;
}
