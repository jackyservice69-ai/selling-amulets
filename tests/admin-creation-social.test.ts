import {beforeAll,afterAll,it,expect} from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import {app} from '../server/app.js';
import {db} from '../server/db.js';
import {config} from '../server/config.js';
import type {Prisma} from '@prisma/client';
const suffix=Date.now().toString(36),origin=config.APP_ORIGIN,secret='Admin-create-test-82!';
const accounts:Record<string,{id:string;csrf:string;client:ReturnType<typeof request.agent>}>= {};
let original:Prisma.InputJsonValue;
const write=(name:string,path:string,body:unknown,method:'post'|'put'='post')=>accounts[name].client[method](`/api${path}`).set('Origin',origin).set('X-CSRF-Token',accounts[name].csrf).send(body);
const body=(label:string,role='MEMBER')=>({username:`new_${label}_${suffix}`,password:'Member82!',confirmPassword:'Member82!',displayName:'ทดสอบเพิ่มสมาชิก',role,currentPassword:secret,reason:'ผู้ดูแลสร้างบัญชีตามคำขอ'});
beforeAll(async()=>{
 expect(new URL(config.DATABASE_URL).pathname.endsWith('_test')).toBe(true);
 original=(await db.siteSetting.findUniqueOrThrow({where:{id:'site'}})).value as Prisma.InputJsonValue;
 const hash=await bcrypt.hash(secret,12);
 for(const [name,role] of [['super','SUPER_ADMIN'],['manager','ADMIN'],['moderator','MODERATOR'],['member','MEMBER']] as const){
  const user=await db.user.create({data:{username:`creator_${name}_${suffix}`,passwordHash:hash,referralCode:randomUUID().slice(0,18),role:{connect:{name:role}},profile:{create:{displayName:'ทดสอบผู้สร้าง'}}}});
  const client=request.agent(app),login=await client.post('/api/auth/login').set('Origin',origin).send({username:user.username,password:secret});expect(login.status).toBe(200);accounts[name]={id:user.id,csrf:login.body.csrf,client};
 }
});
afterAll(async()=>{
 await db.siteSetting.update({where:{id:'site'},data:{value:original}});
 const users=await db.user.findMany({where:{username:{endsWith:suffix}},select:{id:true}});const ids=users.map(u=>u.id);
 await db.auditLog.deleteMany({where:{actorId:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();
});
it('restricts account creation by role and requires CSRF, confirmation and staff password',async()=>{
 expect((await request(app).post('/api/admin/users').set('Origin',origin).send(body('guest'))).status).toBe(401);
 for(const who of ['member','moderator'])expect((await write(who,'/admin/users',body(who))).status).toBe(403);
 expect((await write('manager','/admin/users',body('forbidden','ADMIN'))).status).toBe(403);
 expect((await accounts.super.client.post('/api/admin/users').set('Origin',origin).send(body('csrf'))).status).toBe(403);
 expect((await write('super','/admin/users',{...body('password'),currentPassword:'wrong'})).status).toBe(400);
 expect((await write('super','/admin/users',{...body('confirm'),confirmPassword:'different'})).status).toBe(400);
});
it('allows manager to create members while public signup is closed and super admin to create staff',async()=>{
 const settings=(await request(app).get('/api/settings')).body;
 await write('super','/admin/settings',{...settings,registrationEnabled:false},'put');
 const created=await write('manager','/admin/users',body('member'));expect(created.status).toBe(201);expect(created.body.role).toBe('MEMBER');expect(created.body.passwordHash).toBeUndefined();
 expect((await write('manager','/admin/users',body('member'))).status).toBe(409);
 for(const role of ['MODERATOR','ADMIN','SUPER_ADMIN'])expect((await write('super','/admin/users',body(role.toLowerCase(),role))).status).toBe(201);
 const stored=await db.user.findUniqueOrThrow({where:{id:created.body.id},include:{shop:true}});expect(await bcrypt.compare('Member82!',stored.passwordHash)).toBe(true);expect(stored.shop?.active).toBe(true);
 const audit=await db.auditLog.findFirstOrThrow({where:{entityId:stored.id,action:'USER_CREATED_BY_ADMIN'}});expect(JSON.stringify(audit)).not.toContain('Member82!');
});
it('accepts the requested @ username as a username and supports normal login',async()=>{
 const data={...body('at'),username:`admin@test_${suffix}`};
 expect((await write('super','/admin/users',data)).status).toBe(201);
 const result=await request(app).post('/api/auth/login').set('Origin',origin).send({username:data.username.toUpperCase(),password:data.password});expect(result.status).toBe(200);
});
it('lets managers edit HTTPS social channels without changing registration or other settings',async()=>{
 const link={id:randomUUID(),label:'Facebook',url:'https://facebook.com/example',enabled:true};
 for(const who of ['member','moderator'])expect((await write(who,'/admin/social',{socialLinks:[link]},'put')).status).toBe(403);
 expect((await write('manager','/admin/social',{socialLinks:[{...link,url:'javascript:alert(1)'}]},'put')).status).toBe(400);
 const result=await write('manager','/admin/social',{socialLinks:[link]},'put');expect(result.status).toBe(200);expect(result.body.registrationEnabled).toBe(false);
 const publicSettings=(await request(app).get('/api/settings')).body;expect(publicSettings.socialLinks).toEqual([link]);
 await write('super','/admin/settings',{...publicSettings,socialLinks:[],registrationEnabled:true},'put');expect((await request(app).get('/api/settings')).body.socialLinks).toEqual([link]);
});
