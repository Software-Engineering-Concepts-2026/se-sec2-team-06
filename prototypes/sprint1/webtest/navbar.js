(() => {
  const navbarRoot = document.querySelector('[data-navbar-root]');

  if (!navbarRoot) return;

  const isQuizPage = navbarRoot.dataset.page === 'quiz';
  const registerPath = isQuizPage ? '../webtest/register.html' : 'register.html';
  const loginPath = isQuizPage ? '../webtest/login.html' : 'login.html';
  const registerHref = `${registerPath}?v=20260824-5`;
  const loginHref = `${loginPath}?v=20260824-5`;

  navbarRoot.innerHTML = `
    <header class="site-bar">
      <div class="site-bar__inner">
        <a class="site-brand" href="${loginHref}" aria-label="SynapseSync เข้าสู่ระบบ">
          <span class="site-brand__mark" aria-hidden="true"></span>
          <span class="site-brand__name">SynapseSync</span>
        </a>
        <div class="site-bar__tools">
          <span class="site-bar__status">Sprint 1 Prototype</span>
          <a class="site-bar__action" href="${registerHref}">เริ่มใหม่</a>
        </div>
      </div>
    </header>
  `;
})();
