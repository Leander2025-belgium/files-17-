/* Small, dependency-free scheduling helpers. No weather data is cached here. */
(function(root){
 'use strict';
 let flight=null;
 function singleFlight(key,task){
  if(flight?.key===key)return flight.promise;
  const entry={key,promise:null};flight=entry;
  const isCurrent=()=>flight===entry;
  entry.promise=Promise.resolve().then(()=>task(isCurrent)).finally(()=>{if(flight===entry)flight=null;});
  return entry.promise;
 }
 const watchers=new Map();
 function cancel(name){watchers.get(name)?.disconnect();watchers.delete(name);}
 function whenVisible(name,element,task){
  cancel(name);
  if(!element)return;
  if(typeof IntersectionObserver!=='function'){task();return;}
  const observer=new IntersectionObserver(entries=>{
   if(watchers.get(name)!==observer)return;
   if(!element.isConnected){cancel(name);return;}
   if(entries.some(e=>e.isIntersecting)){cancel(name);task();}
  },{rootMargin:'300px'});
  watchers.set(name,observer);observer.observe(element);
 }
 function clearVisible(){for(const name of [...watchers.keys()])cancel(name);}
 root.WFPerformance={singleFlight,whenVisible,cancel,clearVisible};
})(typeof window==='undefined'?globalThis:window);
