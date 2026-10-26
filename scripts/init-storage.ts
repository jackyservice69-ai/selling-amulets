import "dotenv/config";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    try {
      await client.send(
        new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }),
      );
    } catch (e) {
      if (
        e instanceof Error &&
        "$metadata" in e &&
        (e as { $metadata: { httpStatusCode?: number } }).$metadata
          .httpStatusCode === 404
      )
        await client.send(
          new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }),
        );
      else throw e;
    }
    console.log("พร้อมใช้งานพื้นที่รูปภาพแบบ private");
    break;
  } catch (e) {
    if (attempt === 11) throw e;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
