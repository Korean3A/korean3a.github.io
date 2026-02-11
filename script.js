// script.js 파일에 추가
/**
 * HTML 파일을 불러와 특정 요소에 삽입하는 함수
 * @param {string} filePath - 불러올 HTML 파일 경로 (예: 'nav.html', 'footer.html')
 * @param {string} targetSelector - 내용을 삽입할 대상 요소의 CSS 선택자 (예: 'nav', 'footer')
 */
function includeHTML(filePath, targetSelector) {
    const targetElement = document.querySelector(targetSelector);

    if (targetElement) {
        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                // 불러온 HTML 내용으로 대상 요소의 내부를 채웁니다.
                targetElement.innerHTML = data;
            })
            .catch(error => {
                console.error(`HTML 파일 로드 중 오류 발생 (${filePath}):`, error);
            });
    } else {
        console.warn(`대상을 찾을 수 없습니다: ${targetSelector}`);
    }
}

function toggleMenu() {
    document.querySelector("nav").classList.toggle("active");
}

document.addEventListener("click", function (e) {
    const nav = document.querySelector("nav");
    if (!nav.contains(e.target) && nav.classList.contains("active")) {
        nav.classList.remove("active");
    }
});

