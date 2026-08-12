(function(){
  const STORAGE_KEY = "wheaterflow:tvPairingController";
  const TV_STORAGE_KEY = "wheaterflow:tvPairingTv";

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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

  function create(options={}){
    const apiUrls = (options.apiUrls || []).filter(Boolean);
    let apiUrl = apiUrls[0] || "/api/tv-pairing";
    let tvToken = "";
    let controllerToken = "";
    let tvPollTimer = null;
    let controllerPollTimer = null;
    let stopped = false;

    async function request(action, payload={}){
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

    function clearTimers(){
      clearTimeout(tvPollTimer);
      clearTimeout(controllerPollTimer);
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
      options.onTvCode?.(data);
      scheduleTvPoll(data.pollAfterMs || 1800);
      return data;
    }

    function scheduleTvPoll(delay=1800){
      clearTimeout(tvPollTimer);
      if(stopped || !tvToken) return;
      tvPollTimer = setTimeout(pollTv, delay);
    }

    async function pollTv(){
      if(stopped || !tvToken) return;
      try{
        const data = await request("tv-poll", {tvToken});
        options.onTvCode?.(data);
        if(data.paired) options.onTvPaired?.(data);
        for(const message of data.messages || []){
          if(message.type === "PAIRED") options.onTvPaired?.(data);
          if(message.type === "SET_LOCATION") options.onTvLocation?.(normalizeLocation(message.location));
          if(message.type === "REFRESH_WEATHER") options.onTvRefresh?.();
          if(message.type === "CONTROLLER_DISCONNECTED") options.onTvDisconnected?.();
        }
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
      options.onControllerPaired?.(data);
      scheduleControllerPoll(1200);
      const loc = normalizeLocation(options.getLocation?.());
      if(loc) await sendLocation(loc);
      return data;
    }

    function restoreController(){
      try{
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if(!saved.controllerToken) return false;
        controllerToken = saved.controllerToken;
        scheduleControllerPoll(1200);
        return true;
      }catch{
        return false;
      }
    }

    function scheduleControllerPoll(delay=3500){
      clearTimeout(controllerPollTimer);
      if(stopped || !controllerToken) return;
      controllerPollTimer = setTimeout(pollController, delay);
    }

    async function pollController(){
      if(stopped || !controllerToken) return;
      try{
        const data = await request("controller-poll", {controllerToken});
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
      hasController:()=>Boolean(controllerToken)
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
