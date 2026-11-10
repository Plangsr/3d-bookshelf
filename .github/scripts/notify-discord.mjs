import https from 'https';

const webhookUrl = process.env.DISCORD_WEBHOOK;
if (!webhookUrl) {
  console.log('No DISCORD_WEBHOOK secret provided. Skipping Discord notification.');
  process.exit(0);
}

const repo = process.env.REPO || 'Plangsr/3d-bookshelf';
const branch = process.env.BRANCH || 'main';
const author = process.env.COMMIT_AUTHOR || 'Plangsr';
const commitMsg = (process.env.COMMIT_MSG || 'Update').trim();
const commitUrl = process.env.COMMIT_URL || `https://github.com/${repo}`;
const commitSha = (process.env.COMMIT_SHA || '0000000').slice(0, 7);
const liveUrl = 'https://3d-bookshelf-delta.vercel.app';

// Discord Embed Format - Clean, Premium Editorial Typography
const payload = {
  username: 'The Complete Shelf Keeper',
  avatar_url: 'https://images.unsplash.com/photo-1507842229450-79050d402b8b?auto=format&fit=crop&w=256&q=80',
  embeds: [
    {
      title: '📚 อัปเดตหอสมุด The Complete Shelf สำเร็จแล้ว!',
      url: liveUrl,
      color: 0xe8c170, // Warm Gold Accent
      description: [
        '✨ **ชั้นหนังสือ 3D และระบบสแกนเนอร์ได้รับการอัปเดตขึ้นสู่ Production เรียบร้อย**',
        '',
        '```yaml',
        commitMsg,
        '```'
      ].join('\n'),
      fields: [
        {
          name: '📖 ข้อมูลคลัง & สาขา',
          value: `• **คลัง:** \`${repo}\`\n• **สาขา:** \`${branch}\``,
          inline: true
        },
        {
          name: '✍️ ผู้ประพันธ์การเปลี่ยนแปลง',
          value: `• **ผู้ทำรายการ:** \`${author}\``,
          inline: true
        },
        {
          name: '🔗 ทางเข้าชมชั้นหนังสือ & ประวัติ',
          value: `[🌐 เปิดหน้าชั้นหนังสือ 3D](${liveUrl})  •  [📜 ตรวจสอบ Commit \`${commitSha}\`](${commitUrl})`,
          inline: false
        }
      ],
      footer: {
        text: 'The Complete Shelf • 3D Editorial Library & Scanner'
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
