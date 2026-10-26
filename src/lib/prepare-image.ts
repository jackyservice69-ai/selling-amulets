// Keep browser uploads below Vercel's request-body limit. The server still
// validates and optimizes every image before it reaches private object storage.
export async function prepareImage(file:File,signal:AbortSignal):Promise<File> {
  if(file.size<=3*1024*1024)return file;
  const image=await createImageBitmap(file);
  try{
    if(image.width*image.height>40000000)throw new Error("รูปภาพมีขนาดใหญ่เกินไป กรุณาลดขนาดก่อนอัปโหลด");
    for(const size of [1600,1280,1024]){
      if(signal.aborted)throw new DOMException("Aborted","AbortError");
      const scale=Math.min(1,size/image.width,size/image.height);
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("ไม่สามารถเตรียมรูปภาพได้");
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",0.86));
      if(blob && blob.size<=3*1024*1024)return new File([blob],file.name.replace(/\.[^.]+$/,".webp"),{type:blob.type});
    }
    throw new Error("ไม่สามารถลดขนาดรูปนี้ได้ กรุณาเลือกรูปใหม่");
  }finally{image.close();}
}
