/**
 * Notion 미리보기 및 갤러리 통합 스크립트
 * - 갤러리 섹션: 앨범 DB의 최근 게시물 5개 표시
 * - 하단 버튼 호버: 각 DB의 최근 게시물 미리보기 팝업 표시
 */

// API 엔드포인트
const API_ENDPOINT = '/api/get-notion-posts';

// 캐시 저장소
const cache = {};

/**
 * Notion API에서 게시물 가져오기
 */
async function fetchNotionPosts(type) {
    // 캐시 확인
    if (cache[type]) {
        return cache[type];
    }

    try {
        const response = await fetch(`${API_ENDPOINT}?type=${type}`);

        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'API 응답 오류');
        }

        // 캐시에 저장
        cache[type] = data.posts;
        return data.posts;
    } catch (error) {
        console.error(`Notion 게시물 가져오기 실패 (${type}):`, error);
        throw error;
    }
}

/**
 * 갤러리 HTML 생성 (앨범용)
 */
function createGalleryHTML(posts) {
    if (!posts || posts.length === 0) {
        return '<p style="text-align: center; color: var(--text-muted);">게시물이 없습니다.</p>';
    }

    return posts.map(post => {
        const imageUrl = post.coverUrl || 'images/default-cover.jpg';
        const title = post.title || '제목 없음';
        const pageUrl = post.pageUrl || '#';

        return `
      <figure class="notion-gallery-item">
        <a href="${pageUrl}" target="_blank" rel="noopener noreferrer">
          <img src="${imageUrl}" alt="${escapeHtml(title)}" loading="lazy">
          <figcaption>${escapeHtml(title)}</figcaption>
        </a>
      </figure>
    `;
    }).join('');
}

/**
 * 리스트 HTML 생성 (News, 공지사항, 자료실용)
 */
function createListHTML(posts) {
    if (!posts || posts.length === 0) {
        return '<p class="empty-message">게시물이 없습니다.</p>';
    }

    return `
    <ul class="notion-list">
      ${posts.map(post => {
        const title = post.title || '제목 없음';
        const pageUrl = post.pageUrl || '#';
        const date = formatDate(post.createdTime);

        return `
          <li class="notion-list-item">
            <a href="${pageUrl}" target="_blank" rel="noopener noreferrer">
              <span class="list-title">${escapeHtml(title)}</span>
              <span class="list-date">${date}</span>
            </a>
          </li>
        `;
    }).join('')}
    </ul>
  `;
}

/**
 * 일정 HTML 생성 (공식일정용)
 */
function createScheduleHTML(posts) {
    if (!posts || posts.length === 0) {
        return '<p class="empty-message">예정된 일정이 없습니다.</p>';
    }

    return `
    <ul class="notion-schedule">
      ${posts.map(post => {
        const title = post.title || '제목 없음';
        const pageUrl = post.pageUrl || '#';
        const date = formatDate(post.scheduleDate || post.createdTime);

        return `
          <li class="notion-schedule-item">
            <a href="${pageUrl}" target="_blank" rel="noopener noreferrer">
              <span class="schedule-date">${date}</span>
              <span class="schedule-title">${escapeHtml(title)}</span>
            </a>
          </li>
        `;
    }).join('')}
    </ul>
  `;
}

/**
 * 미니 갤러리 HTML 생성 (앨범 미리보기용)
 */
function createMiniGalleryHTML(posts) {
    if (!posts || posts.length === 0) {
        return '<p class="empty-message">게시물이 없습니다.</p>';
    }

    return `
    <div class="notion-mini-gallery">
      ${posts.map(post => {
        const imageUrl = post.coverUrl || 'images/default-cover.jpg';
        const title = post.title || '제목 없음';
        const pageUrl = post.pageUrl || '#';

        return `
          <a href="${pageUrl}" target="_blank" rel="noopener noreferrer" class="mini-gallery-item">
            <img src="${imageUrl}" alt="${escapeHtml(title)}" loading="lazy">
            <span>${escapeHtml(title)}</span>
          </a>
        `;
    }).join('')}
    </div>
  `;
}

/**
 * 로딩 HTML
 */
function getLoadingHTML() {
    return `
    <div class="notion-loading">
      <div class="spinner"></div>
      <p>불러오는 중...</p>
    </div>
  `;
}

/**
 * 에러 HTML
 */
function getErrorHTML(message) {
    return `
    <div class="notion-error">
      <p>⚠️ 불러오기 실패</p>
      <p class="error-details">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * 날짜 포맷팅
 */
function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}.${month}.${day}`;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 갤러리 섹션 초기화 (앨범 DB)
 */
async function initGallery() {
    const galleryContainer = document.querySelector('.gallery-grid');

    if (!galleryContainer) {
        console.error('갤러리 컨테이너를 찾을 수 없습니다.');
        return;
    }

    // 로딩 표시
    galleryContainer.innerHTML = getLoadingHTML();

    try {
        // 앨범 DB에서 게시물 가져오기
        const posts = await fetchNotionPosts('album');

        // 갤러리 렌더링
        galleryContainer.innerHTML = createGalleryHTML(posts);

        console.log(`✅ 앨범 갤러리 로드 완료: ${posts.length}개 게시물`);
    } catch (error) {
        // 에러 표시
        galleryContainer.innerHTML = getErrorHTML(error.message);
        console.error('❌ 앨범 갤러리 로드 실패:', error);
    }
}

/**
 * 미리보기 팝업 표시
 */
async function showPreview(button, type) {
    // 기존 팝업 제거
    const existingPopup = document.querySelector('.notion-preview-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // 팝업 생성
    const popup = document.createElement('div');
    popup.className = 'notion-preview-popup';
    popup.innerHTML = getLoadingHTML();

    // 버튼 위치 계산
    const rect = button.getBoundingClientRect();
    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${rect.top - 10}px`;

    document.body.appendChild(popup);

    try {
        // 게시물 가져오기
        const posts = await fetchNotionPosts(type);

        // 타입별 렌더링
        let content;
        if (type === 'album') {
            content = createMiniGalleryHTML(posts);
        } else if (type === 'schedule') {
            content = createScheduleHTML(posts);
        } else {
            content = createListHTML(posts);
        }

        popup.innerHTML = content;

        // 팝업 위치 재조정 (내용 로드 후)
        const popupRect = popup.getBoundingClientRect();
        popup.style.left = `${rect.left + rect.width / 2 - popupRect.width / 2}px`;

    } catch (error) {
        popup.innerHTML = getErrorHTML(error.message);
    }
}

/**
 * 미리보기 팝업 숨기기
 */
function hidePreview() {
    const popup = document.querySelector('.notion-preview-popup');
    if (popup) {
        popup.remove();
    }
}

/**
 * 하단 버튼 호버 이벤트 초기화
 */
function initHoverPreviews() {
    // 타입 매핑
    const typeMapping = {
        'news.html': 'news',
        'notice.html': 'notice',
        'resources.html': 'resources',
        'schedule.html': 'schedule',
    };

    // 모든 링크 버튼에 이벤트 추가
    const buttons = document.querySelectorAll('.links-footer .aside-link');

    buttons.forEach(button => {
        const href = button.getAttribute('href');
        const type = typeMapping[href];

        if (type) {
            let hoverTimeout;

            button.addEventListener('mouseenter', () => {
                // 약간의 지연 후 미리보기 표시 (즉각 반응 방지)
                hoverTimeout = setTimeout(() => {
                    showPreview(button, type);
                }, 300);
            });

            button.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                // 약간의 지연 후 숨기기 (팝업으로 마우스 이동 가능)
                setTimeout(hidePreview, 200);
            });
        }
    });

    console.log('✅ 호버 미리보기 초기화 완료');
}

/**
 * 전체 초기화
 */
function init() {
    // 갤러리 섹션 초기화
    initGallery();

    // 호버 미리보기 초기화
    initHoverPreviews();
}

// DOM 로드 완료 후 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
