import { AVATAR_CROP_VIEWPORT, calculateCropFrame, cropAvatarFile } from '../components/avatar-crop.js';

function createCropDialog({ file, cropImage, onUpload, onCancel, onMessage, avatarImage, avatarPlaceholder }) {
  const layer = document.createElement('div');
  layer.className = 'modal-layer';

  const dialog = document.createElement('section');
  dialog.className = 'avatar-crop-dialog glass-panel';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'avatar-crop-title');
  dialog.tabIndex = -1;
  dialog.innerHTML = `
    <header class="avatar-crop-dialog__header">
      <div>
        <p class="eyebrow">PROFILE PHOTO</p>
        <h2 id="avatar-crop-title">จัดตำแหน่งรูปโปรไฟล์</h2>
        <p>ลากภาพเพื่อจัดตำแหน่ง แล้วเลื่อนแถบเพื่อซูม</p>
        <small class="avatar-crop-requirements">รองรับ JPEG, PNG หรือ WebP · ไม่เกิน 5 MB</small>
      </div>
      <button class="icon-button" type="button" data-action="cancel-avatar-crop" aria-label="ยกเลิกการครอปรูป">×</button>
    </header>
    <div class="avatar-crop-dialog__body">
      <div class="avatar-crop-workspace">
        <div class="avatar-crop-viewport" data-avatar-crop-area aria-label="ลากภาพเพื่อเลือกส่วนที่ต้องการ">
          <img class="avatar-crop-image" alt="ภาพที่กำลังจัดตำแหน่ง" draggable="false" />
          <span class="avatar-crop-guide" aria-hidden="true"></span>
        </div>
        <label class="crop-zoom-label" for="avatar-zoom"><span>ซูมภาพ</span><output data-zoom-output>100%</output></label>
        <input id="avatar-zoom" type="range" min="1" max="3" step="0.01" value="1" aria-label="ระดับการซูมรูปโปรไฟล์" />
      </div>
      <aside class="avatar-crop-preview-panel">
        <span class="avatar-crop-preview-panel__label">ตัวอย่าง</span>
        <div class="avatar-crop-preview"><img class="avatar-crop-preview__image" alt="ตัวอย่างรูปโปรไฟล์" /></div>
        <small>รูปโปรไฟล์จะแสดงเป็นวงกลม</small>
      </aside>
    </div>
    <footer class="avatar-crop-dialog__actions">
      <button class="button button-secondary" type="button" data-action="cancel-avatar-crop">ยกเลิก</button>
      <button class="button button-primary" type="button" data-action="apply-avatar-crop">ใช้รูปนี้</button>
    </footer>
  `;
  layer.append(dialog);

  const sourceImage = dialog.querySelector('.avatar-crop-image');
  const previewImage = dialog.querySelector('.avatar-crop-preview__image');
  const cropArea = dialog.querySelector('[data-avatar-crop-area]');
  const zoomInput = dialog.querySelector('#avatar-zoom');
  const zoomOutput = dialog.querySelector('[data-zoom-output]');
  const applyButton = dialog.querySelector('[data-action="apply-avatar-crop"]');
  const sourceUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
  if (sourceUrl) {
    sourceImage.src = sourceUrl;
    previewImage.src = sourceUrl;
  }

  const crop = { zoom: 1, offsetX: 0, offsetY: 0, viewportSize: AVATAR_CROP_VIEWPORT };
  let dragPoint = null;
  let closed = false;

  function renderCrop() {
    const imageWidth = sourceImage.naturalWidth;
    const imageHeight = sourceImage.naturalHeight;
    if (!imageWidth || !imageHeight) return;
    crop.viewportSize = cropArea.getBoundingClientRect().width || AVATAR_CROP_VIEWPORT;
    const frame = calculateCropFrame({
      imageWidth,
      imageHeight,
      viewportSize: crop.viewportSize,
      ...crop,
    });
    Object.assign(sourceImage.style, {
      width: `${frame.width}px`,
      height: `${frame.height}px`,
      left: `${frame.left}px`,
      top: `${frame.top}px`,
    });

    const previewSize = 144;
    const previewFrame = calculateCropFrame({
      imageWidth,
      imageHeight,
      viewportSize: previewSize,
      zoom: crop.zoom,
      offsetX: crop.offsetX * previewSize / crop.viewportSize,
      offsetY: crop.offsetY * previewSize / crop.viewportSize,
    });
    Object.assign(previewImage.style, {
      width: `${previewFrame.width}px`,
      height: `${previewFrame.height}px`,
      left: `${previewFrame.left}px`,
      top: `${previewFrame.top}px`,
    });
  }

  function cleanup() {
    if (closed) return;
    closed = true;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    if (sourceUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(sourceUrl);
    layer.remove();
  }

  function onPointerMove(event) {
    if (!dragPoint) return;
    crop.offsetX += event.clientX - dragPoint.x;
    crop.offsetY += event.clientY - dragPoint.y;
    dragPoint = { x: event.clientX, y: event.clientY };
    renderCrop();
  }

  function onPointerUp() {
    dragPoint = null;
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  cropArea.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    dragPoint = { x: event.clientX, y: event.clientY };
  });
  sourceImage.addEventListener('load', renderCrop);
  zoomInput.addEventListener('input', () => {
    crop.zoom = Number(zoomInput.value);
    zoomOutput.value = `${Math.round(crop.zoom * 100)}%`;
    zoomOutput.textContent = zoomOutput.value;
    renderCrop();
  });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  layer.addEventListener('click', (event) => {
    if (event.target === layer) onCancel();
  });
  dialog.querySelectorAll('[data-action="cancel-avatar-crop"]').forEach((button) => {
    button.addEventListener('click', onCancel);
  });
  applyButton.addEventListener('click', async () => {
    applyButton.disabled = true;
    applyButton.textContent = 'กำลังเตรียมรูป…';
    try {
      const croppedFile = await cropImage(file, { ...crop });
      onMessage('กำลังอัปโหลดภาพ...', 'success');
      if (typeof URL.createObjectURL === 'function') {
        avatarImage.src = URL.createObjectURL(croppedFile);
        avatarImage.hidden = false;
        avatarPlaceholder.hidden = true;
      }
      await onUpload?.(croppedFile);
      onMessage('อัปเดตภาพโปรไฟล์แล้ว', 'success');
      cleanup();
    } catch (error) {
      applyButton.disabled = false;
      applyButton.textContent = 'ลองอีกครั้ง';
      onMessage(error?.message || 'เตรียมภาพไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
    }
  });

  return { layer, dialog, cleanup };
}

export function renderProfilePage({ user, onUpdate, onAvatarUpload, cropImage = cropAvatarFile } = {}) {
  const page = document.createElement('section');
  page.className = 'page profile-page';
  page.setAttribute('aria-labelledby', 'profile-title');

  const heading = document.createElement('div');
  heading.className = 'profile-page__heading';
  heading.innerHTML = `
    <p class="eyebrow">YOUR LEARNING PROFILE</p>
    <h1 id="profile-title">โปรไฟล์ของฉัน</h1>
    <p class="page-intro">พื้นที่เล็ก ๆ ที่ช่วยให้คุณจัดรูปแบบการเรียนรู้ของตัวเอง</p>
  `;

  const profileCard = document.createElement('section');
  profileCard.className = 'profile-hero-card glass-panel';
  profileCard.setAttribute('aria-label', 'ภาพรวมโปรไฟล์');
  const avatar = document.createElement('div');
  avatar.className = 'avatar-area';
  const image = document.createElement('img');
  image.id = 'avatar-preview';
  image.className = 'avatar-preview';
  image.alt = `ภาพโปรไฟล์ของ ${user?.display_name || 'ผู้ใช้'}`;
  image.hidden = !user?.avatar_url;
  if (user?.avatar_url) image.src = user.avatar_url;
  const avatarPlaceholder = document.createElement('span');
  avatarPlaceholder.className = 'avatar-placeholder';
  avatarPlaceholder.textContent = (user?.display_name || 'S').trim().charAt(0).toUpperCase() || 'S';
  avatarPlaceholder.hidden = Boolean(user?.avatar_url);
  avatar.append(image, avatarPlaceholder);

  const identity = document.createElement('div');
  identity.className = 'profile-identity';
  const name = document.createElement('h2');
  name.className = 'profile-name-preview';
  name.textContent = user?.display_name || 'ผู้เรียน';
  const email = document.createElement('p');
  email.className = 'profile-email-preview';
  email.textContent = user?.email || '';
  const bio = document.createElement('p');
  bio.className = 'profile-bio-preview';
  bio.textContent = user?.bio || 'เพิ่มคำแนะนำตัวสั้น ๆ ให้ผู้คนรู้จักคุณมากขึ้น';
  identity.append(name, email, bio);

  const avatarControls = document.createElement('div');
  avatarControls.className = 'avatar-controls';
  const avatarTrigger = document.createElement('button');
  avatarTrigger.className = 'avatar-upload-trigger';
  avatarTrigger.type = 'button';
  avatarTrigger.dataset.action = 'choose-avatar';
  avatarTrigger.setAttribute('aria-label', 'เปลี่ยนรูปโปรไฟล์');
  avatarTrigger.setAttribute('aria-controls', 'profile-avatar');
  avatarTrigger.title = 'เปลี่ยนรูปโปรไฟล์';
  avatarTrigger.textContent = '+';
  const avatarInput = document.createElement('input');
  avatarInput.id = 'profile-avatar';
  avatarInput.name = 'avatar';
  avatarInput.type = 'file';
  avatarInput.accept = 'image/jpeg,image/png,image/webp';
  avatarInput.setAttribute('aria-label', 'เลือกรูปโปรไฟล์');
  avatarInput.setAttribute('aria-describedby', 'avatar-hint avatar-message');
  avatarInput.className = 'visually-hidden';
  avatarInput.tabIndex = -1;
  avatarTrigger.addEventListener('click', () => avatarInput.click());
  avatar.append(avatarTrigger);
  const avatarHint = document.createElement('span');
  avatarHint.id = 'avatar-hint';
  avatarHint.className = 'visually-hidden';
  avatarHint.textContent = 'JPEG, PNG หรือ WebP · ไม่เกิน 5 MB';
  const avatarMessage = document.createElement('p');
  avatarMessage.id = 'avatar-message';
  avatarMessage.className = 'form-message';
  avatarMessage.setAttribute('role', 'status');
  avatarMessage.setAttribute('aria-live', 'polite');
  avatarControls.append(avatarInput, avatarHint, avatarMessage);
  profileCard.append(avatar, identity, avatarControls);

  const editCard = document.createElement('section');
  editCard.className = 'profile-card profile-edit-card glass-panel';
  editCard.innerHTML = `
    <header class="profile-section-heading">
      <span class="profile-section-heading__icon" aria-hidden="true">✦</span>
      <div><h2>ข้อมูลของฉัน</h2><p>เพิ่มรายละเอียดและเป้าหมายที่อยากไปให้ถึง</p></div>
    </header>
  `;
  const form = document.createElement('form');
  form.className = 'profile-form';
  form.noValidate = true;
  form.innerHTML = `
    <div class="profile-fields-grid">
      <div class="field">
        <label for="profile-name">ชื่อที่ใช้แสดง</label>
        <input id="profile-name" name="display_name" type="text" maxlength="80" required />
      </div>
      <div class="field">
        <label for="profile-email">อีเมล</label>
        <input id="profile-email" name="email" type="email" readonly />
      </div>
    </div>
    <div class="field">
      <label for="profile-bio">แนะนำตัว</label>
      <textarea id="profile-bio" name="bio" rows="3" maxlength="500" placeholder="เล่าเกี่ยวกับตัวคุณสั้น ๆ"></textarea>
      <small>ไม่เกิน 500 ตัวอักษร</small>
    </div>
    <div class="profile-learning-block">
      <div class="profile-section-heading profile-section-heading--compact">
        <span class="profile-section-heading__icon" aria-hidden="true">◎</span>
        <div><h3>Learning profile</h3><p>เลือกสิ่งที่อยากโฟกัสในช่วงนี้</p></div>
      </div>
      <div class="field">
        <label for="profile-learning-goal">เป้าหมายการเรียน</label>
        <textarea id="profile-learning-goal" name="learning_goal" rows="2" maxlength="200" placeholder="เช่น ฝึกเขียนโปรแกรมให้สม่ำเสมอ"></textarea>
        <small>ไม่เกิน 200 ตัวอักษร</small>
      </div>
      <div class="field">
        <label for="profile-learning-topics">หัวข้อที่สนใจ</label>
        <input id="profile-learning-topics" name="learning_topics" type="text" maxlength="420" placeholder="เช่น Programming, Design, English" />
        <small>คั่นแต่ละหัวข้อด้วยจุลภาค · สูงสุด 10 หัวข้อ</small>
      </div>
    </div>
    <p class="form-message" data-profile-message role="status" aria-live="polite"></p>
    <button class="button button-primary profile-save-button" type="submit">บันทึกโปรไฟล์</button>
  `;
  form.elements.display_name.value = user?.display_name || '';
  form.elements.email.value = user?.email || '';
  form.elements.bio.value = user?.bio || '';
  form.elements.learning_goal.value = user?.learning_goal || '';
  form.elements.learning_topics.value = Array.isArray(user?.learning_topics) ? user.learning_topics.join(', ') : '';

  const formMessage = form.querySelector('[data-profile-message]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayName = form.elements.display_name.value.trim();
    const topics = [...new Set(form.elements.learning_topics.value.split(',').map((topic) => topic.trim()).filter(Boolean))];
    if (!displayName) {
      formMessage.dataset.state = 'error';
      formMessage.textContent = 'กรุณากรอกชื่อที่ใช้แสดง';
      return;
    }
    if (topics.length > 10 || topics.some((topic) => topic.length > 40)) {
      formMessage.dataset.state = 'error';
      formMessage.textContent = 'ใส่หัวข้อได้ไม่เกิน 10 หัวข้อ และแต่ละหัวข้อไม่เกิน 40 ตัวอักษร';
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    formMessage.textContent = '';
    try {
      await onUpdate?.({
        display_name: displayName,
        bio: form.elements.bio.value,
        learning_goal: form.elements.learning_goal.value.trim() || null,
        learning_topics: topics,
      });
      formMessage.dataset.state = 'success';
      formMessage.textContent = 'บันทึกโปรไฟล์แล้ว';
    } catch (error) {
      formMessage.dataset.state = 'error';
      formMessage.textContent = error?.message || 'บันทึกโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง';
    } finally {
      submitButton.disabled = false;
    }
  });

  let activeDialog = null;
  const closeCropDialog = () => {
    activeDialog?.cleanup();
    activeDialog = null;
    avatarInput.value = '';
    avatarTrigger.focus();
  };
  const setAvatarMessage = (messageText, state) => {
    avatarMessage.dataset.state = state;
    avatarMessage.textContent = messageText;
  };

  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarMessage('กรุณาเลือกภาพ JPEG, PNG หรือ WebP', 'error');
      avatarInput.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage('ภาพโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB', 'error');
      avatarInput.value = '';
      return;
    }

    activeDialog?.cleanup();
    activeDialog = createCropDialog({
      file,
      cropImage,
      onUpload: onAvatarUpload,
      onCancel: closeCropDialog,
      onMessage: setAvatarMessage,
      avatarImage: image,
      avatarPlaceholder,
    });
    page.append(activeDialog.layer);
    activeDialog.dialog.focus();
  });

  editCard.append(form);
  page.append(heading, profileCard, editCard);
  return page;
}
