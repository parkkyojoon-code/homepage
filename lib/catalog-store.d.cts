import type fs from 'node:fs'
export class CatalogStoreError extends Error {
  constructor(code:'CATALOG_CONFLICT'|'CATALOG_UNAVAILABLE'|'CATALOG_RECOVERY_NOT_REQUIRED',options?:{cause?:unknown})
  code:'CATALOG_CONFLICT'|'CATALOG_UNAVAILABLE'|'CATALOG_RECOVERY_NOT_REQUIRED'
}
export function validateCatalog<T>(value:unknown):T[]
export function atomicWrite(file:string,bytes:string|Buffer,io?:typeof fs):void
export function createCatalogStore<T>(file:string,defaults:()=>T[],options?:{fs?:typeof fs}):{
  load():{classes:T[];revision:string;bytes:Buffer}
  save(classes:T[],expectedRevision:string):string
  inspect():{main:{valid:boolean;revision?:string};backup:{valid:boolean;revision?:string};initialized:boolean;locked:boolean}
  recover():{revision:string;preserved:string|null}
  paths:{file:string;backup:string;marker:string;lock:string}
}
