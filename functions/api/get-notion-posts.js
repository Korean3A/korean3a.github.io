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
      return new Response(
        JSON.stringify({ error: 'NOTION_API_KEY가 설정되지 않았습니다.' }),
        { status: 500, headers: corsHeaders }
      );
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

    // 디버깅: 환경 변수 확인
    console.log('Environment check:', {
      hasAPIKey: !!NOTION_API_KEY,
      type,
      databaseId,
      allDBs: {
        news: !!env.NOTION_DB_NEWS,
        notice: !!env.NOTION_DB_NOTICE,
        resources: !!env.NOTION_DB_RESOURCES,
        schedule: !!env.NOTION_DB_SCHEDULE,
        album: !!env.NOTION_DB_ALBUM,
      }
    });

    if (!databaseId) {
      return new Response(
        JSON.stringify({
          error: `유효하지 않은 타입: ${type}`,
          debug: {
            type,
            availableTypes: Object.keys(dbMapping),
            envVars: {
              news: !!env.NOTION_DB_NEWS,
              notice: !!env.NOTION_DB_NOTICE,
              resources: !!env.NOTION_DB_RESOURCES,
              schedule: !!env.NOTION_DB_SCHEDULE,
              album: !!env.NOTION_DB_ALBUM,
            }
          }
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Notion API 호출
    const response = await fetch(
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

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Notion API Error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Notion API 호출 실패', details: errorData }),
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();

    // 데이터 파싱 및 포맷팅
    const posts = data.results.map((page) => {
      // 제목 추출 (다양한 속성명 지원)
      let title = '제목 없음';
      const titleProperty = page.properties.Name || page.properties.이름 || page.properties.제목 || page.properties.Title;

      if (titleProperty?.title?.length > 0) {
        title = titleProperty.title[0].plain_text;
      }

      // 커버 이미지 URL 추출
      let coverUrl = null;
      if (page.cover) {
        if (page.cover.type === 'external') {
          coverUrl = page.cover.external.url;
        } else if (page.cover.type === 'file') {
          coverUrl = page.cover.file.url;
        }
      }

      // 생성일 추출
      const createdTime = page.created_time;

      // 페이지 URL
      const pageUrl = page.url;

      // 일정 타입인 경우 날짜 정보 추출
      let scheduleDate = null;
      if (type === 'schedule') {
        const dateProperty = page.properties.날짜 || page.properties.Date || page.properties.일정;
        if (dateProperty?.date) {
          scheduleDate = dateProperty.date.start;
        }
      }

      return {
        id: page.id,
        title,
        coverUrl,
        createdTime,
        pageUrl,
        scheduleDate,
      };
    });

    return new Response(
      JSON.stringify({ success: true, type, posts }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
