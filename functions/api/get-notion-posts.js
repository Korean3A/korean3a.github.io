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
    const NOTION_API_KEY = env.NOTION_API_KEY;

    if (!NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY가 환경 변수에 설정되지 않았습니다.');
    }

    // URL에서 type 파라미터 추출
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'album';

    // DB ID 매핑
    const dbMapping = {
      news: env.NOTION_DB_NEWS,
      notice: env.NOTION_DB_NOTICE,
      resources: env.NOTION_DB_RESOURCES,
      schedule: env.NOTION_DB_SCHEDULE,
      album: env.NOTION_DB_ALBUM,
    };

    // 페이지 수 매핑
    const pageSizeMapping = {
      news: 15,
      notice: 15,
      resources: 15,
      schedule: 3,
      album: 5,
    };

    const databaseId = dbMapping[type];
    const pageSize = pageSizeMapping[type] || 5;

    if (!databaseId) {
      throw new Error(`DB ID를 찾을 수 없습니다. (Type: ${type}). 환경 변수 설정을 확인하세요.`);
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
          sorts: [
            {
              timestamp: 'created_time',
              direction: 'descending',
            },
          ],
          page_size: pageSize,
        }),
      }
    );

    const data = await notionResponse.json();

    if (!notionResponse.ok) {
      console.error('Notion API Error Body:', data);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Notion API 호출 중 에러 발생',
          details: data.message || '알 수 없는 오류',
          code: data.code
        }),
        { status: notionResponse.status, headers: corsHeaders }
      );
    }

    // 데이터 파싱
    const posts = (data.results || []).map((page) => {
      // 제목 찾기 (Notion은 DB마다 제목 필드명이 다를 수 있음)
      let title = '제목 없음';
      const properties = page.properties || {};

      // 제목 타입의 속성을 찾아서 제목으로 사용
      for (const key in properties) {
        if (properties[key].type === 'title' && properties[key].title?.length > 0) {
          title = properties[key].title[0].plain_text;
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
        const dateProp = properties['날짜'] || properties['Date'] || properties['일정'];
        if (dateProp?.date) {
          scheduleDate = dateProp.date.start;
        }
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

    return new Response(
      JSON.stringify({ success: true, type, posts }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Function Error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: '서버 내부 오류',
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
