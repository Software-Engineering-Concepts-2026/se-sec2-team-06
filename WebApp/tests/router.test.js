// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { renderNavbar } from '../src/components/Navbar.js';
import { resolveRoute } from '../src/router.js';
import * as router from '../src/router.js';

describe('resolveRoute', () => {
  it('applies Tutor-only app chrome without leaking that mode to another route', () => {
    const app = document.createElement('div');
    expect(router.applyTutorAppMode).toBeTypeOf('function');

    router.applyTutorAppMode(app, true);
    expect(app.classList.contains('app--tutor')).toBe(true);

    router.applyTutorAppMode(app, false);
    expect(app.classList.contains('app--tutor')).toBe(false);
  });

  it('test_route_page_gets_one_entry_marker', () => {
    expect(router.markRoutePage).toBeTypeOf('function');
    const app = document.createElement('main');
    const first = document.createElement('section');
    app.replaceChildren(first);
    let activeRoute = router.markRoutePage(first, '/quizzes', null, false);
    expect(app.querySelectorAll('.page-enter')).toHaveLength(1);

    const second = document.createElement('section');
    app.replaceChildren(second);
    activeRoute = router.markRoutePage(second, '/documents', activeRoute, false);
    expect(app.querySelectorAll('.page-enter')).toHaveLength(1);

    const rerender = document.createElement('section');
    app.replaceChildren(rerender);
    router.markRoutePage(rerender, '/documents', activeRoute, false);
    expect(app.querySelectorAll('.page-enter')).toHaveLength(0);
  });

  it('test_page_entry_animation_respects_reduced_motion', () => {
    expect(router.markRoutePage).toBeTypeOf('function');
    const page = document.createElement('section');
    router.markRoutePage(page, '/login', null, true);

    expect(page.classList.contains('page-enter')).toBe(true);
    expect(page.style.animationDuration).toBe('0ms');
    expect(page.style.transitionDuration).toBe('0ms');
  });

  it.each([
    ['/', 'home'],
    ['/login', 'login'],
    ['/register', 'register'],
  ])('maps public path %s to %s', (path, page) => {
    expect(resolveRoute(path, null)).toEqual({ path, page });
  });

  it('redirects signed-out users away from the profile', () => {
    expect(resolveRoute('/profile', null)).toEqual({ path: '/login', page: 'login' });
  });

  it('allows a signed-in user to open the profile', () => {
    expect(resolveRoute('/profile', { id: 4 })).toEqual({ path: '/profile', page: 'profile' });
  });

  it('redirects signed-out users from quiz creation to login and remembers the destination', () => {
    expect(resolveRoute('/quizzes/create', null)).toEqual({
      path: '/login',
      page: 'login',
      returnTo: '/quizzes/create',
    });
  });

  it('allows signed-in users to open quiz creation', () => {
    expect(resolveRoute('/quizzes/create', { id: 4 })).toEqual({
      path: '/quizzes/create',
      page: 'quiz-create',
    });
  });

  it('allows only signed-in users to open the deadline planner', () => {
    expect(resolveRoute('/deadlines', { id: 4 })).toEqual({
      path: '/deadlines',
      page: 'deadlines',
    });
    expect(resolveRoute('/deadlines', null)).toEqual({
      path: '/login',
      page: 'login',
      returnTo: '/deadlines',
    });
  });

  it('requires login for the tutor page and preserves its return path', () => {
    expect(resolveRoute('/tutor', null)).toEqual({
      path: '/login',
      page: 'login',
      returnTo: '/tutor',
    });
    expect(resolveRoute('/tutor', { id: 4 })).toEqual({ path: '/tutor', page: 'tutor' });
    expect(resolveRoute('/login', null, '?next=%2Ftutor')).toEqual({
      path: '/login',
      page: 'login',
      returnTo: '/tutor',
    });
  });

  it('requires login for Progress and preserves the selected destination', () => {
    expect(resolveRoute('/progress', null)).toEqual({
      path: '/login',
      page: 'login',
      returnTo: '/progress',
    });
    expect(resolveRoute('/progress', { id: 4 })).toEqual({ path: '/progress', page: 'progress' });
    expect(resolveRoute('/login', null, '?next=%2Fprogress')).toEqual({
      path: '/login',
      page: 'login',
      returnTo: '/progress',
    });
  });

  it('preserves a safe deadline-planner destination through login', () => {
    expect(resolveRoute('/login', null, '?next=%2Fdeadlines')).toEqual({
      path: '/login',
      page: 'login',
      returnTo: '/deadlines',
    });
    expect(resolveRoute('/login', null, '?next=%2Fdeadlines%2F..%2Fprofile')).toEqual({
      path: '/login',
      page: 'login',
    });
  });

  it('preserves only a local quiz-creation destination through login', () => {
    expect(resolveRoute('/login', null, '?next=%2Fquizzes%2Fcreate')).toEqual({
      path: '/login',
      page: 'login',
      returnTo: '/quizzes/create',
    });
    expect(resolveRoute('/login', null, '?next=https%3A%2F%2Fevil.example')).toEqual({
      path: '/login',
      page: 'login',
    });
  });

  it.each([
    ['/quizzes', 'quiz-library', {}],
    ['/quizzes/12', 'quiz-detail', { quizId: 12 }],
    ['/quizzes/12/take', 'quiz-take', { quizId: 12 }],
    ['/quizzes/12/attempts/4', 'quiz-attempt-review', { quizId: 12, attemptId: 4 }],
  ])('maps signed-in quiz route %s to %s with numeric IDs', (path, page, params) => {
    expect(resolveRoute(path, { id: 4 })).toEqual({ path, page, params });
  });

  it.each([
    '/quizzes',
    '/quizzes/12',
    '/quizzes/12/take',
    '/quizzes/12/attempts/4',
  ])('redirects signed-out quiz route %s to login and remembers it', (path) => {
    expect(resolveRoute(path, null)).toEqual({
      path: '/login',
      page: 'login',
      returnTo: path,
    });
  });

  it.each([
    '?next=https%3A%2F%2Fevil.example',
    '?next=%2F%2Fevil.example',
    '?next=%2Fquizzes%2Fabc',
    '?next=%2Fquizzes%2F0',
    '?next=%2Fquizzes%2F12%2Fattempts%2Fnope',
    '?next=%2Fprofile',
  ])('does not preserve unsafe or malformed quiz destination %s', (search) => {
    expect(resolveRoute('/login', null, search)).toEqual({ path: '/login', page: 'login' });
  });

  it.each([
    ['/documents', 'documents-library', {}],
    ['/documents/12', 'document-reader', { documentId: 12 }],
  ])('maps signed-in document route %s to %s', (path, page, params) => {
    expect(resolveRoute(path, { id: 4 })).toEqual({ path, page, params });
  });

  it.each(['/documents', '/documents/12'])('redirects signed-out document route %s and remembers it', (path) => {
    expect(resolveRoute(path, null)).toEqual({
      path: '/login',
      page: 'login',
      returnTo: path,
    });
  });

  it.each([
    '?next=%2Fdocuments',
    '?next=%2Fdocuments%2F12',
  ])('preserves a safe document destination through login: %s', (search) => {
    const returnTo = new URLSearchParams(search).get('next');
    expect(resolveRoute('/login', null, search)).toEqual({
      path: '/login',
      page: 'login',
      returnTo,
    });
  });

  it.each([
    '?next=https%3A%2F%2Fevil.example',
    '?next=%2Fdocuments%2F0',
    '?next=%2Fdocuments%2F001',
    '?next=%2Fdocuments%2F12%2F..%2Fprofile',
  ])('does not preserve an unsafe document destination: %s', (search) => {
    expect(resolveRoute('/login', null, search)).toEqual({ path: '/login', page: 'login' });
  });

  it('shows the document-library link only to signed-in users', () => {
    const signedOut = renderNavbar(null);
    const signedIn = renderNavbar({ id: 4, display_name: 'Learner' });

    expect(signedOut.querySelector('a[href="/documents"]')).toBeNull();
    expect(signedIn.querySelector('a[href="/documents"]')?.textContent).toBe('คลังเอกสาร');
  });

  it('shows the tutor link only to signed-in users', () => {
    const signedOut = renderNavbar(null);
    const signedIn = renderNavbar({ id: 4, display_name: 'Learner' });

    expect(signedOut.querySelector('a[href="/tutor"]')).toBeNull();
    expect(signedIn.querySelector('a[href="/tutor"]')?.textContent).toBe('AI ติวเตอร์');
  });

  it('shows the Progress link only to signed-in users', () => {
    const signedOut = renderNavbar(null);
    const signedIn = renderNavbar({ id: 4, display_name: 'Learner' });

    expect(signedOut.querySelector('a[href="/progress"]')).toBeNull();
    expect(signedIn.querySelector('a[href="/progress"]')?.textContent).toBe('ความก้าวหน้า');
  });

  it('normalizes trailing slashes and unknown routes to Home', () => {
    expect(resolveRoute('/register/', null)).toEqual({ path: '/register', page: 'register' });
    expect(resolveRoute('/missing', null)).toEqual({ path: '/', page: 'home' });
  });
});
