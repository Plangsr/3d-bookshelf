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

const avatarUrl =
  process.env.DISCORD_AVATAR_URL ||
  'https://appointment-scedule.vercel.app/eye-avatar.jpg';

// Discord Embed Format - Exact Signature from Appointment Schedule project, dedicated to Deploy Status
const payload = {
  username: 'The Eye of Providence',
  avatar_url: avatarUrl,
  embeds: [
    {
      title: isSuccess 
        ? '✨ พันธนาการถูกปลดปล่อย! Vercel Deploy สำเร็จเรียบร้อย'
        : '💥 พิธีกรรมขัดข้อง! Vercel Deploy ล้มเหลว',
      url: liveUrl,
      color: isSuccess ? 0xffd700 : 0xe74c3c, // Gold Accent like Appointment Schedule
      description: [
        isSuccess
          ? '🔮 **เนตรแห่งโชคชะตาตรวจพบการ Deploy ใหม่ขึ้นสู่ Production เรียบร้อย**'
          : '⚠️ **เนตรแห่งโชคชะตาตรวจพบข้อผิดพลาดในการ Deploy**',
        '',
        '```yaml',
        commitMsg,
        '```'
      ].join('\n'),
      fields: [
        {
          name: '🌌 ข้อมูลมิติ & สาขา',
          value: `• **คลัง:** \`${repo}\`\n• **สาขา:** \`${branch}\``,
          inline: true
        },
        {
          name: '🧙‍♂️ ผู้ร่ายมนตรา',
          value: `• **ผู้ทำรายการ:** \`${author}\``,
          inline: true
        },
        {
          name: '🔗 บันทึก & ทางเข้ามิติ',
          value: `[🌐 เปิดหน้าเว็บระบบ](${liveUrl})  •  [📜 ตรวจสอบ Commit \`${commitSha}\`](${commitUrl})`,
          inline: false
        }
      ],
      footer: {
        text: 'เนตรลิขิตสวรรค์ คลื่นจักรพรรดิไร้พ่าย • Vercel Watcher'
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
      console.log('Successfully sent Discord notification:', res.statusCode);
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
