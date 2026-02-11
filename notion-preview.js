/**
 * Notion 통합 섹션 및 내장 본문 뷰어 스크립트
 */

// API 엔드포인트
const API_ENDPOINT = '/api/get-notion-posts';
const CONTENT_API_ENDPOINT = '/api/get-notion-content';

// 캐시 및 상태 관리
const cache = {};
let lastType = 'news';
let lastTargetId = 'notion-content-area';

/**
 * Notion API에서 게시물 목록 가져오기
 */
async function fetchNotionPosts(type) {
  if (cache[type]) return cache[type];
  try {
    const response = await fetch(`${API_ENDPOINT}?type=${type}`);
    if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'API 응답 오류');
    cache[type] = data.posts;
    return data.posts;
  } catch (error) {
    console.error(`Notion 게시물 가져오기 실패 (${type}):`, error);
    throw error;
  }
}

/**
 * 게시물 클릭 핸들러
 */
function handlePostClick(pageId, event) {
  if (event) event.preventDefault();
  showPostDetail(pageId);
}

/**
 * 게시물 상세 보기 로드
 */
async function showPostDetail(pageId) {
  const contentArea = document.getElementById(lastTargetId);
  if (!contentArea) return;

  // 로딩 표시
  contentArea.innerHTML = `
        <div class="notion-loading">
            <div class="spinner"></div>
            <p>본문을 불러오는 중...</p>
        </div>
    `;

  try {
    const response = await fetch(`${CONTENT_API_ENDPOINT}?pageId=${pageId}`);
    if (!response.ok) throw new Error('본문을 가져오는데 실패했습니다.');
    const data = await response.json();
    if (!data.success) throw new Error(data.error);

    renderPostDetail(data, contentArea);
  } catch (error) {
    contentArea.innerHTML = `
            <div class="notion-error">
                <p>⚠️ 본문 로드 실패</p>
                <p class="error-details">${escapeHtml(error.message)}</p>
                <button class="back-button" onclick="backToList()" style="margin: 20px auto;">목록으로 돌아가기</button>
            </div>
        `;
  }
}

/**
 * 게시물 상세 내용 렌더링
 */
function renderPostDetail(data, container) {
  const { page, blocks } = data;

  // 제목 추출
  let title = '제목 없음';
  const titleProp = Object.values(page.properties).find(p => p.type === 'title');
  if (titleProp?.title?.[0]) title = titleProp.title[0].plain_text;

  // 작성자 추출 (Created By 또는 별도 속성)
  let author = page.created_by?.name || '관리자';
  // 만약 '작성자'라는 이름의 속성이 따로 있다면 그것을 우선 사용
  const authorProp = page.properties['작성자'] || page.properties['Author'];
  if (authorProp?.rich_text?.[0]) author = authorProp.rich_text[0].plain_text;

  // 작성일
  const dateStr = formatDate(page.created_time);

  const detailHtml = `
    <div class="post-detail">
      <button class="back-button" onclick="backToList()">
        <span>← 목록으로 돌아가기</span>
      </button>
      
      <header class="detail-header">
        <h1 class="detail-title">${escapeHtml(title)}</h1>
        <div class="detail-meta">
          <span class="meta-author">👤 ${escapeHtml(author)}</span>
          <span class="meta-date">📅 ${dateStr}</span>
        </div>
      </header>

      <div class="post-body">
        ${renderBlocks(blocks)}
      </div>

      <div style="margin-top: 50px; text-align: center;">
        <button class="back-button" onclick="backToList()" style="margin: 0 auto;">목록으로 돌아가기</button>
      </div>
    </div>
  `;

  container.innerHTML = detailHtml;
  window.scrollTo({ top: container.offsetTop - 100, behavior: 'smooth' });
}

/**
 * 노션 블록 -> HTML 변환 (경량 변환기)
 */
function renderBlocks(blocks) {
  return blocks.map(block => {
    const type = block.type;
    const value = block[type];

    // 텍스트 추출 헬퍼
    const getRichText = (arr) => {
      if (!arr) return '';
      return arr.map(text => {
        let content = escapeHtml(text.plain_text);
        if (text.annotations.bold) content = `<strong>${content}</strong>`;
        if (text.annotations.italic) content = `<em>${content}</em>`;
        if (text.annotations.code) content = `<code>${content}</code>`;
        if (text.href) content = `<a href="${text.href}" target="_blank">${content}</a>`;
        return content;
      }).join('');
    };

    switch (type) {
      case 'paragraph':
        return `<p>${getRichText(value.rich_text)}</p>`;
      case 'heading_1':
        return `<h1>${getRichText(value.rich_text)}</h1>`;
      case 'heading_2':
        return `<h2>${getRichText(value.rich_text)}</h2>`;
      case 'heading_3':
        return `<h3>${getRichText(value.rich_text)}</h3>`;
      case 'bulleted_list_item':
        return `<ul><li>${getRichText(value.rich_text)}</li></ul>`;
      case 'numbered_list_item':
        return `<ol><li>${getRichText(value.rich_text)}</li></ol>`;
      case 'image': {
        const url = value.type === 'external' ? value.external.url : value.file.url;
        const caption = getRichText(value.caption);
        return `<figure class="post-image-wrap"><img src="${url}" alt="image">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
      }
      case 'video': {
        const url = value.type === 'external' ? value.external.url : value.file.url;
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          const videoId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
          return `<div class="aspect-ratio-wrap"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
        }
        return `<video controls src="${url}" style="width:100%; border-radius:12px; margin:20px 0;"></video>`;
      }
      case 'file':
      case 'pdf': {
        const url = value.type === 'external' ? value.external.url : value.file.url;
        const fileName = value.name || (value.caption?.[0]?.plain_text) || '첨부파일 다운로드';
        return `
          <div class="file-attachment">
            <span class="file-icon">📁</span>
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="file-link">
              ${escapeHtml(fileName)}
            </a>
          </div>
        `;
      }
      case 'embed': {
        const url = value.url;
        // Google Drive 등 임베드 처리
        if (url.includes('drive.google.com')) {
          const embedUrl = url.replace('/view', '/preview');
          return `<div class="aspect-ratio-wrap"><iframe src="${embedUrl}" width="100%" height="480" allow="autoplay"></iframe></div>`;
        }
        return `<div class="aspect-ratio-wrap"><iframe src="${url}" frameborder="0"></iframe></div>`;
      }
      case 'divider':
        return `<hr class="section-divider">`;
      case 'quote':
        return `<blockquote>${getRichText(value.rich_text)}</blockquote>`;
      case 'code':
        return `<div class="code-block"><pre><code>${getRichText(value.rich_text)}</code></pre></div>`;
      case 'callout': {
        const icon = value.icon?.emoji || 'ℹ️';
        return `<div class="notion-aside"><p>${icon} ${getRichText(value.rich_text)}</p></div>`;
      }
      case 'table':
        return `<p class="empty-message-small">⚠️ 표(Table) 블록은 현재 목록 보기에서 지원하지 않습니다.</p>`;
      default:
        return '';
    }
  }).join('').replace(/<\/ul><ul>/g, '').replace(/<\/ol><ol>/g, ''); // 연속된 리스트 합치기
}

/**
 * 다시 목록으로
 */
function backToList() {
  loadNotionPosts(lastType, lastTargetId);
}

/**
 * 콘텐츠 렌더링 함수들 (목록 보기)
 */
const renderers = {
  album: (posts) => {
    if (!posts || posts.length === 0) return '<p class="empty-message">게시물이 없습니다.</p>';
    return `
            <div class="gallery-grid">
                ${posts.map(post => `
                    <figure class="notion-gallery-item">
                        <a href="javascript:void(0)" onclick="handlePostClick('${post.id}', event)">
                            <img src="${post.coverUrl || 'images/logo_eng_cutted.png'}" 
                                 alt="${escapeHtml(post.title)}" 
                                 onerror="this.src='images/logo_eng_cutted.png'; this.style.objectFit='contain';">
                            <figcaption>${escapeHtml(post.title)}</figcaption>
                        </a>
                    </figure>
                `).join('')}
            </div>
        `;
  },
  list: (posts) => {
    if (!posts || posts.length === 0) return '<p class="empty-message">게시물이 없습니다.</p>';
    return `
            <ul class="notion-list">
                ${posts.map(post => `
                    <li class="notion-list-item">
                        <a href="javascript:void(0)" onclick="handlePostClick('${post.id}', event)">
                            <span class="list-title">${escapeHtml(post.title)}</span>
                            <span class="list-date">${formatDate(post.createdTime)}</span>
                        </a>
                    </li>
                `).join('')}
            </ul>
        `;
  },
  schedule: (posts) => {
    if (!posts || posts.length === 0) return '<p class="empty-message">일정이 없습니다.</p>';
    return `
            <ul class="notion-schedule">
                ${posts.map(post => `
                    <li class="notion-schedule-item">
                        <a href="javascript:void(0)" onclick="handlePostClick('${post.id}', event)">
                            <span class="schedule-date">${formatDate(post.scheduleDate || post.createdTime)}</span>
                            <span class="schedule-title">${escapeHtml(post.title)}</span>
                        </a>
                    </li>
                `).join('')}
            </ul>
        `;
  }
};

/**
 * 특정 타입의 게시물을 영역에 로드
 */
async function loadNotionPosts(type, targetId = 'notion-content-area') {
  lastType = type;
  lastTargetId = targetId;
  const contentArea = document.getElementById(targetId);
  if (!contentArea) return;

  contentArea.innerHTML = `
        <div class="notion-loading">
            <div class="spinner"></div>
            <p>목록을 불러오는 중...</p>
        </div>
    `;

  try {
    const posts = await fetchNotionPosts(type);
    let html;
    if (type === 'album') html = renderers.album(posts);
    else if (type === 'schedule') html = renderers.schedule(posts);
    else html = renderers.list(posts);

    contentArea.innerHTML = html;
    contentArea.style.opacity = '0';
    setTimeout(() => {
      contentArea.style.opacity = '1';
      contentArea.style.transition = 'opacity 0.3s ease';
    }, 10);

  } catch (error) {
    contentArea.innerHTML = `
            <div class="notion-error">
                <p>⚠️ 불러오기 실패</p>
                <p class="error-details">${escapeHtml(error.message)}</p>
            </div>
        `;
  }
}

async function switchTab(type, button) {
  document.querySelectorAll('.notion-tab-btn').forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  await loadNotionPosts(type);
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function initNotionTabs() {
  const buttons = document.querySelectorAll('.notion-tab-btn');
  if (buttons.length > 0) {
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const type = button.getAttribute('data-type');
        switchTab(type, button);
      });
    });
    const defaultBtn = document.querySelector('.notion-tab-btn[data-type="news"]');
    if (defaultBtn && defaultBtn.classList.contains('active')) {
      switchTab('news', defaultBtn);
    }
  }
}

document.addEventListener('DOMContentLoaded', initNotionTabs);
if (document.readyState !== 'loading') initNotionTabs();
