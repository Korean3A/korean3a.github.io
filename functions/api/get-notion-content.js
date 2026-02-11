/**
 * Cloudflare Function: 특정 Notion 페이지의 상세 내용(블록) 가져오기
 * 쿼리 파라미터: ?pageId=xxxx
 */
export async function onRequest(context) {
    const { env, request } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const getEnv = (keyName) => {
            const realKey = Object.keys(env).find(k => k.trim() === keyName);
            return (env[realKey || keyName] || '').trim();
        };

        const NOTION_API_KEY = getEnv('NOTION_API_KEY');
        const url = new URL(request.url);
        const pageId = url.searchParams.get('pageId');

        if (!NOTION_API_KEY || !pageId) {
            return new Response(JSON.stringify({ success: false, error: '필수 매개변수가 누락되었습니다.' }), { status: 400, headers: corsHeaders });
        }

        // 1. 페이지 정보 가져오기 (제목, 작성 시간 등)
        const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28',
            }
        });

        if (!pageRes.ok) throw new Error('페이지 정보를 가져오는데 실패했습니다.');
        const pageData = await pageRes.json();

        // 2. 블록(본문) 가져오기
        const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28',
            }
        });

        if (!blocksRes.ok) throw new Error('블록 정보를 가져오는데 실패했습니다.');
        const blocksData = await blocksRes.json();

        return new Response(JSON.stringify({
            success: true,
            page: pageData,
            blocks: blocksData.results
        }), { status: 200, headers: corsHeaders });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
    }
}
