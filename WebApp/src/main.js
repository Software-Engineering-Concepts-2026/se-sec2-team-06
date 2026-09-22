import './styles.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="shell">
    <header class="hero" aria-labelledby="page-title">
      <div class="brand-mark" aria-hidden="true">S</div>
      <div>
        <p class="eyebrow">STUDY SMARTER</p>
        <h1 id="page-title">SynapseSync WebApp</h1>
        <p class="lede">พื้นที่ใหม่สำหรับวางแผนการเรียนรู้และทบทวนเนื้อหาอย่างเป็นระบบ</p>
      </div>
    </header>

    <section class="status-card" aria-labelledby="connection-title">
      <div class="status-heading">
        <span class="status-dot" aria-hidden="true"></span>
        <h2 id="connection-title">สถานะการเชื่อมต่อ</h2>
      </div>
      <p id="api-status" role="status" aria-live="polite">กำลังเตรียมการเชื่อมต่อ API</p>
      <button id="check-api" type="button">ตรวจสอบ API</button>
    </section>

    <section class="feature-grid" aria-label="ขอบเขตเริ่มต้นของ WebApp">
      <article class="feature-card">
        <span class="feature-icon" aria-hidden="true">01</span>
        <h2>เริ่มจากโครงสร้างที่ชัดเจน</h2>
        <p>WebApp ชุดใหม่นี้แยกจาก prototype เดิม เพื่อให้พัฒนาต่อและทดสอบได้อย่างปลอดภัย</p>
      </article>
      <article class="feature-card">
        <span class="feature-icon" aria-hidden="true">02</span>
        <h2>เชื่อมต่อผ่าน API boundary</h2>
        <p>เบราว์เซอร์เรียกใช้ backend ผ่านเส้นทางเดียว โดยไม่เปิดเผยคีย์หรือข้อมูลลับ</p>
      </article>
    </section>

    <footer>SynapseSync · WebApp scaffold 0.1.0</footer>
  </div>
`;

document.querySelector('#check-api').addEventListener('click', () => {
  document.querySelector('#api-status').textContent = 'กำลังเตรียมการเชื่อมต่อ API';
});
