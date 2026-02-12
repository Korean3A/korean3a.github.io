/**
 * Notion 통합 섹션 및 내장 본문 뷰어 스크립트
 */

// API 엔드포인트
const API_ENDPOINT = '/api/get-notion-posts';
const CONTENT_API_ENDPOINT = '/api/get-notion-content';

// 캐시 및 상태 관리
const cache = {};
let lastType = null;
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

  const isIndex = window.location.pathname.endsWith('index.html') ||
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('/');

  if (isIndex) {
    // index.html에서 클릭 시 해당 카테고리 페이지로 이동
    // lastType(news, notice, resources 등)에 따라 이동할 페이지 결정
    let targetPage = `${lastType}.html`;

    // 앨범의 경우 전용 페이지가 없다면 index에서 처리하거나 보드 페이지로 연결 가능
    // 현재는 news, notice, resources, schedule 페이지가 존재함
    window.location.href = `${targetPage}?id=${pageId}`;
  } else {
    // 이미 상세 페이지인 경우 바로 뷰어 가동
    showPostDetail(pageId);
  }
}

/**
 * 게시물 상세 보기 로드
 */
async function showPostDetail(pageId) {
  const contentArea = document.getElementById(lastTargetId);
  if (!contentArea) return;

  // URL 파라미터 업데이트 (히스토리에 남겨서 뒤로가기 대응)
  if (!window.location.search.includes(pageId)) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('id', pageId);
    window.history.pushState({ pageId }, '', newUrl);
  }

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

  // 캐시에 데이터가 없는 경우에만 로딩 표시
  if (!cache[type]) {
    contentArea.innerHTML = `
            <div class="notion-loading">
                <div class="spinner"></div>
                <p>목록을 불러오는 중...</p>
            </div>
        `;
  }

  try {
    const posts = await fetchNotionPosts(type);
    let html;
    if (type === 'album') html = renderers.album(posts);
    else if (type === 'schedule') html = renderers.schedule(posts);
    else html = renderers.list(posts);

    // 부드러운 교체를 위해 페이드 아웃/인 효과
    contentArea.style.opacity = '0.5';

    setTimeout(() => {
      contentArea.innerHTML = html;
      contentArea.style.opacity = '1';
      contentArea.style.transition = 'opacity 0.2s ease';
    }, 50);

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
  if (lastType === type && document.getElementById(lastTargetId).innerHTML !== '') return;

  document.querySelectorAll('.notion-tab-btn').forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  await loadNotionPosts(type);
}

/**
 * 백그라운드 데이터 사전 로드
 */
async function preloadAllNotionData() {
  const types = ['news', 'notice', 'schedule', 'resources', 'album'];
  for (const type of types) {
    try {
      if (!cache[type]) {
        await fetchNotionPosts(type);
        console.log(`Preloaded: ${type}`);
      }
    } catch (e) {
      console.warn(`Failed to preload ${type}:`, e);
    }
  }
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

/**
 * 초기화
 */
function initNotionTabs() {
  const buttons = document.querySelectorAll('.notion-tab-btn');
  const urlParams = new URLSearchParams(window.location.search);
  const postIdFromUrl = urlParams.get('id');

  // 1. 탭 버튼이 있는 경우 (index.html 등)
  if (buttons.length > 0) {
    buttons.forEach(button => {
      const type = button.getAttribute('data-type');

      // 클릭 이벤트
      button.addEventListener('click', () => switchTab(type, button));

      // 마우스 호버(mouseenter) 이벤트 추가
      let hoverTimer;
      button.addEventListener('mouseenter', () => {
        // 즉시 전환하지 않고 살짝 지연을 두어 자연스럽게 (실수 방지)
        hoverTimer = setTimeout(() => {
          switchTab(type, button);
        }, 150);
      });

      button.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
      });
    });

    // 기본 탭 로드 및 백그라운드 프리로드 시작
    const defaultBtn = document.querySelector('.notion-tab-btn[data-type="news"]');
    if (defaultBtn) {
      switchTab('news', defaultBtn).then(() => {
        // 첫 번째 탭 로드 후 나머지 데이터 백그라운드 로드
        preloadAllNotionData();
      });
    }
  }

  // 2. 만약 URL에 id가 있다면 즉시 본문 로드
  if (postIdFromUrl) {
    setTimeout(() => {
      showPostDetail(postIdFromUrl);
    }, 500);
  }
}

/**
 * 뒤로가기 대응
 */
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.pageId) {
    showPostDetail(event.state.pageId);
  } else {
    backToList();
  }
});

document.addEventListener('DOMContentLoaded', initNotionTabs);
if (document.readyState !== 'loading') initNotionTabs();
