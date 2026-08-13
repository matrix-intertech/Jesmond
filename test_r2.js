const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function listR2() {
  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: 'https://435d66be7cfdabda8bb6082a4d2c681a.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: '458aa008cb86a61a0027f4fac8258210',
        secretAccessKey: 'e83d2382ea704b1c08dd4411647d5e61ab524712c448aa85bf8fc433a9845931'
      }
    });

    const data = await s3.send(new ListObjectsV2Command({ Bucket: 'jesmond-uploads' }));
    console.log("Objects:", data.Contents ? data.Contents.map(c => c.Key) : "None");
  } catch (e) {
    console.error("Error:", e.message);
  }
}
listR2();
