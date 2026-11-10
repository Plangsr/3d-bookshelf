import https from 'https';

const webhookUrl = process.env.DISCORD_WEBHOOK;
if (!webhookUrl) {
  console.log('No DISCORD_WEBHOOK secret provided. Skipping Discord notification.');
  process.exit(0);
}

const status = (process.env.DEPLOY_STATUS || 'SUCCESS').toUpperCase();
const isSuccess = status === 'SUCCESS';

const repo = process.env.REPO || 'Plangsr/3d-bookshelf';
const branch = process.env.BRANCH || 'main';
const author = process.env.COMMIT_AUTHOR || 'Plangsr';
const commitMsg = (process.env.COMMIT_MSG || 'Update').trim();
const commitUrl = process.env.COMMIT_URL || `https://github.com/${repo}`;
const commitSha = (process.env.COMMIT_SHA || '0000000').slice(0, 7);
const liveUrl = 'https://3d-bookshelf-eosin.vercel.app';
const runUrl = process.env.RUN_URL || `https://github.com/${repo}/actions`;

const avatarUrl =
  process.env.DISCORD_AVATAR_URL ||
  'https://appointment-scedule.vercel.app/eye-avatar.jpg';

const embedColor = isSuccess ? 0x2ecc71 : 0xe74c3c; // สีเขียวเมื่อสำเร็จ, สีแดงเมื่อล้มเหลว
const statusEmoji = isSuccess ? '🚀' : '💥';
const statusBadge = isSuccess ? '✅ DEPLOYMENT SUCCESSFUL' : '❌ DEPLOYMENT FAILED';

// Discord Embed Format - Exact layout matching the requested Deployment Status Card
const payload = {
  username: 'The Eye of Providence',
  avatar_url: avatarUrl,
  embeds: [
    {
      title: `${statusEmoji} ${statusBadge}`,
      url: liveUrl,
      color: embedColor,
      description: isSuccess
        ? [
            '🌐 **ระบบได้ทำการ Build & Deploy ขึ้น Production สำเร็จและออนไลน์แล้ว!**',
            '',
            '```yaml',
            `Status: 200 OK - Production Live`,
            `Target: ${liveUrl}`,
            `Commit: ${commitMsg}`,
            '```'
          ].join('\n')
        : [
            '⚠️ **การ Deploy ขึ้นระบบขัดข้อง กรุณาตรวจสอบบันทึกข้อผิดพลาด**',
            '',
            '```yaml',
            `Status: Build / Deploy Error`,
            `Commit: ${commitMsg}`,
            '```'
          ].join('\n'),
      fields: [
        {
          name: '📡 สถานะระบบ (Live Status)',
          value: isSuccess ? '🟢 **ONLINE & READY**' : '🔴 **FAILED / OFFLINE**',
          inline: true
        },
        {
          name: '🌿 สาขา & มิติ',
          value: `\`${branch}\` (\`${commitSha}\`)`,
          inline: true
        },
        {
          name: '🧙‍♂️ ผู้ทำรายการ',
          value: `\`${author}\``,
          inline: true
        },
        {
          name: '🔗 ลิงก์ตรวจสอบด่วน',
          value: `[🌐 เปิดหน้าเว็บที่ Deploy แล้ว](${liveUrl})  •  [📜 ดูบันทึก CI/CD Logs](${runUrl})`,
          inline: false
        }
      ],
      footer: {
        text: 'เนตรลิขิตสวรรค์ คลื่นจักรพรรดิไร้พ่าย • Vercel Deployment Watcher'
      },
      timestamp: new Date().toISOString()
    }
  ]
};

const data = JSON.stringify(payload);
const urlObj = new URL(webhookUrl);

const req = https.request(
  {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  },
  (res) => {
    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
      console.log('Successfully sent Discord deployment status notification:', res.statusCode);

      process.exit(0);
    } else {
      console.error('Failed to send Discord notification, status:', res.statusCode);
      process.exit(1);
    }
  }
);

req.on('error', (err) => {
  console.error('Error sending request:', err);
  process.exit(1);
});

req.write(data);
req.end();

