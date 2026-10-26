import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import request from "supertest";
import { optimizeImage, imagePolicy } from "../server/images.js";
import { processUpload, getObject } from "../server/storage.js";
import { db } from "../server/db.js";
import { app } from "../server/app.js";
import { config } from "../server/config.js";

let userId="",csrf="",uploadId="",popupId="";
const client=request.agent(app);
const origin=config.APP_ORIGIN;
const small=()=>sharp({create:{width:80,height:60,channels:4,background:{r:210,g:160,b:80,alpha:0.4}}}).png().toBuffer();
beforeAll(async()=>{
  expect(new URL(config.DATABASE_URL).pathname.endsWith("_test")).toBe(true);
  const suffix=Date.now().toString(36);
  const user=await db.user.create({data:{username:`image_${suffix}`,passwordHash:await bcrypt.hash("Image-test-82!",12),referralCode:`IMG${suffix}`,role:{connect:{name:"SUPER_ADMIN"}},profile:{create:{displayName:"ทดสอบรูปภาพ"}}}});
  userId=user.id;
  const login=await client.post("/api/auth/login").set("Origin",origin).send({username:user.username,password:"Image-test-82!"});
  expect(login.status).toBe(200);csrf=login.body.csrf;
});
afterAll(async()=>{
  if(popupId)await db.popup.deleteMany({where:{id:popupId}});
  const uploads=await db.upload.findMany({where:{userId}});
  await db.user.deleteMany({where:{id:userId}});
  await Promise.all(uploads.flatMap(u=>[u.key,u.thumbnailKey]).map(key=>rm(resolve("uploads",key),{force:true})));
  await db.$disconnect();
});
describe("Optimize every upload before persistence",()=>{
  it("compresses a detailed PNG, caps dimensions and bytes, and stores only two WebP files",async()=>{
    const source=await sharp(randomBytes(1800*1200*3),{raw:{width:1800,height:1200,channels:3}}).png().toBuffer();
    const response=await client.post("/api/uploads").set("Origin",origin).set("X-CSRF-Token",csrf).attach("image",source,"detailed.png");
    expect(response.status).toBe(201);uploadId=response.body.id;
    const stored=await db.upload.findUniqueOrThrow({where:{id:uploadId}});
    const image=await getObject(stored.key),thumb=await getObject(stored.thumbnailKey);
    expect(stored.key).toMatch(/\.webp$/);expect(stored.thumbnailKey).toMatch(/-thumb\.webp$/);
    const meta=await sharp(image).metadata(), thumbnail=await sharp(thumb).metadata();
    expect(meta.format).toBe("webp");expect(meta.width).toBeLessThanOrEqual(1600);expect(meta.height).toBeLessThanOrEqual(1600);
    expect(thumbnail.format).toBe("webp");expect(thumbnail.width).toBeLessThanOrEqual(600);expect(thumbnail.height).toBeLessThanOrEqual(600);
    expect(image.length).toBeLessThanOrEqual(imagePolicy.maxBytes);expect(thumb.length).toBeLessThanOrEqual(imagePolicy.thumbnailMaxBytes);
    expect(image.length+thumb.length).toBeLessThan(source.length);
    expect(response.body.optimization).toMatchObject({format:"webp",originalBytes:source.length,imageBytes:image.length,thumbnailBytes:thumb.length});
  });
  it("serves the optimized bytes when the upload is used in a popup",async()=>{
    const result=await client.post("/api/admin/content/popups").set("Origin",origin).set("X-CSRF-Token",csrf).send({name:"optimized-test",title:"ภาพบีบอัด",body:"ทดสอบภาพประชาสัมพันธ์",imageId:uploadId,url:null,buttonText:null,active:true,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+60000).toISOString(),audience:"ALL",page:"/image-test",delaySeconds:0,maxViews:1,oncePerSession:true,intervalHours:0});
    expect(result.status).toBe(201);popupId=result.body.id;
    const media=await request(app).get(`/api/media/${uploadId}`);
    expect(media.status).toBe(200);expect(media.headers["content-type"]).toContain("image/webp");expect(media.body.length).toBeLessThanOrEqual(imagePolicy.maxBytes);
  });
  it("applies EXIF orientation, strips metadata, and does not enlarge small images",async()=>{
    const original=await sharp({create:{width:2200,height:1200,channels:3,background:"#a98743"}}).jpeg().withMetadata({orientation:6}).toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const result=await optimizeImage(original);
    const meta=await sharp(result.image).metadata();
    expect(meta.height).toBe(1600);expect(meta.width).toBeLessThan(meta.height!);expect(meta.exif).toBeUndefined();expect(meta.orientation).toBeUndefined();expect(meta.icc).toBeUndefined();
    const tiny=await optimizeImage(await small());
    expect(tiny.optimization.width).toBe(80);expect(tiny.optimization.height).toBe(60);
    expect((await sharp(tiny.image).metadata()).hasAlpha).toBe(true);
  });
  it("rejects invalid and unsupported data without creating files or database rows",async()=>{
    const count=await db.upload.count({where:{userId}});
    const files=await readdir("uploads");
    for(const buffer of [Buffer.from("not a real image"),Buffer.from('<svg width="10" height="10"></svg>'),(await small()).subarray(0,45)]) {
      const response=await client.post("/api/uploads").set("Origin",origin).set("X-CSRF-Token",csrf).attach("image",buffer,"fake.png");
      expect(response.status).toBe(400);
    }
    expect(await db.upload.count({where:{userId}})).toBe(count);expect((await readdir("uploads")).sort()).toEqual(files.sort());
  });
  it("removes newly written files if the database insert fails",async()=>{
    const files=await readdir("uploads");
    const spy=vi.spyOn(db.upload,"create").mockRejectedValueOnce(new Error("Test database failure"));
    try {await expect(processUpload(userId,await small())).rejects.toThrow("Test database failure");}finally{spy.mockRestore();}
    expect((await readdir("uploads")).sort()).toEqual(files.sort());
  });
});
