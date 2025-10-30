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
  let expanded = false; // 이미 변경했는지 체크

  window.addEventListener("scroll", () => {
    // 헤더 숨김/표시
    if (window.scrollY > lastScrollY) {
      header.style.top = "-300px";
      // 브라우저 가로 폭이 450px 미만일 때만 iframe_cover를 숨김
      if (window.innerWidth < 500) {
        if (iframecover) {
          iframecover.style.display = "none";
          console.log('iframe_cover를 제거합니다.');
        }
      }
    } 
    // 헤더 표시
    // 스크롤을 위로 올리고, 스크롤 위치가 맨 위에 도달했을 때
    else if (window.scrollY === 0) {
      header.style.top = "60px";
      // 브라우저 가로 폭이 450px 미만일 때만 iframe_cover를 표시
      if (window.innerWidth < 500) {
        if (iframecover) {
          iframecover.style.display = "inline-block";
          console.log('iframe_cover를 재설치합니다.');
        }
      }
    }
    lastScrollY = window.scrollY;

    // iframe height 변경
    if (window.scrollY > 0 && !expanded) {
      iframe.style.height = "2000px";
      expanded = true;
    }
  });
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
            if (scrollPercentage >= 90) {
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


const iframeDocument = iframe.contentWindow.document || iframe.contentDocument;

if (iframeDocument) {
  const headerElement = iframeDocument.querySelector('header');
  
  if (headerElement) {
    console.log('header 요소를 찾았습니다:', headerElement);
    headerElement.style.display="none";
    // 여기서 headerElement를 사용하여 작업을 수행합니다.
  } else {
    console.log('iframe 내부 문서에서 header 요소를 찾을 수 없습니다.');
  }
} else {
  console.log('iframe 문서에 접근할 수 없습니다.');
}
