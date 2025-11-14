function toggleMenu() {
  document.querySelector("nav").classList.toggle("active");
}
document.addEventListener("click", function(e) {
  const nav = document.querySelector("nav");
  if (!nav.contains(e.target) && nav.classList.contains("active")) {
    nav.classList.remove("active");
  }
});

document.addEventListener("DOMContentLoaded", () => {
let lastScrollY = window.scrollY;
const header = document.querySelector(".main-header");
const iframe = document.getElementById("myframe");
const iframecover = document.getElementsByClassName('iframe_cover')[0];
let expanded = false; // iframe 높이 변경 여부 체크 변수

window.addEventListener("scroll", () => {
    // 1. 전체 스크롤 가능 높이 계산
    const totalScrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
 
    // 2. 현재 스크롤 위치의 백분율 계산 (0 ~ 1 사이의 값)
    // totalScrollableHeight가 0일 경우(스크롤 불가)를 대비하여 0을 반환
    const scrollPercentage = totalScrollableHeight > 0 ? window.scrollY / totalScrollableHeight : 0;
 
    
    // --- 👇 헤더 표시/숨김 로직 수정 (20% 위치 기반) 👇 ---
 
    // 3. 헤더 제어: 스크롤 위치가 20% 미만일 때 (상단 20% 영역)
    if (scrollPercentage < 0.2) {
        // 헤더 표시
        if (header.style.top !== "60px") {
            header.style.top = "60px";
            console.log('헤더 표시 (스크롤 20% 미만)');
        }
    } else {
        // 헤더 숨김 (스크롤 20% 이상)
        if (header.style.top !== "-300px") {
            header.style.top = "-300px";
            console.log('헤더 숨김 (스크롤 20% 이상)');
        }
    }
 
    // --- 👆 헤더 표시/숨김 로직 수정 (20% 위치 기반) 👆 ---
 
 
    // 4. iframe_cover 제어 (20% 위치 기반)
    // 브라우저 가로 폭이 500px 미만일 때만 iframe_cover 제어
    if (window.innerWidth < 500 && iframecover) {
        
        // cover 표시 조건: 스크롤이 20% 미만일 때 (상단 20% 영역)
        if (scrollPercentage < 0.2) {
            if (iframecover.style.display !== "inline-block") {
                iframecover.style.display = "inline-block";
                console.log('iframe_cover를 재설치합니다. (스크롤 20% 미만)');
            }
        }
        // cover 숨김 조건: 스크롤이 20% 이상일 때
        else { // scrollPercentage >= 0.2
            if (iframecover.style.display !== "none") {
                iframecover.style.display = "none";
                console.log('iframe_cover를 제거합니다. (스크롤 20% 이상)');
            }
        }
    }
 
    lastScrollY = window.scrollY;
 
    // 5. iframe height 변경 (기존 로직 유지)
    if (iframe && window.scrollY > 0 && !expanded) {
        iframe.style.height = "3000px";
        expanded = true;
    }
});

  if (iframe) {
  // 2. iframe의 'load' 이벤트 리스너를 추가합니다.
  iframe.addEventListener('load', () => {
    // iframe 내부 문서 로딩이 완료된 후에 실행될 코드
    
    // 3. iframe 내부 문서 객체에 접근합니다.
    const iframeDocument = iframe.contentWindow.document || iframe.contentDocument;

    if (iframeDocument) {
      const headerElement = iframeDocument.querySelector('header');
      
      if (headerElement) {
        console.log('header 요소를 찾았습니다:', headerElement);
        // header 요소를 숨깁니다.
        headerElement.style.display = "none";
      } else {
        console.log('iframe 내부 문서에서 header 요소를 찾을 수 없습니다.');
      }
    } else {
      console.log('iframe 문서에 접근할 수 없습니다. (동일 출처 정책 확인 필요)');
    }
  });
} else {
  console.error('ID가 \'myIframe\'인 iframe 요소를 찾을 수 없습니다.');
}
  
});

       /**
         * 스크롤 이벤트를 처리하고 푸터의 표시 여부를 결정하는 함수
         */
        function handleScroll() {
            const footer = document.getElementById('myFooter');
            const scrollIndicator = document.getElementById('scrollPercentage');

            // 1. 전체 문서 높이 (스크롤 가능 영역 + 뷰포트 높이)
            const scrollHeight = document.documentElement.scrollHeight;
            // 2. 현재 뷰포트 높이
            const clientHeight = document.documentElement.clientHeight;
            // 3. 현재 스크롤 위치 (가장 위에서부터의 거리)
            const scrollTop = document.documentElement.scrollTop;

            // 실제로 스크롤할 수 있는 최대 높이 (문서 전체 높이 - 뷰포트 높이)
            const scrollableHeight = scrollHeight - clientHeight;

            // 스크롤 완료 퍼센트 계산
            // scrollableHeight가 0일 경우 (스크롤이 불가능할 경우)를 대비해 0으로 나눔 방지
            const scrollPercentage = scrollableHeight > 0
                ? (scrollTop / scrollableHeight) * 100
                : 0;

            // 스크롤 퍼센티지를 표시 (디버깅 및 사용자 피드백용)
            scrollIndicator.textContent = `스크롤: ${Math.round(scrollPercentage)}%`;

            // 95% 이상 스크롤했을 때 푸터를 'flex'로 표시하고, 아닐 때는 'none'으로 숨김
            if (scrollPercentage >= 95) {
                // 이전에 CSS에서 설정한 display: none; 을 덮어씀
                footer.style.display = 'flex';
            } else {
                footer.style.display = 'none';
            }
        }

        // 1. 스크롤 이벤트 리스너 등록
        window.addEventListener('scroll', handleScroll);

        // 2. 페이지 로드 시 한 번 실행하여 초기 상태를 설정 (맨 위에서는 푸터가 숨겨져야 함)
        window.addEventListener('load', handleScroll);

