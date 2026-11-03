import { z } from 'zod'

export const credentials = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{4,30}$/, '아이디는 영문, 숫자, 밑줄 4~30자입니다.'),
  password: z.string().min(10, '비밀번호는 10자 이상입니다.').max(128),
})
export const registration = credentials.extend({
  name: z.string().trim().min(1).max(50),
  phone: z.string().transform(v => v.replace(/[ -]/g, '')).pipe(z.string().regex(/^010\d{8}$/)),
})
export const orderInput = z.object({
  items: z.array(z.object({lectureId:z.string().uuid(),expectedPriceWon:z.number().int().positive().max(2147483647)}).strict()).min(1).max(50)
    .refine(items=>new Set(items.map(i=>i.lectureId)).size===items.length,'중복 강의가 있습니다.'),
  requestKey: z.string().uuid(),
  expectedTotalWon: z.number().int().positive().max(2147483647),
  billingRecipient:z.object({type:z.enum(['SELF','GUARDIAN']),name:z.string().trim().min(1).max(50),
    phone:z.string().transform(v=>v.replace(/[ -]/g,'')).pipe(z.string().regex(/^010\d{8}$/,'휴대전화 번호를 확인해주세요.'))}).strict(),
}).strict()
