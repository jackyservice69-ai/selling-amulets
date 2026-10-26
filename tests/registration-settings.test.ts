import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../server/app.js";
import { db } from "../server/db.js";
import { config } from "../server/config.js";
import { defaultSettings } from "../server/validation.js";
import type { Prisma } from "@prisma/client";

const suffix=Date.now().toString(36),origin=config.APP_ORIGIN;
const superAdmin=request.agent(app),manager=request.agent(app),member=request.agent(app);
let csrf="",managerCsrf="",memberCsrf="",original:Prisma.InputJsonValue,settings:typeof defaultSettings;
const write=(enabled:boolean)=>superAdmin.put("/api/admin/settings").set("Origin",origin).set("X-CSRF-Token",csrf).send({...settings,registrationEnabled:enabled});
const registration=(name:string)=>request(app).post("/api/auth/register").set("Origin",origin).send({username:`reg_${name}_${suffix}`,password:"Register82!",displayName:"ผู้สมัครทดสอบ"});
beforeAll(async()=>{
  expect(new URL(config.DATABASE_URL).pathname.endsWith("_test")).toBe(true);
  original=(await db.siteSetting.findUniqueOrThrow({where:{id:"site"}})).value as Prisma.InputJsonValue;
  const hash=await bcrypt.hash("Settings82!",12);
  for(const [label,role,client] of [["super","SUPER_ADMIN",superAdmin],["admin","ADMIN",manager],["member","MEMBER",member]] as const){
    const user=await db.user.create({data:{username:`reg_${label}_${suffix}`,passwordHash:hash,referralCode:`R${label}${suffix}`,role:{connect:{name:role}},profile:{create:{displayName:"ทดสอบตั้งค่า"}}}});
    const login=await client.post("/api/auth/login").set("Origin",origin).send({username:user.username,password:"Settings82!"});expect(login.status).toBe(200);
    if(label==="super")csrf=login.body.csrf;else if(label==="admin")managerCsrf=login.body.csrf;else memberCsrf=login.body.csrf;
  }
  settings=(await request(app).get("/api/settings")).body;
});
afterAll(async()=>{
  if(original) await db.siteSetting.update({where:{id:"site"},data:{value:original}});
  const users=await db.user.findMany({where:{username:{startsWith:"reg_",endsWith:suffix}},select:{id:true}});
  await db.auditLog.deleteMany({where:{actorId:{in:users.map(u=>u.id)}}});
  await db.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  await db.$disconnect();
});
describe("Registration switch",()=>{
  it("defaults old settings to open and allows only the super admin to change it",async()=>{
    const old={...settings} as Partial<typeof settings>;delete old.registrationEnabled;
    await db.siteSetting.update({where:{id:"site"},data:{value:old}});
    expect((await request(app).get("/api/settings")).body.registrationEnabled).toBe(true);
    for(const [client,token] of [[manager,managerCsrf],[member,memberCsrf]] as const)expect((await client.put("/api/admin/settings").set("Origin",origin).set("X-CSRF-Token",token).send({...settings,registrationEnabled:false})).status).toBe(403);
    expect((await superAdmin.put("/api/admin/settings").set("Origin",origin).send(settings)).status).toBe(403);
    expect((await superAdmin.put("/api/admin/settings").set("Origin",origin).set("X-CSRF-Token",csrf).send(old)).status).toBe(400);
  });
  it("persists closed status, rejects direct signup, and keeps existing login working",async()=>{
    expect((await write(false)).status).toBe(200);
    expect((await request(app).get("/api/settings")).body.registrationEnabled).toBe(false);
    const result=await registration("blocked");expect(result.status).toBe(403);expect(result.body.error).toContain("ปิดรับสมัคร");
    expect(await db.user.count({where:{username:`reg_blocked_${suffix}`}})).toBe(0);
    const login=await request(app).post("/api/auth/login").set("Origin",origin).send({username:`reg_member_${suffix}`,password:"Settings82!"});expect(login.status).toBe(200);
    expect((await member.get("/api/auth/me")).body.user).toBeTruthy();
  });
  it("checks again after password hashing when registration closes during a request",async()=>{
    await write(true);
    const hash=await bcrypt.hash("Register82!",12);
    const spy=vi.spyOn(bcrypt,"hash").mockImplementationOnce(async()=>{await write(false);return hash;});
    try {expect((await registration("racing")).status).toBe(403);}finally{spy.mockRestore();}
    expect(await db.user.count({where:{username:`reg_racing_${suffix}`}})).toBe(0);
  });
  it("allows signup again after reopening and audits the setting change",async()=>{
    expect((await write(true)).status).toBe(200);
    expect((await registration("reopened")).status).toBe(201);
    expect((await request(app).get("/api/settings")).body.registrationEnabled).toBe(true);
    const actor=await db.user.findUniqueOrThrow({where:{username:`reg_super_${suffix}`}});
    expect(await db.auditLog.count({where:{actorId:actor.id,action:"SETTINGS_UPDATED"}})).toBeGreaterThanOrEqual(3);
  });
});
