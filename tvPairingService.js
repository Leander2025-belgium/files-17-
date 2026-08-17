(function(){
  const STORAGE_KEY = "wheaterflow:tvPairingController";
  const TV_STORAGE_KEY = "wheaterflow:tvPairingTv";

  function cleanCode(value){
    return String(value || "").replace(/\D/g, "").slice(0, 6);
  }

  function normalizeLocation(location){
    const lat = Number(location?.latitude ?? location?.lat);
    const lon = Number(location?.longitude ?? location?.lon);
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      name:String(location?.name || "Geselecteerde locatie").slice(0, 90),
      admin:String(location?.admin || "").slice(0, 120),
      country:String(location?.country || "").slice(0, 80),
      latitude:lat,
      longitude:lon
    };
  }

  function isTvRoute(){
    const params = new URLSearchParams(location.search);
    const path = location.pathname.replace(/\/+$/, "");
    return !params.has("castReceiver") && (path.endsWith("/tv") || params.has("tv"));
  }

  function pairCodeFromUrl(){
    const params = new URLSearchParams(location.search);
    return cleanCode(params.get("pair") || params.get("tvCode"));
  }

  function defaultWsUrls(){
    const custom = window.WHEATERFLOW_TV_PAIRING_WS_URL;
    if(custom) return [custom];
    if(location.hostname === "localhost" || location.hostname === "127.0.0.1"){
      return ["ws://127.0.0.1:8787/tv-pairing"];
    }
    return ["wss://api.wheaterflow.be/tv-pairing"];
  }

  function create(options={}){
    const apiUrls = (options.apiUrls || []).filter(Boolean);
    const wsUrls = (options.wsUrls || defaultWsUrls()).filter(Boolean);
    let apiUrl = apiUrls[0] || "/api/tv-pairing";
    let activeWsUrl = "";
    let socket = null;
    let socketReady = false;
    let socketFailed = false;
    let tvToken = "";
    let controllerToken = "";
    let tvPollTimer = null;
    let controllerPollTimer = null;
    let stopped = false;
    let requestId = 0;
    const pending = new Map();

    function clearTimers(){
      clearTimeout(tvPollTimer);
      clearTimeout(controllerPollTimer);
    }

    function emitSocketMessage(data){
      if(data.type === "TV_CODE") options.onTvCode?.(data);
      if(data.type === "PAIRED") options.onTvPaired?.(data);
      if(data.type === "SET_LOCATION") options.onTvLocation?.(normalizeLocation(data.location));
      if(data.type === "REFRESH_WEATHER") options.onTvRefresh?.();
      if(data.type === "CONTROLLER_DISCONNECTED") options.onTvDisconnected?.();
      if(data.type === "CONTROLLER_STATUS") options.onControllerStatus?.(data);
    }

    function closeSocket(){
      socketReady = false;
      if(socket){
        try{ socket.close(); }catch{}
      }
      socket = null;
      for(const {reject, timer} of pending.values()){
        clearTimeout(timer);
        reject(new Error("Live TV-koppeling is verbroken"));
      }
      pending.clear();
    }

    async function connectSocket(){
      if(socketReady && socket) return true;
      if(socketFailed || !("WebSocket" in window) || !wsUrls.length) return false;

      for(const url of wsUrls){
        try{
          const ok = await new Promise(resolve=>{
            const ws = new WebSocket(url);
            let settled = false;
            const timer = setTimeout(()=>{
              if(settled) return;
              settled = true;
              try{ ws.close(); }catch{}
              resolve(false);
            }, 8000);
            ws.addEventListener("open", ()=>{
              if(settled) return;
              settled = true;
              clearTimeout(timer);
              socket = ws;
              socketReady = true;
              activeWsUrl = url;
              resolve(true);
            }, {once:true});
            ws.addEventListener("error", ()=>{
              if(settled) return;
              settled = true;
              clearTimeout(timer);
              resolve(false);
            }, {once:true});
          });
          if(ok){
            socket.addEventListener("message", event=>{
              let data = null;
              try{ data = JSON.parse(event.data); }catch{return;}
              if(data.replyTo && pending.has(data.replyTo)){
                const job = pending.get(data.replyTo);
                clearTimeout(job.timer);
                pending.delete(data.replyTo);
                if(data.ok === false) job.reject(new Error(data.error || "TV-koppeling gaf een fout"));
                else job.resolve(data);
                return;
              }
              emitSocketMessage(data);
            });
socket.addEventListener("close", ()=>{
  if(stopped) return;

  closeSocket();
  socketFailed = false;

  options.onError?.(
    new Error("Live TV-koppeling is verbroken; opnieuw verbinden...")
  );

  setTimeout(()=>{
    if(!stopped){
      connectSocket().catch(()=>{});
    }
  }, 3000);
});

return true;          }
        }catch{
          closeSocket();
        }
      }
      socketFailed = true;
      activeWsUrl = "";
      return false;
    }

    async function socketRequest(action, payload={}){
      const connected = await connectSocket();
      if(!connected || !socketReady || !socket) throw new Error("WebSocket niet beschikbaar");
      const id = String(++requestId);
      return new Promise((resolve, reject)=>{
        const timer = setTimeout(()=>{
          pending.delete(id);
          reject(new Error("Live TV-koppeling reageert niet"));
        }, 5000);
        pending.set(id, {resolve, reject, timer});
        socket.send(JSON.stringify({id, action, ...payload}));
      });
    }

    async function apiRequest(action, payload={}){
      let lastError = null;
      for(const url of apiUrls.length ? apiUrls : [apiUrl]){
        try{
          const response = await fetch(url, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            cache:"no-store",
            body:JSON.stringify({action, ...payload})
          });
          const data = await response.json().catch(()=>({}));
          if(!response.ok || data.ok === false){
            throw new Error(data.error || `TV-koppeling gaf fout ${response.status}`);
          }
          apiUrl = url;
          return data;
        }catch(error){
          lastError = error;
        }
      }
      throw lastError || new Error("TV-koppeling is niet bereikbaar");
    }

    async function request(action, payload={}){
      if(!socketFailed){
        try{
          return await socketRequest(action, payload);
        }catch(error){
          options.onError?.(error);
          socketFailed = true;
          closeSocket();
        }
      }
      return apiRequest(action, payload);
    }

    async function startTvSession(){
      stopped = false;
      const saved = JSON.parse(localStorage.getItem(TV_STORAGE_KEY) || "{}");
      if(saved.tvToken) tvToken = saved.tvToken;
      let data;
      if(tvToken){
        try{
          data = await request("tv-poll", {tvToken});
        }catch{
          tvToken = "";
          localStorage.removeItem(TV_STORAGE_KEY);
        }
      }
      if(!data){
        data = await request("create-tv-session");
        tvToken = data.tvToken;
        localStorage.setItem(TV_STORAGE_KEY, JSON.stringify({tvToken, createdAt:Date.now()}));
      }
      options.onTvCode?.({...data, transport:socketReady ? "websocket" : "polling"});
      if(!socketReady) scheduleTvPoll(data.pollAfterMs || 1800);
      return data;
    }

    function scheduleTvPoll(delay=1800){
      clearTimeout(tvPollTimer);
      if(stopped || !tvToken || socketReady) return;
      tvPollTimer = setTimeout(pollTv, delay);
    }

    async function pollTv(){
      if(stopped || !tvToken || socketReady) return;
      try{
        const data = await apiRequest("tv-poll", {tvToken});
        options.onTvCode?.(data);
        if(data.paired) options.onTvPaired?.(data);
        for(const message of data.messages || []) emitSocketMessage(message);
        scheduleTvPoll(data.pollAfterMs || 1800);
      }catch(error){
        options.onError?.(error);
        scheduleTvPoll(4000);
      }
    }

    async function pair(code){
      const cleaned = cleanCode(code);
      if(cleaned.length !== 6) throw new Error("Vul de 6 cijfers van je TV in.");
      const data = await request("pair-controller", {code:cleaned});
      controllerToken = data.controllerToken;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({controllerToken, pairedAt:Date.now()}));
      options.onControllerPaired?.({...data, transport:socketReady ? "websocket" : "polling"});
      if(!socketReady) scheduleControllerPoll(1200);
      const loc = normalizeLocation(options.getLocation?.());
      if(loc) await sendLocation(loc);
      return data;
    }

    function restoreController(){
      try{
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if(!saved.controllerToken) return false;
        controllerToken = saved.controllerToken;
        if(!socketReady) scheduleControllerPoll(1200);
        return true;
      }catch{
        return false;
      }
    }

    function scheduleControllerPoll(delay=3500){
      clearTimeout(controllerPollTimer);
      if(stopped || !controllerToken || socketReady) return;
      controllerPollTimer = setTimeout(pollController, delay);
    }

    async function pollController(){
      if(stopped || !controllerToken || socketReady) return;
      try{
        const data = await apiRequest("controller-poll", {controllerToken});
        options.onControllerStatus?.(data);
        scheduleControllerPoll(data.tvConnected ? 3500 : 6000);
      }catch(error){
        localStorage.removeItem(STORAGE_KEY);
        controllerToken = "";
        options.onControllerDisconnected?.(error);
      }
    }

    async function sendLocation(location){
      if(!controllerToken) return false;
      const loc = normalizeLocation(location || options.getLocation?.());
      if(!loc) return false;
      await request("controller-set-location", {controllerToken, location:loc});
      return true;
    }

    async function refreshTv(){
      if(!controllerToken) return false;
      await request("controller-refresh", {controllerToken});
      return true;
    }

    async function disconnect(){
      const token = controllerToken;
      controllerToken = "";
      localStorage.removeItem(STORAGE_KEY);
      clearTimeout(controllerPollTimer);
      if(token) await request("controller-disconnect", {controllerToken:token}).catch(()=>undefined);
    }

    function stop(){
      stopped = true;
      clearTimers();
      closeSocket();
    }

    return {
      startTvSession,
      pair,
      restoreController,
      sendLocation,
      notifyLocationChanged:sendLocation,
      refreshTv,
      disconnect,
      stop,
      hasController:()=>Boolean(controllerToken),
      transport:()=>socketReady ? "websocket" : "polling",
      wsUrl:()=>activeWsUrl
    };
  }

  window.WheaterflowTvPairingService = {
    create,
    isTvRoute,
    pairCodeFromUrl,
    normalizeLocation,
    cleanCode
  };
})();
