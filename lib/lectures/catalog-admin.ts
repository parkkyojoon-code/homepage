import { randomUUID } from 'node:crypto'
import { lectureEditor } from './catalog-input'
import { z } from 'zod'
import { transaction } from './db'
import { lockAdmin,type AdminActor,type QueryClient } from './admin-domain'
import { HttpError } from './http'

export const lectureUpdate=lectureEditor.extend({expectedVersion:z.number().int().nonnegative()}).strict()
export function createLecture(actor:AdminActor,input:unknown){return transaction(c=>createLectureWithinTransaction(c,actor,input))}
export async function createLectureWithinTransaction(client:QueryClient,actor:AdminActor,input:unknown){
 const d=lectureEditor.parse(input),admin=await lockAdmin(client,actor)
 const {rows}=await client.query(`INSERT INTO lectures(id,title,description,price_won,sale_status,video_url)
  VALUES($1,$2,$3,$4,$5,$6) RETURNING id,title,description,price_won,sale_status,video_url,version`,[randomUUID(),d.title,d.description,d.price_won,d.sale_status,d.video_url])
 await client.query(`INSERT INTO lecture_catalog_changes(id,lecture_id,admin_id,actor_name,action,version,before_state,after_state)
  VALUES($1,$2,$3,$4,'CREATE',0,NULL,$5::jsonb)`,[randomUUID(),rows[0].id,actor.id,admin.name,JSON.stringify(rows[0])])
 return rows[0]
}
export function updateLecture(actor:AdminActor,id:string,input:unknown){return transaction(c=>updateLectureWithinTransaction(c,actor,id,input))}
export async function updateLectureWithinTransaction(client:QueryClient,actor:AdminActor,id:string,input:unknown){
 const d=lectureUpdate.parse(input),admin=await lockAdmin(client,actor)
 const saved=await client.query('SELECT id,title,description,price_won,sale_status,video_url,version FROM lectures WHERE id=$1 FOR UPDATE',[id])
 const before=saved.rows[0]
 if(!before)throw new HttpError(404,'강의를 찾을 수 없습니다.')
 if(before.version!==d.expectedVersion)throw new HttpError(409,'다른 관리자가 이 강의를 수정했습니다. 입력한 내용은 유지됩니다. 최신 내용을 확인한 뒤 다시 수정해주세요.','LECTURE_VERSION_CONFLICT')
 const {rows}=await client.query(`UPDATE lectures SET title=$2,description=$3,price_won=$4,sale_status=$5,video_url=$6,version=version+1
   WHERE id=$1 RETURNING id,title,description,price_won,sale_status,video_url,version`,[id,d.title,d.description,d.price_won,d.sale_status,d.video_url])
 await client.query(`INSERT INTO lecture_catalog_changes(id,lecture_id,admin_id,actor_name,action,version,before_state,after_state)
   VALUES($1,$2,$3,$4,'UPDATE',$5,$6::jsonb,$7::jsonb)`,[randomUUID(),id,actor.id,admin.name,rows[0].version,JSON.stringify(before),JSON.stringify(rows[0])])
 return rows[0]
}
