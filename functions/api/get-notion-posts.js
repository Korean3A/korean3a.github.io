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
    // 환경 변수 이름(키) 자체에 공백이 포함된 경우까지 대비한 매칭 함수
    const getEnv = (keyName) => {
      const realKey = Object.keys(env).find(k => k.trim() === keyName);
      return (env[realKey || keyName] || '').trim();
    };

    const NOTION_API_KEY = getEnv('NOTION_API_KEY');

    if (!NOTION_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'NOTION_API_KEY가 없습니다.',
        detectedKeys: Object.keys(env)
      }), { status: 500, headers: corsHeaders });
    }

    // URL에서 type 파라미터 추출
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'album';

    // DB ID 매핑
    const dbMapping = {
      news: getEnv('NOTION_DB_NEWS'),
      notice: getEnv('NOTION_DB_NOTICE'),
      resources: getEnv('NOTION_DB_RESOURCES'),
      schedule: getEnv('NOTION_DB_SCHEDULE'),
      album: getEnv('NOTION_DB_ALBUM'),
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
          page_size: (type === 'schedule' ? 5 : (type === 'album' ? 6 : 20))
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

    // 본문 블록에서 첫 번째 이미지 추출하는 헬퍼 함수
    const getFirstImageFromBlocks = async (blockId) => {
      try {
        const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=20`, {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
          }
        });
        if (!res.ok) return null;
        const blockData = await res.json();
        const imageBlock = (blockData.results || []).find(b => b.type === 'image');
        if (imageBlock) {
          return imageBlock.image.type === 'external' ? imageBlock.image.external.url : imageBlock.image.file?.url;
        }
      } catch (e) {
        console.error('Block fetch error:', e);
      }
      return null;
    };

    // 안전한 데이터 파싱
    const posts = await Promise.all((data.results || []).map(async (page) => {
      let title = '제목 없음';
      const props = page.properties || {};

      // 제목 필드 찾기
      for (const key in props) {
        if (props[key].type === 'title' && props[key].title?.[0]) {
          title = props[key].title[0].plain_text;
          break;
        }
      }

      // 1. 커버 이미지 확인
      let coverUrl = null;
      if (page.cover) {
        coverUrl = page.cover.type === 'external' ? page.cover.external.url : page.cover.file?.url;
      }

      // 2. 모든 properties를 뒤져서 이미지/URL 찾기 (커버가 없을 경우)
      if (!coverUrl) {
        for (const key in props) {
          const prop = props[key];

          // 파일 및 미디어 속성 확인
          if (prop.type === 'files' && prop.files?.length > 0) {
            const firstFile = prop.files[0];
            coverUrl = firstFile.type === 'external' ? firstFile.external.url : firstFile.file?.url;
          }
          // URL 속성 확인
          else if (prop.type === 'url' && prop.url) {
            if (/\.(jpg|jpeg|png|webp|gif|svg)/i.test(prop.url)) {
              coverUrl = prop.url;
            }
          }
          // Rich Text 내의 URL 확인 (가끔 텍스트로 넣는 경우 대비)
          else if (prop.type === 'rich_text' && prop.rich_text?.length > 0) {
            const text = prop.rich_text[0].plain_text;
            if (/^https?:\/\/.*?\.(jpg|jpeg|png|webp|gif|svg)/i.test(text)) {
              coverUrl = text;
            }
          }

          if (coverUrl) break;
        }
      }

      // 3. 페이지 아이콘 확인
      if (!coverUrl && page.icon) {
        if (page.icon.type === 'external') coverUrl = page.icon.external.url;
        else if (page.icon.type === 'file') coverUrl = page.icon.file?.url;
      }

      // 4. 앨범 타입인데 여전히 이미지가 없으면 본문(블록) 뒤지기
      if (!coverUrl && type === 'album') {
        coverUrl = await getFirstImageFromBlocks(page.id);
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
    }));

    return new Response(JSON.stringify({ success: true, type, posts }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Function Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: '서버 내부 오류', details: error.message }), { status: 500, headers: corsHeaders });
  }
}

