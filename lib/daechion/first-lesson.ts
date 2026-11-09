import {z} from 'zod'

const ids=z.array(z.number().int().positive().safe()).min(1).max(1000).refine(v=>new Set(v).size===v.length)
export interface LessonCourse {id:number;opened:boolean;weeklyLectures:{id:number}[]}
// Preserve the LMS's displayed sequence, never choose the smallest numeric ID.
// The browser must also confirm that this ID's label is the first visible lesson.
export function firstLessonTarget(courses:readonly LessonCourse[],lectureId:number,pinned:readonly number[]=[]):number{
  const matches=courses.filter(course=>course.id===lectureId)
  if(matches.length!==1||matches[0].opened!==true)throw Error('FIRST_LESSON_UNAVAILABLE')
  const current=ids.parse(matches[0].weeklyLectures.map(week=>week.id)),target=current[0]
  if(pinned.length&&(pinned.length!==1||pinned[0]!==target))throw Error('FIRST_LESSON_CHANGED')
  return target
}
export interface FirstLessonAccessInput {
  lectureId:number;studentId:number;weeklyLectureId:number;studentName:string;studentPhone:string
  enrollmentRecorded:boolean;beforeWrite():Promise<void>;recordEnrollment():Promise<void>
}
export interface FirstLessonAccessResult {verified:true;lectureId:number;studentId:number;weeklyLectureIds:number[]}
