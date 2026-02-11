/**
 * Cloudflare Function: 다중 Notion DB에서 게시물 가져오기
 * 쿼리 파라미터: ?type=news|notice|resources|schedule|album
 */
export async function onRequest(context) {
  const { env, request } = context;

  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 환경 변수 추출 및 공백 제거 (매우 중요)
    const NOTION_API_KEY = (env.NOTION_API_KEY || '').trim();

    if (!NOTION_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'NOTION_API_KEY가 없습니다.' }), { status: 500, headers: corsHeaders });
    }

    // URL에서 type 파라미터 추출
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'album';

    // DB ID 매핑
    const dbMapping = {
      news: (env.NOTION_DB_NEWS || '').trim(),
      notice: (env.NOTION_DB_NOTICE || '').trim(),
      resources: (env.NOTION_DB_RESOURCES || '').trim(),
      schedule: (env.NOTION_DB_SCHEDULE || '').trim(),
      album: (env.NOTION_DB_ALBUM || '').trim(),
    };

    const databaseId = dbMapping[type];
    if (!databaseId) {
      return new Response(JSON.stringify({ success: false, error: `${type} DB ID를 찾을 수 없습니다.` }), { status: 500, headers: corsHeaders });
    }

    // Notion API 호출
    const notionResponse = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
          page_size: (type === 'schedule' ? 3 : (type === 'album' ? 5 : 15))
        }),
      }
    );

    let data;
    const responseText = await notionResponse.text();
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: '노션 응답이 JSON이 아닙니다.', details: responseText }), { status: 500, headers: corsHeaders });
    }

    if (!notionResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: '노션 API 에러', details: data.message || responseText }), { status: notionResponse.status, headers: corsHeaders });
    }

    // 안전한 데이터 파싱
    const posts = (data.results || []).map((page) => {
      let title = '제목 없음';
      const props = page.properties || {};

      // 제목 필드 찾기
      for (const key in props) {
        if (props[key].type === 'title' && props[key].title?.[0]) {
          title = props[key].title[0].plain_text;
          break;
        }
      }

      // 커버 이미지
      let coverUrl = null;
      if (page.cover) {
        coverUrl = page.cover.type === 'external' ? page.cover.external.url : page.cover.file?.url;
      }

      // 일정 날짜
      let scheduleDate = null;
      if (type === 'schedule') {
        const dateProp = props['날짜'] || props['Date'] || props['일정'];
        if (dateProp?.date) scheduleDate = dateProp.date.start;
      }

      return {
        id: page.id,
        title,
        coverUrl,
        createdTime: page.created_time,
        pageUrl: page.url,
        scheduleDate,
      };
    });

    return new Response(JSON.stringify({ success: true, type, posts }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Function Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: '서버 내부 오류', details: error.message }), { status: 500, headers: corsHeaders });
  }
}
