/* Wheaterflow Google Cast sender/receiver bridge.
   Uses the official Cast SDKs when available and stays inert elsewhere. */
(function(){
  const NAMESPACE = 'urn:x-cast:be.wheaterflow.tv';
  const SENDER_SDK = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  const RECEIVER_SDK = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';

  function loadScriptOnce(src){
    return new Promise((resolve, reject)=>{
      const existing = document.querySelector(`script[src="${src}"]`);
      if(existing){
        if(existing.dataset.loaded === 'true') resolve();
        else{
          existing.addEventListener('load', resolve, {once:true});
          existing.addEventListener('error', reject, {once:true});
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = ()=>{ script.dataset.loaded = 'true'; resolve(); };
      script.onerror = ()=>reject(new Error(`Script kon niet worden geladen: ${src}`));
      document.head.appendChild(script);
    });
  }

  function parseMaybeJson(data){
    if(typeof data === 'string'){
      try{ return JSON.parse(data); }catch(e){ return null; }
    }
    return data && typeof data === 'object' ? data : null;
  }

  function normalizeLocation(input){
    const source = input || {};
    const lat = Number(source.latitude ?? source.lat);
    const lon = Number(source.longitude ?? source.lon);
    if(!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return {
      name: String(source.name || 'Geselecteerde locatie').slice(0, 90),
      admin: String(source.admin || source.region || '').slice(0, 120),
      country: String(source.country || '').slice(0, 80),
      latitude: lat,
      longitude: lon
    };
  }

  function locationFromUrl(){
    const params = new URLSearchParams(location.search);
    const loc = normalizeLocation({
      latitude: params.get('lat'),
      longitude: params.get('lon'),
      name: params.get('name'),
      admin: params.get('admin'),
      country: params.get('country')
    });
    return loc;
  }

  function isReceiverMode(){
    const params = new URLSearchParams(location.search);
    const path = location.pathname.replace(/\/+$/, '');
    return params.get('castReceiver') === '1' || params.get('tv') === 'cast' || path.endsWith('/tv');
  }

  function create(options){
    const callbacks = options || {};
    let config = null;
    let castContext = null;
    let currentSession = null;
    let receiverContext = null;
    let senderSdkPromise = null;

    const setStatus = (status, detail)=>callbacks.onStatus?.(status, detail || {});
    const getLocation = ()=>normalizeLocation(callbacks.getLocation?.());

    async function fetchConfig(){
      if(config) return config;
      const urls = callbacks.configUrls || [];
      for(const url of urls){
        try{
          const response = await fetch(url, {cache:'no-store'});
          if(!response.ok) continue;
          const data = await response.json();
          if(data && typeof data === 'object'){
            config = {
              configured:Boolean(data.configured && data.appId),
              appId:data.appId || '',
              receiverUrl:data.receiverUrl || ''
            };
            return config;
          }
        }catch(error){
          console.warn('Cast configuratie kon niet worden geladen', {url, error});
        }
      }
      config = {configured:false, appId:'', receiverUrl:''};
      return config;
    }

    function receiverUrlForLocation(loc=getLocation()){
      const base = config?.receiverUrl ? new URL(config.receiverUrl) : new URL('./', location.href);
      if(!config?.receiverUrl){
        base.pathname = base.pathname.endsWith('/') ? base.pathname : base.pathname.replace(/[^/]*$/, '');
      }
      base.searchParams.set('castReceiver', '1');
      if(loc){
        base.searchParams.set('lat', String(loc.latitude));
        base.searchParams.set('lon', String(loc.longitude));
        base.searchParams.set('name', loc.name);
        if(loc.admin) base.searchParams.set('admin', loc.admin);
        if(loc.country) base.searchParams.set('country', loc.country);
      }
      return base.href;
    }

    async function initSender(){
      const cfg = await fetchConfig();
      if(!cfg.configured){
        setStatus('unconfigured');
        return false;
      }
      if(!('chrome' in window) && !('cast' in window)){
        // The SDK may still define the globals after loading, so this is only informational.
        setStatus('loading');
      }
      if(!senderSdkPromise){
        senderSdkPromise = new Promise(resolve=>{
          const previous = window.__onGCastApiAvailable;
          window.__onGCastApiAvailable = (available, errorInfo)=>{
            if(typeof previous === 'function') previous(available, errorInfo);
            resolve(Boolean(available));
          };
          loadScriptOnce(SENDER_SDK).catch(error=>{
            console.warn('Google Cast sender SDK kon niet laden', error);
            resolve(false);
          });
          setTimeout(()=>resolve(Boolean(window.cast?.framework && window.chrome?.cast)), 4500);
        });
      }
      const available = await senderSdkPromise;
      if(!available || !window.cast?.framework || !window.chrome?.cast){
        setStatus('unavailable');
        return false;
      }
      try{
        castContext = window.cast.framework.CastContext.getInstance();
        castContext.setOptions({
          receiverApplicationId: cfg.appId,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
          resumeSavedSession:true
        });
        castContext.addEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          event=>handleSessionState(event.sessionState)
        );
        currentSession = castContext.getCurrentSession?.() || null;
        if(currentSession){
          setStatus('connected', {deviceName:receiverName(currentSession)});
          sendLocation({reason:'resume'});
        }else{
          setStatus('ready');
        }
        return true;
      }catch(error){
        console.warn('Google Cast initialisatie faalde', error);
        setStatus('error', {message:'Cast kon niet worden gestart'});
        return false;
      }
    }

    function receiverName(session){
      return session?.getCastDevice?.()?.friendlyName || 'tv';
    }

    function handleSessionState(sessionState){
      const states = window.cast?.framework?.SessionState || {};
      if(sessionState === states.SESSION_STARTING || sessionState === states.SESSION_RESUMING){
        setStatus('connecting');
        return;
      }
      if(sessionState === states.SESSION_STARTED || sessionState === states.SESSION_RESUMED){
        currentSession = castContext?.getCurrentSession?.() || null;
        setStatus('connected', {deviceName:receiverName(currentSession)});
        setTimeout(()=>sendLocation({reason:'session-start'}), 450);
        setTimeout(()=>sendLocation({reason:'session-start-retry'}), 1400);
        return;
      }
      if(sessionState === states.SESSION_ENDED){
        currentSession = null;
        setStatus('disconnected');
        return;
      }
      if(sessionState === states.SESSION_START_FAILED){
        currentSession = null;
        setStatus('error', {message:'Kan geen verbinding maken'});
      }
    }

    async function requestSession(){
      const ok = await initSender();
      if(!ok || !castContext) return false;
      try{
        setStatus('connecting');
        await castContext.requestSession();
        currentSession = castContext.getCurrentSession?.() || null;
        if(currentSession){
          setStatus('connected', {deviceName:receiverName(currentSession)});
          await sendLocation({reason:'manual-start'});
        }
        return Boolean(currentSession);
      }catch(error){
        if(error !== 'cancel') console.warn('Cast sessie starten faalde', error);
        setStatus('error', {message:'Kan geen verbinding maken'});
        return false;
      }
    }

    async function sendMessage(message){
      const session = currentSession || castContext?.getCurrentSession?.();
      if(!session) return false;
      try{
        await session.sendMessage(NAMESPACE, message);
        return true;
      }catch(error){
        console.warn('Cast bericht kon niet worden verzonden', error);
        setStatus('error', {message:'Bericht naar tv kon niet worden verzonden'});
        return false;
      }
    }

    async function sendLocation(extra={}){
      const location = getLocation();
      if(!location) return false;
      return sendMessage({
        type:'SET_LOCATION',
        location,
        receiverUrl:receiverUrlForLocation(location),
        sentAt:new Date().toISOString(),
        ...extra
      });
    }

    async function refreshWeather(){
      return sendMessage({type:'REFRESH_WEATHER', sentAt:new Date().toISOString()});
    }

    async function ping(){
      return sendMessage({type:'PING', sentAt:new Date().toISOString()});
    }

    async function initReceiver(){
      if(!isReceiverMode()) return false;
      setStatus('receiver-loading');
      try{
        await loadScriptOnce(RECEIVER_SDK);
      }catch(error){
        console.warn('Cast receiver SDK niet beschikbaar, dev receiver blijft actief', error);
        setStatus('receiver-dev');
        return false;
      }
      if(!window.cast?.framework?.CastReceiverContext){
        setStatus('receiver-dev');
        return false;
      }
      receiverContext = window.cast.framework.CastReceiverContext.getInstance();
      receiverContext.addCustomMessageListener(NAMESPACE, async event=>{
        const message = parseMaybeJson(event.data);
        if(!message) return;
        await handleReceiverMessage(message, event.senderId);
      });
      receiverContext.start({
        disableIdleTimeout:true,
        maxInactivity:3600
      });
      setStatus('receiver-ready');
      return true;
    }

    async function handleReceiverMessage(message, senderId){
      if(message.type === 'SET_LOCATION'){
        const loc = normalizeLocation(message.location);
        if(!loc){
          sendReceiverMessage(senderId, {type:'ERROR', message:'Ongeldige locatie'});
          return;
        }
        setStatus('receiver-location', {location:loc});
        await callbacks.applyReceiverLocation?.(loc);
        sendReceiverMessage(senderId, {type:'LOCATION_APPLIED', location:loc, receivedAt:new Date().toISOString()});
        return;
      }
      if(message.type === 'REFRESH_WEATHER'){
        await callbacks.refreshReceiverWeather?.();
        sendReceiverMessage(senderId, {type:'REFRESHED', receivedAt:new Date().toISOString()});
        return;
      }
      if(message.type === 'PING'){
        sendReceiverMessage(senderId, {type:'PONG', receivedAt:new Date().toISOString()});
      }
    }

    function sendReceiverMessage(senderId, message){
      try{
        if(receiverContext && senderId) receiverContext.sendCustomMessage(NAMESPACE, senderId, message);
      }catch(error){
        console.warn('Receiver antwoord kon niet worden verzonden', error);
      }
    }

    return {
      namespace:NAMESPACE,
      fetchConfig,
      initSender,
      requestSession,
      sendLocation,
      notifyLocationChanged:()=>sendLocation({reason:'location-change'}),
      refreshWeather,
      ping,
      initReceiver,
      receiverUrlForLocation,
      isReceiverMode,
      locationFromUrl
    };
  }

  window.WheaterflowCastService = {
    create,
    isReceiverMode,
    locationFromUrl,
    normalizeLocation,
    namespace:NAMESPACE
  };
})();
