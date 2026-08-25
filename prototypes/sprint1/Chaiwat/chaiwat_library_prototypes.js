(() => {
  /* ---------- State ---------- */
  // In-memory only for this prototype — files reset if the page reloads.
  // In production this would sync with a real backend/storage.
  let documents = []; // { id, name, type, subject, url, fileObj }
  let activeSubject = 'all';
  let pendingFiles = []; // queue of files waiting for subject assignment

  /* ---------- Elements ---------- */
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const dropzoneBtn = document.getElementById('dropzoneBtn');
  const docGrid = document.getElementById('docGrid');
  const gridEmpty = document.getElementById('gridEmpty');
  const subjectFilter = document.getElementById('subjectFilter');
  const toastEl = document.getElementById('toast');

  const subjectModal = document.getElementById('subjectModal');
  const modalFileName = document.getElementById('modalFileName');
  const modalSubjectOptions = document.getElementById('modalSubjectOptions');
  const customSubjectInput = document.getElementById('customSubjectInput');
  const customSubjectConfirm = document.getElementById('customSubjectConfirm');

  const deleteModal = document.getElementById('deleteModal');
  const deleteFileName = document.getElementById('deleteFileName');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  let pendingDeleteId = null;

  /* ---------- Helpers ---------- */
  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function iconFor(file){
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return '📕';
    if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) return '📄';
    if (file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) return '📊';
    return '📁';
  }

  function uid(){ return 'doc_' + Math.random().toString(36).slice(2, 10); }

  /* ---------- Upload entry points ---------- */
  dropzoneBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => queueFiles(Array.from(e.target.files)));

  ['dragover', 'dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
  });
  dropzone.addEventListener('dragover', () => dropzone.classList.add('drag-over'));
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    dropzone.classList.remove('drag-over');
    queueFiles(Array.from(e.dataTransfer.files));
  });

  function queueFiles(files){
    if (!files.length) return;
    pendingFiles = files;
    askSubjectFor(pendingFiles[0]);
  }

  /* ---------- Subject-assign modal ---------- */
  function askSubjectFor(file){
    modalFileName.textContent = file.name;
    customSubjectInput.value = '';
    subjectModal.hidden = false;
  }

  function closeSubjectModal(){
    subjectModal.hidden = true;
  }

  modalSubjectOptions.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => assignSubjectAndAdd(btn.dataset.subject));
  });
  customSubjectConfirm.addEventListener('click', () => {
    const val = customSubjectInput.value.trim();
    if (!val) { showToast('พิมพ์ชื่อวิชาก่อนนะ'); return; }
    assignSubjectAndAdd(val);
  });
  customSubjectInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') customSubjectConfirm.click();
  });
  subjectModal.addEventListener('click', (e) => { if (e.target === subjectModal) closeSubjectModal(); });

  function assignSubjectAndAdd(subject){
    const file = pendingFiles.shift();
    if (file) addDocument(file, subject);
    if (pendingFiles.length) {
      askSubjectFor(pendingFiles[0]);
    } else {
      closeSubjectModal();
    }
  }

  /* ---------- Add / render documents ---------- */
  function addDocument(file, subject){
    const doc = {
      id: uid(),
      name: file.name,
      type: file.type,
      subject: subject,
      url: (file.type.startsWith('image/') || file.type === 'application/pdf') ? URL.createObjectURL(file) : null,
      fileObj: file
    };
    documents.push(doc);
    renderSubjectFilter();
    renderGrid();
    showToast('อัปโหลด "' + file.name + '" เข้าวิชา ' + subject + ' แล้ว ✨');
  }

  function renderSubjectFilter(){
    const subjects = ['all', ...new Set(documents.map(d => d.subject))];
    subjectFilter.innerHTML = '';
    subjects.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'subject-chip' + (s === activeSubject ? ' active' : '');
      btn.dataset.subject = s;
      btn.textContent = s === 'all' ? 'ทั้งหมด' : s;
      btn.addEventListener('click', () => {
        activeSubject = s;
        renderSubjectFilter();
        renderGrid();
      });
      subjectFilter.appendChild(btn);
    });
  }

  function renderGrid(){
    const list = activeSubject === 'all' ? documents : documents.filter(d => d.subject === activeSubject);

    docGrid.querySelectorAll('.doc-card').forEach(el => el.remove());
    gridEmpty.hidden = list.length > 0;

    list.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'doc-card';
      card.tabIndex = 0;

      const thumb = document.createElement('div');
      thumb.className = 'doc-thumb';
      if (doc.type.startsWith('image/') && doc.url) {
        const img = document.createElement('img');
        img.src = doc.url;
        img.alt = doc.name;
        thumb.appendChild(img);
      } else {
        thumb.textContent = iconFor(doc);
      }

      const name = document.createElement('p');
      name.className = 'doc-card-name';
      name.textContent = doc.name;

      const meta = document.createElement('div');
      meta.className = 'doc-card-meta';
      const tag = document.createElement('span');
      tag.className = 'doc-subject-tag';
      tag.textContent = doc.subject;
      const delBtn = document.createElement('button');
      delBtn.className = 'doc-delete-btn';
      delBtn.setAttribute('aria-label', 'ลบเอกสาร');
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); openDeleteModal(doc); });
      meta.appendChild(tag);
      meta.appendChild(delBtn);

      card.appendChild(thumb);
      card.appendChild(name);
      card.appendChild(meta);

      card.addEventListener('click', () => goToViewer(doc));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') goToViewer(doc); });

      docGrid.appendChild(card);
    });
  }

  /* ---------- Hand off to full-page Document Viewer ---------- */
  function goToViewer(doc){
    const query = new URLSearchParams({
      name: doc.name,
      type: doc.type || 'application/octet-stream',
      subject: doc.subject,
    });
    window.location.href = `chaiwat_View_Document_prototypes.html?${query.toString()}`;
  }

  /* ---------- Delete confirm modal ---------- */
  function openDeleteModal(doc){
    pendingDeleteId = doc.id;
    deleteFileName.textContent = doc.name;
    deleteModal.hidden = false;
  }
  cancelDeleteBtn.addEventListener('click', () => { deleteModal.hidden = true; pendingDeleteId = null; });
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.hidden = true; });
  confirmDeleteBtn.addEventListener('click', () => {
    documents = documents.filter(d => d.id !== pendingDeleteId);
    deleteModal.hidden = true;
    pendingDeleteId = null;
    renderSubjectFilter();
    renderGrid();
    showToast('ลบเอกสารแล้ว');
  });

  /* ---------- Init ---------- */
  renderSubjectFilter();
  renderGrid();
})();
