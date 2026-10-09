/** Display only: never converts currencies or changes stored/charged amounts. */
export function formatMoney(value:number|string|null|undefined,currency:string|null="AUD"){
 const number=Number(value ?? 0),amount=Number.isFinite(number)?number:0,code=currency?.trim().toUpperCase();
 if(!code || !/^[A-Z]{3}$/.test(code)) return amount.toFixed(2)+" (currency not set)";
 try{return new Intl.NumberFormat("en-AU",{style:"currency",currency:code,currencyDisplay:"code"}).format(amount);}
 catch{return code+" "+amount.toFixed(2);}
}
