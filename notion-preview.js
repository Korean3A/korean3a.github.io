/**
 * Notion 통합 섹션 스크립트 (탭 전환 방식)
 */

// API 엔드포인트
const API_ENDPOINT = '/api/get-notion-posts';

// 캐시 저장소
const cache = {};

/**
 * Notion API에서 게시물 가져오기
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
 * 콘텐츠 렌더링 함수들
 */
const renderers = {
  album: (posts) => {
    if (!posts || posts.length === 0) return '<p class="empty-message">게시물이 없습니다.</p>';
    return `
            <div class="gallery-grid">
                ${posts.map(post => `
                    <figure class="notion-gallery-item">
                        <a href="${post.pageUrl}" target="_blank" rel="noopener noreferrer">
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
                        <a href="${post.pageUrl}" target="_blank" rel="noopener noreferrer">
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
                        <a href="${post.pageUrl}" target="_blank" rel="noopener noreferrer">
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
 * 탭 클릭 핸들러
 */
async function switchTab(type, button) {
  const contentArea = document.getElementById('notion-content-area');
  if (!contentArea) return;

  // 활성 버튼 스타일 변경
  document.querySelectorAll('.notion-tab-btn').forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');

  // 로딩 표시
  contentArea.innerHTML = `
        <div class="notion-loading">
            <div class="spinner"></div>
            <p>불러오는 중...</p>
        </div>
    `;

  try {
    const posts = await fetchNotionPosts(type);

    // 타입별 렌더러 선택
    let html;
    if (type === 'album') html = renderers.album(posts);
    else if (type === 'schedule') html = renderers.schedule(posts);
    else html = renderers.list(posts);

    contentArea.innerHTML = html;

    // 애니메이션 효과
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

/**
 * 유틸리티 함수들
 */
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
  const contentArea = document.getElementById('notion-content-area');

  if (!contentArea || buttons.length === 0) return;

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const type = button.getAttribute('data-type');
      switchTab(type, button);
    });
  });

  // 초기 데이터 로드 (기본값: 앨범)
  const defaultBtn = document.querySelector('.notion-tab-btn[data-type="album"]');
  if (defaultBtn) {
    switchTab('album', defaultBtn);
  }
}

// 실행
document.addEventListener('DOMContentLoaded', initNotionTabs);
if (document.readyState !== 'loading') initNotionTabs();
