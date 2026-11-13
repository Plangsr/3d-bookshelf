import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { type, payload } = await request.json().catch(() => ({}));
    const DEFAULT_DISCORD_WEBHOOK = 'https://discordapp.com/api/webhooks/1569451736224235641/UAMoEqRBEjeOpbA4t51Vb03uUlHxZAZBzD6s7DpeKcFTVRh0wHsjDcJsbT6WVaplJ9kD';
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK || DEFAULT_DISCORD_WEBHOOK;

    if (!DISCORD_WEBHOOK_URL) {
      console.warn('DISCORD_WEBHOOK_URL is not set in environment variables');
      return NextResponse.json({ ok: false, error: 'DISCORD_WEBHOOK_URL not configured' }, { status: 500 });
    }

    let color = 0x8a2be2; // ม่วงเข้มเวทมนตร์ (Deploy Created / Building)
    let statusTitle = '🔮 เนตรแห่งโชคชะตาตรวจพบการร่ายเวทย์ (Deploy Created)';

    if (type === 'deployment.succeeded' || type === 'deployment.ready') {
      color = 0xffd700; // สีทองแห่งโชคลาภ
      statusTitle = '✨ พันธนาการถูกปลดปล่อย! Deploy สำเร็จลุล่วง 🚀';
    } else if (type === 'deployment.error') {
      color = 0xff0044; // สีแดงอาถรรพ์
      statusTitle = '💀 หายนะแห่งความว่างเปล่า! Deploy ล้มเหลว ❌';
    }

    const projectName = payload?.project?.name || payload?.name || '3d-bookshelf';
    const deploymentUrl = payload?.url ? `https://${payload.url}` : 'https://3d-bookshelf-eosin.vercel.app';
    const commitMsg = payload?.deployment?.meta?.githubCommitMessage || 'อัปเดตระบบชั้นหนังสือ 3D';

    const body = {
      username: 'The Eye of Providence',
      avatar_url: 'https://appointment-scedule.vercel.app/eye-avatar.jpg',
      embeds: [
        {
          title: statusTitle,
          description: `**ดินแดน:** \`${projectName}\`\n**พันธสัญญา (Commit):** ${commitMsg}`,
          url: deploymentUrl,
          color: color,
          fields: [
            { name: '🌐 ทางเข้ามิติ (URL)', value: deploymentUrl || 'N/A', inline: false }
          ],
          footer: {
            text: 'เนตรลิขิตสวรรค์ คลื่นจักรพรรดิไร้พ่าย • Vercel Watcher'
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Error handling vercel discord webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
