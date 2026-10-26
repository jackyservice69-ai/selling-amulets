import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db.js";
import { HttpError, managerRoles } from "./security.js";
import { paging } from "./services.js";
import { text } from "./validation.js";

const statusSchema = z.enum(["OPEN", "ANSWERED", "CLOSED"]);
const messageSchema = z.object({ body: text(5000, 1), clientRequestId: z.uuid() });
const createSchema = messageSchema.extend({ subject: text(160, 3) });
const replySchema = messageSchema.extend({ version: z.number().int().positive(), status: z.enum(["ANSWERED", "CLOSED"]).optional() });
const person = { id: true, profile: { select: { displayName: true } } } satisfies Prisma.UserSelect;
const ticketInclude = { user: { select: person }, _count: { select: { messages: true } } } satisfies Prisma.SupportTicketInclude;
const writeLimit = rateLimit({
  windowMs: 15 * 60000, limit: 30, keyGenerator: req => req.user!.id,
  standardHeaders: "draft-8", legacyHeaders: false,
  message: { error: "ส่งข้อความมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" },
});

export function supportRouter(staff: boolean) {
  const router = Router();
  router.get("/", async (req, res) => {
    const {page, limit, skip} = paging(req.query);
    const status = req.query.status ? statusSchema.parse(req.query.status) : undefined;
    const where: Prisma.SupportTicketWhereInput = { ...(staff ? {} : {userId:req.user!.id}), ...(status ? {status} : {}) };
    const [items,total] = await db.$transaction([
      db.supportTicket.findMany({where,include:ticketInclude,orderBy:[{updatedAt:"desc"},{id:"desc"}],take:limit,skip}),
      db.supportTicket.count({where}),
    ]);
    res.json({items,total,page,limit});
  });
  router.get("/:id", async (req, res) => {
    const ticket = await db.supportTicket.findFirst({where:{id:String(req.params.id),...(staff ? {} : {userId:req.user!.id})},include:ticketInclude});
    if (!ticket) throw new HttpError(404,"ไม่พบเรื่องที่แจ้ง");
    const total = ticket._count.messages;
    const {page,limit,skip} = paging({page:req.query.page ?? Math.max(1,Math.ceil(total/20)),limit:20});
    const items = await db.supportMessage.findMany({where:{ticketId:ticket.id},orderBy:[{createdAt:"asc"},{id:"asc"}],take:limit,skip,
      select:{id:true,body:true,isStaff:true,createdAt:true,author:{select:person}}});
    res.json({ticket,messages:{items,total,page,limit}});
  });
  if (!staff) router.post("/",writeLimit,async (req,res) => {
    res.status(201).json(await save(req.user!.id,false,undefined,req.body));
  });
  router.post("/:id/messages",writeLimit,async (req,res) => {
    res.status(201).json(await save(req.user!.id,staff,String(req.params.id),req.body));
  });
  return router;
}

async function save(authorId:string,staff:boolean,ticketId:string|undefined,input:unknown) {
  const data = ticketId ? replySchema.parse(input) : createSchema.parse(input);
  const replay = async () => {
    const previous = await db.supportMessage.findUnique({where:{authorId_clientRequestId:{authorId,clientRequestId:data.clientRequestId}},include:{ticket:true}});
    if (!previous) return null;
    if (previous.body !== data.body || previous.isStaff !== staff || (ticketId ? previous.ticketId !== ticketId : previous.ticket.subject !== (data as z.infer<typeof createSchema>).subject))
      throw new HttpError(409,"คำขอนี้ถูกใช้กับข้อความอื่นแล้ว กรุณาโหลดเรื่องล่าสุด");
    return {id:previous.ticketId};
  };
  const previous = await replay();
  if (previous) return previous;
  try {
    return await db.$transaction(async tx => {
      // Check current permissions again inside the same transaction as the reply.
      const actor = await tx.user.findUnique({where:{id:authorId},include:{role:true}});
      if (!actor || actor.status !== "ACTIVE" || (staff && !managerRoles.includes(actor.role.name))) throw new HttpError(403,"คุณไม่มีสิทธิ์ดำเนินการ");
      let ticket;
      if (ticketId) {
        ticket = await tx.supportTicket.findFirst({where:{id:ticketId,...(staff ? {} : {userId:authorId})}});
        if (!ticket) throw new HttpError(404,"ไม่พบเรื่องที่แจ้ง");
        const reply = data as z.infer<typeof replySchema>;
        const changed = await tx.supportTicket.updateMany({where:{id:ticket.id,version:reply.version},data:{status:staff ? reply.status ?? "ANSWERED" : "OPEN",version:{increment:1},updatedAt:new Date()}});
        if (!changed.count) throw new HttpError(409,"มีข้อความใหม่ในเรื่องนี้ กรุณาโหลดเรื่องล่าสุดก่อนส่งอีกครั้ง");
      } else {
        ticket = await tx.supportTicket.create({data:{userId:authorId,subject:(data as z.infer<typeof createSchema>).subject}});
      }
      const message = await tx.supportMessage.create({data:{ticketId:ticket.id,authorId,body:data.body,isStaff:staff,clientRequestId:data.clientRequestId}});
      if (staff) {
        if (ticket.userId !== authorId) await tx.notification.create({data:{userId:ticket.userId,title:"ผู้ดูแลตอบกลับเรื่องของคุณ",body:ticket.subject,href:`/dashboard/support/${ticket.id}`,eventKey:`support:${message.id}:${ticket.userId}`}});
        await tx.auditLog.create({data:{actorId:authorId,action:"SUPPORT_REPLIED",entityId:ticket.id,detail:(data as z.infer<typeof replySchema>).status === "CLOSED" ? "ตอบกลับและปิดเรื่อง" : "ตอบกลับเรื่องที่แจ้ง"}});
      } else {
        const managers = await tx.user.findMany({where:{id:{not:authorId},status:"ACTIVE",role:{name:{in:managerRoles}}},select:{id:true}});
        if (managers.length) await tx.notification.createMany({data:managers.map(u=>({userId:u.id,title:ticketId ? "มีข้อความเพิ่มเติมจากผู้แจ้งเรื่อง" : "มีเรื่องแจ้งใหม่จากผู้ประกาศ",body:ticket.subject,href:`/admin/support/${ticket.id}`,eventKey:`support:${message.id}:${u.id}`}))});
      }
      return {id:ticket.id};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002","P2034"].includes(error.code)) {
      const repeated = await replay();
      if (repeated) return repeated;
      throw new HttpError(409,"มีการส่งข้อความพร้อมกัน กรุณาโหลดเรื่องล่าสุดแล้วลองอีกครั้ง");
    }
    throw error;
  }
}
