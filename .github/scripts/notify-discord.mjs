import https from 'https';

const webhookUrl = process.env.DISCORD_WEBHOOK;
if (!webhookUrl) {
  console.log('No DISCORD_WEBHOOK secret provided. Skipping Discord notification.');
  process.exit(0);
}

const status = (process.env.DEPLOY_STATUS || 'SUCCESS').toUpperCase();
const isSuccess = status === 'SUCCESS';

const projectName = '3d-bookshelf';
const commitMsg = (process.env.COMMIT_MSG || 'อัปเดตระบบชั้นหนังสือ 3D').trim();
const liveUrl = 'https://3d-bookshelf-eosin.vercel.app';
const commitSha = (process.env.COMMIT_SHA || '0000000').slice(0, 7);

const color = isSuccess ? 0xffd700 : 0xff0044; // สีทองเมื่อสำเร็จ, สีแดงเมื่อล้มเหลว
const statusTitle = isSuccess
  ? '✨ พันธนาการถูกปลดปล่อย! Deploy สำเร็จลุล่วง 🚀'
  : '💀 หายนะแห่งความว่างเปล่า! Deploy ล้มเหลว ❌';

// Exact payload structure matching Appointment Schedule's Vercel Webhook notification
const payload = {
  username: 'The Eye of Providence',
  avatar_url: 'https://appointment-scedule.vercel.app/eye-avatar.jpg',
  embeds: [
    {
      title: statusTitle,
      description: `**ดินแดน:** \`${projectName}\`\n**พันธสัญญา (Commit):** ${commitMsg}`,
      url: liveUrl,
      color: color,
      fields: [
        { 
          name: '🌐 ทางเข้ามิติ (URL)', 
          value: liveUrl, 
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
      console.log('Successfully sent Discord deployment notification:', res.statusCode);
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
