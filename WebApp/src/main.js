import './styles.css';
import {
  login,
  getQuiz,
  getQuizAttempts,
  listQuizzes,
  deleteQuiz,
  logout,
  renameQuiz,
  register,
  getQuizAttempt,
  listDocuments,
  getDocument,
  getDocumentContent,
  getDocumentText,
  saveDocumentProgress,
  submitQuizAttempt,
  updateProfile,
  uploadAvatar,
  uploadDocument,
  listTags,
  createTag,
  renameDocument,
  replaceDocumentTags,
  deleteDocument,
  listDeadlines,
  createDeadline,
  updateDeadline,
  deleteDeadline,
  listTutorConversations,
  getTutorConversation,
  createTutorConversation,
  sendTutorMessage,
  retryTutorMessage,
  getAiProviders,
  getProgress,
  getProgressTopic,
  getDashboardOverview,
} from './api/client.js';
import { getSessionUser, loadSession } from './auth/session.js';
import { renderNavbar } from './components/Navbar.js';
import { renderHomePage } from './pages/HomePage.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { renderProfilePage } from './pages/ProfilePage.js';
import { renderQuizCreatePage } from './pages/QuizCreatePage.js';
import { renderQuizAttemptReviewPage } from './pages/QuizAttemptReviewPage.js';
import { renderQuizDetailPage } from './pages/QuizDetailPage.js';
import { renderQuizLibraryPage } from './pages/QuizLibraryPage.js';
import { renderQuizTakePage } from './pages/QuizTakePage.js';
import { renderDocumentsPage } from './pages/DocumentsPage.js';
import { renderDocumentReaderPage } from './pages/DocumentReaderPage.js';
import { renderDeadlinesPage } from './pages/DeadlinesPage.js';
import { renderTutorPage } from './pages/TutorPage.js';
import { renderProgressPage } from './pages/ProgressPage.js';
import { renderRegisterPage } from './pages/RegisterPage.js';
import { applyTutorAppMode, markRoutePage, resolveRoute } from './router.js';
import { initializeTheme, setTheme } from './theme/theme-manager.js';

const app = document.querySelector('#app');
let user = null;
let currentTheme = initializeTheme();
let currentPage = null;
let activeRouteUrl = null;
const navigationMotion = { activeTabId: null };

function navigate(path, replace = false) {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  render();
}

async function handleLogout() {
  try {
    await logout();
    user = await loadSession();
    navigate('/');
  } catch {
    const message = app.querySelector('[data-app-message]');
    if (message) message.textContent = 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง';
  }
}

function render() {
  if (!app) return;
  if (currentPage) {
    void currentPage.destroy?.();
    currentPage = null;
  }

  const route = resolveRoute(window.location.pathname, user, window.location.search);
  applyTutorAppMode(app, route.page === 'tutor');
  const routeUrl = route.returnTo
    ? `${route.path}?next=${encodeURIComponent(route.returnTo)}`
    : route.path;
  if (routeUrl !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState({}, '', routeUrl);
  }
  const navigateWithReturnTo = (path) => navigate(
    route.returnTo ? `${path}?next=${encodeURIComponent(route.returnTo)}` : path,
  );

  const navbar = renderNavbar(user, {
    navigate,
    currentPath: route.path,
    onLogout: handleLogout,
    themeId: currentTheme,
    loadDeadlines: listDeadlines,
    navigationMotion,
    onThemeChange: (themeId) => {
      currentTheme = setTheme(themeId);
    },
  });
  let page;
  if (route.page === 'login') {
    page = renderLoginPage({
      onNavigate: navigateWithReturnTo,
      onLogin: async (credentials) => {
        await login(credentials);
        user = await loadSession();
        if (!user) throw new Error('เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
        navigate(route.returnTo || '/');
      },
    });
  } else if (route.page === 'register') {
    page = renderRegisterPage({
      onNavigate: navigateWithReturnTo,
      onRegister: async (details) => {
        await register(details);
        user = await loadSession();
        if (!user) throw new Error('สร้างบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง');
        navigate(route.returnTo || '/');
      },
    });
  } else if (route.page === 'profile') {
    page = renderProfilePage({
      user,
      onUpdate: async (details) => {
        await updateProfile(details);
        user = await loadSession();
        render();
      },
      onAvatarUpload: async (file) => {
        await uploadAvatar(file);
        user = await loadSession();
        render();
      },
    });
  } else if (route.page === 'quiz-create') {
    page = renderQuizCreatePage({ navigate });
  } else if (route.page === 'quiz-library') {
    page = renderQuizLibraryPage({ loadQuizzes: listQuizzes, updateTitle: renameQuiz, deleteQuiz, navigate });
  } else if (route.page === 'quiz-detail') {
    page = renderQuizDetailPage({
      quizId: route.params.quizId,
      loadQuiz: getQuiz,
      loadAttempts: getQuizAttempts,
      navigate,
    });
  } else if (route.page === 'quiz-take') {
    page = renderQuizTakePage({
      quizId: route.params.quizId,
      loadQuiz: getQuiz,
      submitAttempt: submitQuizAttempt,
      navigate,
    });
  } else if (route.page === 'quiz-attempt-review') {
    page = renderQuizAttemptReviewPage({
      quizId: route.params.quizId,
      attemptId: route.params.attemptId,
      loadReview: getQuizAttempt,
      navigate,
    });
  } else if (route.page === 'documents-library') {
    page = renderDocumentsPage({
      loadDocuments: listDocuments,
      loadTags: listTags,
      uploadDocument,
      createTag,
      renameDocument,
      replaceDocumentTags,
      deleteDocument,
      navigate,
    });
  } else if (route.page === 'document-reader') {
    page = renderDocumentReaderPage({
      documentId: route.params.documentId,
      loadDocument: getDocument,
      loadDocumentContent: getDocumentContent,
      loadDocumentText: getDocumentText,
      saveProgress: saveDocumentProgress,
      updateTitle: renameDocument,
      loadTags: listTags,
      createTag,
      replaceDocumentTags,
      deleteDocument,
      navigate,
    });
  } else if (route.page === 'deadlines') {
    page = renderDeadlinesPage({
      loadDeadlines: listDeadlines,
      loadTags: listTags,
      createDeadline,
      updateDeadline,
      deleteDeadline,
      onDeadlineCreated: (task) => navbar.refreshNotifications({ assignedTask: task }),
    });
  } else if (route.page === 'tutor') {
    page = renderTutorPage({
      loadConversations: listTutorConversations,
      loadConversation: getTutorConversation,
      createConversation: createTutorConversation,
      sendMessage: sendTutorMessage,
      retryMessage: retryTutorMessage,
      loadProviders: getAiProviders,
      loadTags: listTags,
      navigate,
    });
  } else if (route.page === 'progress') {
    page = renderProgressPage({
      loadProgress: getProgress,
      loadTopic: getProgressTopic,
      loadTags: listTags,
      navigate,
    });
  } else {
    page = renderHomePage({
      user,
      onNavigate: navigate,
      loadOverview: getDashboardOverview,
      loadDeadlines: listDeadlines,
      loadTags: listTags,
      loadProgress: getProgress,
      loadQuizzes: listQuizzes,
      loadDocuments: listDocuments,
    });
  }

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.textContent = 'SynapseSync · พื้นที่เรียนรู้ของคุณ';
  const appMessage = document.createElement('p');
  appMessage.className = 'app-message';
  appMessage.dataset.appMessage = 'true';
  appMessage.setAttribute('role', 'status');
  appMessage.setAttribute('aria-live', 'polite');

  const mainContent = document.createElement('main');
  activeRouteUrl = markRoutePage(
    page,
    routeUrl,
    activeRouteUrl,
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  mainContent.append(page, appMessage);
  app.replaceChildren(navbar, mainContent, footer);
  currentPage = page;
}

window.addEventListener('popstate', render);
loadSession()
  .then(() => {
    user = getSessionUser();
    render();
  })
  .catch(() => {
    user = null;
    render();
  });
