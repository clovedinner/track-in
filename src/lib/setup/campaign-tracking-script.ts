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
  var script=d.createElement("script");
  script.defer=true;
  script.src=loaderUrl+(loaderUrl.indexOf("?")===-1?"?":"&")+"durl="+encode(w.location.href)+"&dref="+encode(d.referrer)+"&dt="+encode(d.title)+"&vtm="+(new Date()).getTime();
  d.head.appendChild(script);
})(window,document,encodeURIComponent,"${loaderUrl}");
</script>
<noscript><link href="${loaderUrl}?noscript=true&durl=" rel="stylesheet"></noscript>`;
}
