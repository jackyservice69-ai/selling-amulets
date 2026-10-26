import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { app } from "../server/app.js";
import { db } from "../server/db.js";
import { config } from "../server/config.js";

const suffix=Date.now().toString(36);
const origin=config.APP_ORIGIN;
const accounts:Record<string,{id:string;csrf:string;client:ReturnType<typeof request.agent>}>={};
let ticketId="";
const message=(body="ต้องการความช่วยเหลือเกี่ยวกับประกาศ")=>({body,clientRequestId:randomUUID()});
const write=(who:string,path:string,body:unknown)=>accounts[who].client.post(`/api${path}`).set("Origin",origin).set("X-CSRF-Token",accounts[who].csrf).send(body);
beforeAll(async()=>{
  expect(new URL(config.DATABASE_URL).pathname.endsWith("_test")).toBe(true);
  const passwordHash=await bcrypt.hash("Support-test-82!",12);
  for(const [label,role] of [["owner","MEMBER"],["other","MEMBER"],["manager","ADMIN"],["super","SUPER_ADMIN"],["moderator","MODERATOR"],["inactive","ADMIN"]] as const) {
    const user=await db.user.create({data:{username:`support_${label}_${suffix}`,passwordHash,referralCode:randomUUID().slice(0,18),role:{connect:{name:role}},profile:{create:{displayName:`ทดสอบ ${label}`}}}});
    const client=request.agent(app);
    const login=await client.post("/api/auth/login").set("Origin",origin).send({username:user.username,password:"Support-test-82!"});
    expect(login.status).toBe(200);
    accounts[label]={id:user.id,csrf:login.body.csrf,client};
  }
  await db.user.update({where:{id:accounts.inactive.id},data:{status:"SUSPENDED"}});
});
afterAll(async()=>{
  const ids=Object.values(accounts).map(a=>a.id);
  const messages=await db.supportMessage.findMany({where:{authorId:{in:ids}},select:{id:true}});
  if(messages.length) await db.notification.deleteMany({where:{OR:messages.map(m=>({eventKey:{startsWith:`support:${m.id}:`}}))}});
  await db.auditLog.deleteMany({where:{actorId:{in:ids}}});
  await db.user.deleteMany({where:{id:{in:ids}}});
  await db.$disconnect();
});
describe("Private support conversations and bell notifications",()=>{
  it("requires authentication, CSRF and valid bounded input",async()=>{
    expect((await request(app).get("/api/me/support")).status).toBe(401);
    expect((await request(app).post("/api/me/support").set("Origin",origin).send({})).status).toBe(401);
    expect((await accounts.owner.client.post("/api/me/support").set("Origin",origin).send({})).status).toBe(403);
    for(const body of [{subject:"ab",...message()},{subject:"ทดสอบ",...message(" ")},{subject:"ทดสอบ",...message("x".repeat(5001))}]) expect((await write("owner","/me/support",body)).status).toBe(400);
  });
  it("creates a private thread and notifies active managers once for a retried request",async()=>{
    const body={subject:`เรื่องทดสอบ ${suffix}`,...message(),userId:accounts.other.id,isStaff:true};
    const created=await write("owner","/me/support",body);
    expect(created.status).toBe(201);ticketId=created.body.id;
    expect((await write("owner","/me/support",body)).body.id).toBe(ticketId);
    const ticket=await db.supportTicket.findUniqueOrThrow({where:{id:ticketId},include:{messages:true}});
    expect(ticket.userId).toBe(accounts.owner.id);expect(ticket.messages).toHaveLength(1);expect(ticket.messages[0].isStaff).toBe(false);
    for(const role of ["manager","super"]) {
      const notices=await db.notification.findMany({where:{userId:accounts[role].id,href:`/admin/support/${ticketId}`}});
      expect(notices).toHaveLength(1);expect(notices[0].readAt).toBeNull();
    }
    for(const role of ["other","moderator","inactive"]) expect(await db.notification.count({where:{userId:accounts[role].id,href:`/admin/support/${ticketId}`}})).toBe(0);
  });
  it("prevents reading or replying to another member's conversation and denies moderators",async()=>{
    const other=await accounts.other.client.get("/api/me/support");
    expect(other.body.items.some((t:{id:string})=>t.id===ticketId)).toBe(false);
    expect((await accounts.other.client.get(`/api/me/support/${ticketId}`)).status).toBe(404);
    expect((await write("other",`/me/support/${ticketId}/messages`,{...message(),version:1})).status).toBe(404);
    for(const who of ["owner","moderator"]) {
      expect((await accounts[who].client.get("/api/admin/support")).status).toBe(403);
      expect((await accounts[who].client.get(`/api/admin/support/${ticketId}`)).status).toBe(403);
      expect((await write(who,`/admin/support/${ticketId}/messages`,{...message(),version:1})).status).toBe(403);
    }
    expect((await accounts.inactive.client.get("/api/admin/support")).status).toBe(401);
    const allowed=await accounts.manager.client.get(`/api/admin/support/${ticketId}`);
    expect(allowed.status).toBe(200);expect(JSON.stringify(allowed.body)).not.toMatch(/passwordHash|referralCode|username/);
  });
  it("supports two-way replies, close and reopen, with direct bell links and audit history",async()=>{
    const reply={...message("ผู้ดูแลรับเรื่องและกำลังตรวจสอบให้ครับ"),version:1,status:"ANSWERED"};
    expect((await write("super",`/admin/support/${ticketId}/messages`,reply)).status).toBe(201);
    expect((await write("super",`/admin/support/${ticketId}/messages`,reply)).status).toBe(201);
    let detail=(await accounts.owner.client.get(`/api/me/support/${ticketId}`)).body;
    expect(detail.ticket.status).toBe("ANSWERED");expect(detail.messages.total).toBe(2);
    const bell=await accounts.owner.client.get("/api/me/notifications");
    const notice=bell.body.items.find((n:{href:string})=>n.href===`/dashboard/support/${ticketId}`);
    expect(notice.title).toBe("ผู้ดูแลตอบกลับเรื่องของคุณ");expect(notice.readAt).toBeNull();
    expect((await write("owner",`/me/support/${ticketId}/messages`,{...message("รายละเอียดเพิ่มเติมจากผู้แจ้ง"),version:2,status:"CLOSED"})).status).toBe(201);
    expect((await db.supportTicket.findUniqueOrThrow({where:{id:ticketId}})).status).toBe("OPEN");
    expect((await write("manager",`/admin/support/${ticketId}/messages`,{...message("แก้ไขเรียบร้อยและปิดเรื่องแล้ว"),version:3,status:"CLOSED"})).status).toBe(201);
    detail=(await accounts.owner.client.get(`/api/me/support/${ticketId}`)).body;expect(detail.ticket.status).toBe("CLOSED");
    expect((await write("owner",`/me/support/${ticketId}/messages`,{...message("ขอเปิดเรื่องเพื่อตรวจสอบอีกครั้ง"),version:4})).status).toBe(201);
    expect((await db.supportTicket.findUniqueOrThrow({where:{id:ticketId}})).status).toBe("OPEN");
    expect(await db.auditLog.count({where:{entityId:ticketId,action:"SUPPORT_REPLIED"}})).toBe(2);
    expect((await write("other","/me/notifications/read",{id:notice.id})).status).toBe(200);
    expect((await db.notification.findUniqueOrThrow({where:{id:notice.id}})).readAt).toBeNull();
    await write("owner","/me/notifications/read",{id:notice.id});
    expect((await db.notification.findUniqueOrThrow({where:{id:notice.id}})).readAt).not.toBeNull();
  });
  it("rejects stale versions and accepts only one of simultaneous replies",async()=>{
    const before=await db.supportMessage.count({where:{ticketId}});
    expect((await write("manager",`/admin/support/${ticketId}/messages`,{...message(),version:1})).status).toBe(409);
    const version=(await db.supportTicket.findUniqueOrThrow({where:{id:ticketId}})).version;
    const responses=await Promise.all([write("manager",`/admin/support/${ticketId}/messages`,{...message("คำตอบแรก"),version}),write("super",`/admin/support/${ticketId}/messages`,{...message("คำตอบที่สอง"),version})]);
    expect(responses.map(r=>r.status).sort()).toEqual([201,409]);
    expect(await db.supportMessage.count({where:{ticketId}})).toBe(before+1);
  });
  it("paginates the latest messages and validates filters without exposing other owners",async()=>{
    const now=Date.now();
    await db.supportMessage.createMany({data:Array.from({length:25},(_,i)=>({ticketId,authorId:accounts.owner.id,body:`ข้อความหน้าเก่า ${i}`,clientRequestId:randomUUID(),createdAt:new Date(now+i)}))});
    const latest=await accounts.owner.client.get(`/api/me/support/${ticketId}`);
    expect(latest.status).toBe(200);expect(latest.body.messages.page).toBe(2);expect(latest.body.messages.items.length).toBeLessThanOrEqual(20);
    const first=await accounts.owner.client.get(`/api/me/support/${ticketId}?page=1`);expect(first.body.messages.items).toHaveLength(20);
    expect((await accounts.owner.client.get("/api/me/support?status=INVALID")).status).toBe(400);
    const filtered=await accounts.manager.client.get("/api/admin/support?status=ANSWERED&limit=1");
    expect(filtered.status).toBe(200);expect(filtered.body.items).toHaveLength(1);expect(filtered.body.items[0].status).toBe("ANSWERED");
  });
  it("limits repeated writes per sender without blocking thread reads",async()=>{
    let limited=false;
    for(let i=0;i<31;i++){const response=await write("other","/me/support",{});if(response.status===429){limited=true;break;}expect(response.status).toBe(400);}
    expect(limited).toBe(true);expect((await accounts.other.client.get("/api/me/support")).status).toBe(200);
  });
});
