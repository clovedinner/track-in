function normalizeTrackerBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Tracker base URL must be a valid URL."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Tracker base URL must use HTTP or HTTPS.");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

/** Build the offer-page loader used by the client's GTM Custom HTML tag. */
export function buildCampaignTrackingScript(trackerBaseUrl: string): string {
  const baseUrl = normalizeTrackerBaseUrl(trackerBaseUrl);
  const loaderUrl = `${baseUrl}/g/.js`;
  return `<meta http-equiv="delegate-ch" content="sec-ch-ua ${baseUrl}; sec-ch-ua-mobile ${baseUrl}; sec-ch-ua-arch ${baseUrl}; sec-ch-ua-model ${baseUrl}; sec-ch-ua-platform ${baseUrl}; sec-ch-ua-platform-version ${baseUrl}; sec-ch-ua-bitness ${baseUrl}; sec-ch-ua-full-version-list ${baseUrl}; sec-ch-ua-full-version ${baseUrl}">
<style>.dtpcnt{opacity:0;}</style>
<script>
(function(w,d,encode,loaderUrl){
  var callbackName="dtpCallback";
  if (w[callbackName]) return;
  w[callbackName]={state:{callbackQueue:[]},loaderVersion:"1.0",registerConversion:function(event){this.state.callbackQueue.push(event)}};
  w.trackIn=w.trackIn||{};
  function publish(cid){
    w.trackIn.cid=cid||null;
    if(cid){
      try{d.cookie="trackin_cid="+encode(cid)+"; Max-Age=2592000; Path=/; SameSite=Lax"+(w.location.protocol==="https:"?"; Secure":"");}catch(_e){}
      try{
        var visibleUrl=new URL(w.location.href);
        visibleUrl.searchParams.set("cid",cid);
        w.history.replaceState(w.history.state,"",visibleUrl.toString());
      }catch(_e){}
      w.dataLayer=w.dataLayer||[];
      w.dataLayer.push({event:"trackin_cid_ready",clickId:cid});
    }
  }
  var pageParams=new URLSearchParams(w.location.search);
  var existingCid=pageParams.get("cid")||w.localStorage.getItem("trackin_cid");
  if(existingCid){
    w.localStorage.setItem("trackin_cid",existingCid);
    publish(existingCid);
  } else {
    var scriptOrigin="";
    try{scriptOrigin=new URL(loaderUrl).origin;}catch(_e){}
    var currentScript=d.currentScript;
    if(!scriptOrigin&&currentScript){try{scriptOrigin=new URL(currentScript.src).origin;}catch(_e){}}
    var campaignId=pageParams.get("cpid");
    var offerId=pageParams.get("oid");
    if(scriptOrigin&&campaignId){
      var clickUrl=scriptOrigin+"/g/click?cpid="+encode(campaignId)+(offerId?"&oid="+encode(offerId):"");
      pageParams.forEach(function(value,key){
        if(key!=="cpid"&&key!=="oid"&&key!=="cid") clickUrl+="&"+encode(key)+"="+encode(value);
      });
      w.trackInDirectClick=function(payload){
        if(!payload||typeof payload.cid!=="string"||!payload.cid){publish(null);return;}
        w.localStorage.setItem("trackin_cid",payload.cid);
        publish(payload.cid);
      };
      var clickScript=d.createElement("script");
      clickScript.async=true;
      clickScript.src=clickUrl+"&callback=trackInDirectClick";
      clickScript.onerror=function(){publish(null);};
      d.head.appendChild(clickScript);
    } else publish(null);
  }
  var script=d.createElement("script");
  script.defer=true;
  script.src=loaderUrl+(loaderUrl.indexOf("?")===-1?"?":"&")+"durl="+encode(w.location.href)+"&dref="+encode(d.referrer)+"&dt="+encode(d.title)+"&vtm="+(new Date()).getTime();
  d.head.appendChild(script);
})(window,document,encodeURIComponent,"${loaderUrl}");
</script>
<noscript><link href="${loaderUrl}?noscript=true&durl=" rel="stylesheet"></noscript>`;
}
