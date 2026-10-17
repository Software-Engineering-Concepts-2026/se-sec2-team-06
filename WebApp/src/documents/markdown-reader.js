import { marked } from 'marked';
import DOMPurify from 'dompurify';

const MARKDOWN_OPTIONS = Object.freeze({ gfm: true, async: false });
const SANITIZE_OPTIONS = Object.freeze({
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'img', 'video', 'audio', 'source', 'form'],
  FORBID_ATTR: ['style'],
});

export function renderMarkdown(source) {
  const markup = marked.parse(String(source ?? ''), MARKDOWN_OPTIONS);
  return DOMPurify.sanitize(markup, SANITIZE_OPTIONS);
}
