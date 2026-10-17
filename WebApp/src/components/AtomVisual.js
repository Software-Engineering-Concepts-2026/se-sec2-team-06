export function createAtomVisual() {
  const visual = document.createElement('div');
  visual.className = 'home-hero__visual';
  visual.setAttribute('aria-hidden', 'true');
  visual.innerHTML = `
    <div class="atom-stage">
      <span class="atom-halo atom-halo--outer"></span>
      <span class="atom-halo atom-halo--inner"></span>
      <span class="atom-orbit atom-orbit--one"><i class="atom-electron atom-electron--one"></i></span>
      <span class="atom-orbit atom-orbit--two"><i class="atom-electron atom-electron--two"></i></span>
      <span class="atom-orbit atom-orbit--three"><i class="atom-electron atom-electron--three"></i></span>
      <span class="atom-core"><span class="atom-core__mark">S</span></span>
    </div>
    <div class="home-glass-card home-glass-card--focus">
      <span class="glass-card__icon">✦</span>
      <div><p>LEARNING SPACE</p><strong>เรียนรู้ในแบบคุณ</strong></div>
    </div>
    <div class="home-glass-card home-glass-card--plan">
      <span class="glass-card__dot"></span>
      <div><p>YOUR NEXT STEP</p><strong>วางแผน · ทบทวน · เติบโต</strong></div>
    </div>
  `;
  return visual;
}
