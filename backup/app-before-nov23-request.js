
const years=[2000,2004,2008,2012,2016,2020,2024];

const NATIONAL_WINNER={2000:"R",2004:"R",2008:"D",2012:"D",2016:"R",2020:"D",2024:"R"};



// Electoral Votes by State FIPS across Census Reapportionment Cycles

const EV_BY_CYCLE={

  "2000":{"01":9,"02":3,"04":8,"05":6,"06":54,"08":8,"09":8,"10":3,"11":3,"12":25,"13":13,"15":4,"16":4,"17":22,"18":12,"19":7,"20":6,"21":8,"22":9,"23":4,"24":10,"25":12,"26":18,"27":10,"28":7,"29":11,"30":3,"31":5,"32":4,"33":4,"34":15,"35":5,"36":33,"37":14,"38":3,"39":21,"40":8,"41":7,"42":23,"44":4,"45":8,"46":3,"47":11,"48":32,"49":5,"50":3,"51":13,"53":11,"54":5,"55":11,"56":3},

  "2004_2008":{"01":9,"02":3,"04":10,"05":6,"06":55,"08":9,"09":7,"10":3,"11":3,"12":27,"13":15,"15":4,"16":4,"17":21,"18":11,"19":7,"20":6,"21":8,"22":9,"23":4,"24":10,"25":12,"26":17,"27":10,"28":6,"29":11,"30":3,"31":5,"32":5,"33":4,"34":15,"35":5,"36":31,"37":15,"38":3,"39":20,"40":7,"41":7,"42":21,"44":4,"45":8,"46":3,"47":11,"48":34,"49":5,"50":3,"51":13,"53":11,"54":5,"55":10,"56":3},

  "2012_2020":{"01":9,"02":3,"04":11,"05":6,"06":55,"08":9,"09":7,"10":3,"11":3,"12":29,"13":16,"15":4,"16":4,"17":20,"18":11,"19":6,"20":6,"21":8,"22":8,"23":4,"24":10,"25":11,"26":16,"27":10,"28":6,"29":10,"30":3,"31":5,"32":6,"33":4,"34":14,"35":5,"36":29,"37":15,"38":3,"39":18,"40":7,"41":7,"42":20,"44":4,"45":9,"46":3,"47":11,"48":38,"49":6,"50":3,"51":13,"53":12,"54":5,"55":10,"56":3},

  "2024":{"01":9,"02":3,"04":11,"05":6,"06":54,"08":10,"09":7,"10":3,"11":3,"12":30,"13":16,"15":4,"16":4,"17":19,"18":11,"19":6,"20":6,"21":8,"22":8,"23":4,"24":10,"25":11,"26":15,"27":10,"28":6,"29":10,"30":4,"31":5,"32":6,"33":4,"34":14,"35":5,"36":28,"37":16,"38":3,"39":17,"40":7,"41":8,"42":19,"44":4,"45":9,"46":3,"47":11,"48":40,"49":6,"50":3,"51":13,"53":12,"54":4,"55":10,"56":3}

};



function getEvTableForYear(yr){

  if(yr<=2000) return EV_BY_CYCLE["2000"];

  if(yr<=2008) return EV_BY_CYCLE["2004_2008"];

  if(yr<=2020) return EV_BY_CYCLE["2012_2020"];

  return EV_BY_CYCLE["2024"];

}



const DEFAULT_CENTER=[-96,38];

const DEFAULT_ZOOM=2.25;

let LOWER48_MIN_ZOOM=DEFAULT_ZOOM;

let mapView="state";

let mapRegion="lower48";

const LOWER48_BOUNDS=[[-125,24],[-66,50]];

const STATE_ZOOM_THRESHOLD=4.5;



const errorBox=document.getElementById("errorBox");

const statusBox=document.getElementById("status");

const hoverTooltip=document.getElementById("hoverTooltip");

const resetMapButton=document.getElementById("resetMapButton");

const playButton=document.getElementById("playButton");

const stateFilter=document.getElementById("stateFilter");

const streakFilter=document.getElementById("streakFilter");

const mapHighlightSelect=document.getElementById("mapHighlightSelect");

const npvSlider=document.getElementById("npvSlider");

const npvInput=document.getElementById("npvInput");



function showError(message){

  errorBox.style.display="block";

  errorBox.textContent="ERROR: "+message;

}

window.addEventListener("error",event=>showError(event.message));

window.addEventListener("unhandledrejection",event=>showError(String(event.reason)));



const map=new maplibregl.Map({

  container:"map",

  preserveDrawingBuffer:true,

  style:{

    version:8,

    sources:{},

    layers:[{id:"background",type:"background",paint:{"background-color":"#e8edf3"}}]

  },

  center:DEFAULT_CENTER,

  zoom:DEFAULT_ZOOM,

  minZoom:DEFAULT_ZOOM,

  maxZoom:12

});

map.addControl(new maplibregl.NavigationControl(),"top-right");



let counties=null;

let statesByFips={};

let stateAbbrByFips={};

let resultsByYear={};

let actualNpvByYear={};

let countyHistoryMeta={};

let currentRankedRows=[];

let currentYear=2024;

let npvShift=0;

let mapMode="results";

let selectedStateFips="";

let selectedCountyFips="";

let activePopup=null;

let playInterval=null;

let isRestoringHash=false;



// --- Custom Margin Cutoffs ---

function getMarginCutoffs(){

  const c1=Math.max(0.1,Number(document.getElementById("cutoff1").value)||1);

  const c2=Math.max(c1+0.1,Number(document.getElementById("cutoff2").value)||5);

  const c3=Math.max(c2+0.1,Number(document.getElementById("cutoff3").value)||15);

  return [c1,c2,c3];

}



function fmtCutoff(n){

  return Number.isInteger(n)?String(n):n.toFixed(1);

}



function updateResultsLegend(){

  const [c1,c2,c3]=getMarginCutoffs();

  const s1=fmtCutoff(c1),s2=fmtCutoff(c2),s3=fmtCutoff(c3);



  document.getElementById("cutoffSummaryHint").textContent=

    `Shading tiers: 0–${s1} pts, ${s1}–${s2} pts, ${s2}–${s3} pts, and over ${s3} pts.`;



  document.getElementById("resultsLegend").innerHTML=`

    <div class="legend-range"><div class="swatch" style="background:#084594"></div>D+${s3}+</div>

    <div class="legend-range"><div class="swatch" style="background:#2171b5"></div>D+${s2}–${s3}</div>

    <div class="legend-range"><div class="swatch" style="background:#6baed6"></div>D+${s1}–${s2}</div>

    <div class="legend-range"><div class="swatch" style="background:#bdd7e7"></div>D+0–${s1}</div>

    <div class="legend-range"><div class="swatch" style="background:#fcae91"></div>R+0–${s1}</div>

    <div class="legend-range"><div class="swatch" style="background:#fb6a4a"></div>R+${s1}–${s2}</div>

    <div class="legend-range"><div class="swatch" style="background:#de2d26"></div>R+${s2}–${s3}</div>

    <div class="legend-range"><div class="swatch" style="background:#a50f15"></div>R+${s3}+</div>

    <div class="legend-range"><div class="swatch" style="background:#d1d5db"></div>No data</div>

  `;

}



function getResultsColor(margin,winner){

  if(margin===null||margin===undefined||Number.isNaN(margin)){

    if(winner==="D") return "#2171b5";

    if(winner==="R") return "#de2d26";

    return "#d1d5db";

  }

  const [c1,c2,c3]=getMarginCutoffs();

  if(margin>c3) return "#084594";

  if(margin>c2) return "#2171b5";

  if(margin>c1) return "#6baed6";

  if(margin>0) return "#bdd7e7";

  if(margin===0) return "#d1d5db";

  if(margin>=-c1) return "#fcae91";

  if(margin>=-c2) return "#fb6a4a";

  if(margin>=-c3) return "#de2d26";

  return "#a50f15";

}



function getTurnoutColor(pct){

  if(pct===null||pct===undefined||Number.isNaN(pct)) return "#e5e7eb";

  if(pct>=25) return "#005a32";

  if(pct>=10) return "#238b45";

  if(pct>=2) return "#74c476";

  if(pct>-2) return "#d1d5db";

  if(pct>-10) return "#fec44f";

  return "#d95f0e";

}



// --- URL Hash State Sync ---

function syncUrlHash(){

  if(isRestoringHash) return;

  const params=new URLSearchParams();

  params.set("mode",mapMode);

  if(mapMode==="results"){

    params.set("year",currentYear);

    if(npvShift!==0) params.set("npv",npvShift);

  }else{

    params.set("from",document.getElementById("fromYear").value);

    params.set("to",document.getElementById("toYear").value);

  }

  const [c1,c2,c3]=getMarginCutoffs();

  if(c1!==1||c2!==5||c3!==15){

    params.set("c1",c1);

    params.set("c2",c2);

    params.set("c3",c3);

  }

  if(selectedStateFips) params.set("state",selectedStateFips);

  if(selectedCountyFips) params.set("county",selectedCountyFips);

  history.replaceState(null,"","#"+params.toString());

}



document.getElementById("shareButton").addEventListener("click",async()=>{

  syncUrlHash();

  const btn=document.getElementById("shareButton");

  try{

    await navigator.clipboard.writeText(window.location.href);

    btn.textContent="Link Copied!";

  }catch{

    btn.textContent="URL Updated in Bar";

  }

  setTimeout(()=>{btn.textContent="Copy Share Link";},2000);

});



// --- Map PNG Snapshot ---

document.getElementById("snapshotButton").addEventListener("click",()=>{

  const mapCanvas=map.getCanvas();

  const bannerHeight=54;

  const out=document.createElement("canvas");

  out.width=mapCanvas.width;

  out.height=mapCanvas.height+bannerHeight;

  const ctx=out.getContext("2d");



  ctx.fillStyle="#101827";

  ctx.fillRect(0,0,out.width,bannerHeight);



  const titleText=document.getElementById("mapTitle").textContent;

  const subText=mapMode==="results"

    ?`EC: ${document.getElementById("ecDemCount").textContent} vs ${document.getElementById("ecRepCount").textContent} | Simulated NPV: ${document.getElementById("simNpvText").textContent}`

    :statusBox.textContent;



  ctx.fillStyle="#ffffff";

  ctx.font="bold 20px Arial, sans-serif";

  ctx.fillText("SeatCast — "+titleText,18,24);



  ctx.fillStyle="#cbd5e1";

  ctx.font="13px Arial, sans-serif";

  ctx.fillText(subText,18,44);



  ctx.drawImage(mapCanvas,0,bannerHeight);



  const link=document.createElement("a");

  link.download=`seatcast-${mapMode}-${currentYear}.png`;

  link.href=out.toDataURL("image/png");

  link.click();

});



function showCountyPopup(lngLat,html,fips){

  if(activePopup) activePopup.remove();

  selectedCountyFips=fips||"";

  syncUrlHash();

  activePopup=new maplibregl.Popup({maxWidth:"300px"}).setLngLat(lngLat).setHTML(html).addTo(map);

  activePopup.on("close",()=>{

    selectedCountyFips="";

    syncUrlHash();

    if(map.getLayer("selected-outline")){

      map.setFilter("selected-outline",["==","mapFips",""]);

    }

  });

}



function setSelectedCountyHighlight(fips){

  if(map.getLayer("selected-outline")){

    map.setFilter("selected-outline",["==","mapFips",fips||""]);

  }

}



function selectedBellwetherYears(){

  const chosen=[...document.getElementById("bellwetherYears").selectedOptions].map(o=>Number(o.value));

  return chosen.length?chosen:years.slice();

}

function recalculateBellwethers(){

  const chosen=selectedBellwetherYears();

  Object.keys(countyHistoryMeta).forEach(fips=>{

    const matches=chosen.every(yr=>{

      const rec=(resultsByYear[yr]||{})[fips];

      if(!rec) return false;

      const d=Number(rec.dem)||0,r=Number(rec.rep)||0;

      return d+r>0&&(d>r?"D":"R")===NATIONAL_WINNER[yr];

    });

    countyHistoryMeta[fips].isBellwether=matches;

  });

  if(counties){

    counties.features.forEach(f=>{const meta=countyHistoryMeta[getElectionFips(getCountyFips(f))]||{};f.properties.isBellwether=Boolean(meta.isBellwether);});

    if(map.getSource("counties")) map.getSource("counties").setData(counties);

    applyStreakMapHighlight(); refreshCountyExplorer();

  }

}

document.getElementById("bellwetherYears").addEventListener("change",recalculateBellwethers);



// --- Bellwether & Streak Highlight Layer ---

function applyStreakMapHighlight(){

  const mode=mapHighlightSelect.value;

  if(!map.getLayer("streak-outline")) return;

  // Keep outline categories limited to the currently displayed region.
  const regionFilter=map.getLayer("county-fill")?map.getFilter("county-fill"):null;
  const withRegion=categoryFilter=>regionFilter?["all",regionFilter,categoryFilter]:categoryFilter;

  if(mode==="none"){
    map.setFilter("streak-outline",regionFilter||["==","mapFips",""]);
    map.setLayoutProperty("streak-outline","visibility","none");
  }else if(mode==="bellwether"){
    map.setLayoutProperty("streak-outline","visibility","visible");
    map.setFilter("streak-outline",withRegion(["==",["get","isBellwether"],true]));
  }else if(mode==="swing"){
    map.setLayoutProperty("streak-outline","visibility","visible");
    map.setFilter("streak-outline",withRegion([">=",["get","flipCount"],2]));
  }else if(mode==="flip2024"){
    map.setLayoutProperty("streak-outline","visibility","visible");
    map.setFilter("streak-outline",withRegion(["==",["get","flipped2024"],true]));
  }

}

mapHighlightSelect.addEventListener("change",()=>{

  applyStreakMapHighlight();

  streakFilter.value=mapHighlightSelect.value==="none"?"all":mapHighlightSelect.value;

  refreshCountyExplorer();

});

streakFilter.addEventListener("change",()=>{

  mapHighlightSelect.value=streakFilter.value==="all"?"none":streakFilter.value;

  applyStreakMapHighlight();

  refreshCountyExplorer();

});



function setMapRegion(region){

  mapRegion=region; selectedStateFips=""; selectedCountyFips=""; stateFilter.value="";
  const regionBounds={
    lower48:LOWER48_BOUNDS,
    ak:statesByFips["02"]?featureBounds(statesByFips["02"]).toArray():[[-180,51],[-129,72]],
    hi:statesByFips["15"]?featureBounds(statesByFips["15"]).toArray():[[-161,18],[-154,23]]
  };
  const targetBounds=regionBounds[region]||LOWER48_BOUNDS;
  const camera=map.cameraForBounds(targetBounds,{padding:region==="lower48"?35:45});
  const startZoom=camera&&Number.isFinite(camera.zoom)?camera.zoom:LOWER48_MIN_ZOOM;
  map.setMinZoom(Math.max(1,startZoom));
  const boundsPad=region==="ak"?[[-188,47],[-122,76]]:region==="hi"?[[-166,16],[-149,26]]:[[-130,20],[-60,55]];
  map.setMaxBounds(boundsPad);

  const ids={lower48:["01","04","05","06","08","09","10","11","12","13","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","44","45","46","47","48","49","50","51","53","54","55","56"],ak:["02"],hi:["15"]};

  const allowed=ids[region]||ids.lower48;

  const filter=["in",["get","stateFips"],["literal",allowed]];

  ["state-fill","county-fill","county-outline","streak-outline","hover-outline","selected-outline"].forEach(id=>{if(map.getLayer(id)) map.setFilter(id,filter);});
  applyStreakMapHighlight();

  if(region==="lower48") map.fitBounds(LOWER48_BOUNDS,{padding:35,duration:700});

  else if(region==="ak"&&statesByFips["02"]) map.fitBounds(featureBounds(statesByFips["02"]),{padding:45,maxZoom:5,duration:700});

  else if(region==="hi"&&statesByFips["15"]) map.fitBounds(featureBounds(statesByFips["15"]),{padding:45,maxZoom:7,duration:700});

  applyMapView(); updateResetButtonVisibility(); updateSummaryBar(); refreshCountyExplorer(); syncUrlHash();

}

function applyMapView(){

  const stateOverview=mapView==="state"&&!selectedStateFips;

  // While focused on one state, keep surrounding counties visible but subdued.
  if(map.getLayer("county-fill")){
    map.setPaintProperty("county-fill","fill-opacity",selectedStateFips
      ?["case",["==",["get","stateFips"],selectedStateFips],0.96,0.20]
      :0.92);
  }
  if(map.getLayer("county-outline")){
    map.setPaintProperty("county-outline","line-opacity",selectedStateFips
      ?["case",["==",["get","stateFips"],selectedStateFips],0.96,0.16]
      :0.88);
    map.setPaintProperty("county-outline","line-width",selectedStateFips
      ?["case",["==",["get","stateFips"],selectedStateFips],["interpolate",["linear"],["zoom"],3,0.55,6,1.05,9,1.55],0.35]
      :["interpolate",["linear"],["zoom"],3,0.35,6,0.75,9,1.15]);
  }
  if(map.getLayer("state-outline")){
    map.setPaintProperty("state-outline","line-width",selectedStateFips
      ?["interpolate",["linear"],["zoom"],2,2.0,5,3.4,8,4.8]
      :["interpolate",["linear"],["zoom"],2,1.8,5,3.0,8,4.2]);
  }

  ["county-fill","county-outline","hover-outline","selected-outline"].forEach(id=>{
    if(map.getLayer(id)) map.setLayoutProperty(id,"visibility",stateOverview?"none":"visible");
  });
  if(map.getLayer("streak-outline")){
    const showStreaks=!stateOverview&&mapHighlightSelect.value!=="none";
    map.setLayoutProperty("streak-outline","visibility",showStreaks?"visible":"none");
  }

  if(map.getLayer("state-fill")) map.setLayoutProperty(map.getLayer("state-fill")?"state-fill":"state-fill","visibility",stateOverview?"visible":"none");

  document.getElementById("stateViewButton").classList.toggle("active",mapView==="state");

  document.getElementById("fullViewButton").classList.toggle("active",mapView==="full");

}

function setMapView(view){

  mapView=view;

  selectedStateFips="";

  selectedCountyFips="";

  stateFilter.value="";

  if(activePopup){activePopup.remove();activePopup=null;}

  applyMapView();

  map.flyTo({center:DEFAULT_CENTER,zoom:LOWER48_MIN_ZOOM,duration:700});

  updateResetButtonVisibility(); updateSummaryBar(); refreshCountyExplorer(); syncUrlHash();

}

document.getElementById("stateViewButton").addEventListener("click",()=>setMapView("state"));

document.getElementById("fullViewButton").addEventListener("click",()=>setMapView("full"));

document.getElementById("settingsMapView").addEventListener("change",event=>setMapView(event.target.value));
document.getElementById("settingsOutline").addEventListener("change",event=>{
  mapHighlightSelect.value=event.target.value;
  mapHighlightSelect.dispatchEvent(new Event("change"));
});
mapHighlightSelect.addEventListener("change",()=>{
  const setting=document.getElementById("settingsOutline");
  if(setting) setting.value=mapHighlightSelect.value;
});
document.getElementById("stateViewButton").addEventListener("click",()=>{document.getElementById("settingsMapView").value="state";});
document.getElementById("fullViewButton").addEventListener("click",()=>{document.getElementById("settingsMapView").value="full";});




function updateResetButtonVisibility(){

  const zoomedIn=map.getZoom()>LOWER48_MIN_ZOOM+0.35||Boolean(selectedStateFips);

  resetMapButton.style.display=zoomedIn?"inline-block":"none";

}

map.on("zoomend",updateResetButtonVisibility);



function stopTimelapse(){

  if(playInterval){

    clearInterval(playInterval);

    playInterval=null;

    playButton.textContent="▶ Play Timelapse";

    playButton.classList.remove("playing");

  }

}



playButton.addEventListener("click",()=>{

  if(playInterval){

    stopTimelapse();

    return;

  }

  showMapMode("results");

  playButton.textContent="⏸ Pause";

  playButton.classList.add("playing");



  if(currentYear===years[years.length-1]){

    updateMapForYear(years[0]);

  }

  playInterval=setInterval(()=>{

    const idx=years.indexOf(currentYear);

    if(idx>=years.length-1){

      stopTimelapse();

      return;

    }

    updateMapForYear(years[idx+1]);

  },1400);

});



function resetToBigMap(){

  stopTimelapse();

  if(activePopup){

    activePopup.remove();

    activePopup=null;

  }

  selectedStateFips="";

  selectedCountyFips="";

  stateFilter.value="";

  applyMapView();

  setSelectedCountyHighlight("");

  hoverTooltip.style.display="none";

  mapRegion="lower48";

  const lowerFilter=["in",["get","stateFips"],["literal",["01","04","05","06","08","09","10","11","12","13","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","44","45","46","47","48","49","50","51","53","54","55","56"]]];

  ["state-fill","county-fill","county-outline","streak-outline","hover-outline","selected-outline"].forEach(id=>{if(map.getLayer(id))map.setFilter(id,lowerFilter);});
  applyStreakMapHighlight();

  map.fitBounds(LOWER48_BOUNDS,{padding:35,duration:850});

  updateResetButtonVisibility();

  updateSummaryBar();

  refreshCountyExplorer();

  syncUrlHash();

  document.getElementById("searchMessage").textContent="Showing full US map. Click any state to zoom in.";

}

resetMapButton.addEventListener("click",resetToBigMap);

document.getElementById("jumpLower48").addEventListener("click",()=>setMapRegion("lower48"));

document.getElementById("jumpAlaska").addEventListener("click",()=>setMapRegion("ak"));

document.getElementById("jumpHawaii").addEventListener("click",()=>setMapRegion("hi"));



document.addEventListener("keydown",e=>{

  if(e.key==="Escape"&&(map.getZoom()>DEFAULT_ZOOM+0.35||selectedStateFips)){

    resetToBigMap();

  }

});



function getCountyFips(feature){

  return String(feature.id).padStart(5,"0");

}

function getElectionFips(fips){

  if(fips==="46102") return "46113";

  return fips;

}



function fmtMarginStr(m){

  if(m===null||m===undefined||Number.isNaN(m)) return "No data";

  if(Math.abs(m)<0.005) return "Tied";

  return m>0?`D+${m.toFixed(2)}`:`R+${Math.abs(m).toFixed(2)}`;

}



// --- NPV Shift Helpers ---

function setNpvShift(val){

  const clamped=Math.max(-50,Math.min(50,Number(val)||0));

  npvShift=Math.round(clamped*100)/100;

  npvSlider.value=Math.max(-15,Math.min(15,npvShift));

  npvInput.value=npvShift;

  if(counties&&mapMode==="results"){

    updateMapForYear(currentYear);

  }

}



npvSlider.addEventListener("input",e=>setNpvShift(e.target.value));

npvInput.addEventListener("change",e=>setNpvShift(e.target.value));

document.getElementById("resetNpvBtn").addEventListener("click",()=>setNpvShift(0));

document.querySelectorAll(".npv-preset").forEach(btn=>{

  btn.addEventListener("click",()=>setNpvShift(Number(btn.dataset.shift)));

});

document.getElementById("tieNpvBtn").addEventListener("click",()=>{

  const actual=actualNpvByYear[currentYear]||0;

  setNpvShift(-actual);

});



["cutoff1","cutoff2","cutoff3"].forEach(id=>{

  document.getElementById(id).addEventListener("change",()=>{

    updateResultsLegend();

    if(counties&&mapMode==="results") updateMapForYear(currentYear);

  });

});

document.getElementById("resetCutoffsBtn").addEventListener("click",()=>{

  document.getElementById("cutoff1").value=1;

  document.getElementById("cutoff2").value=5;

  document.getElementById("cutoff3").value=15;

  updateResultsLegend();

  if(counties&&mapMode==="results") updateMapForYear(currentYear);

});



// --- Live Electoral College Calculator ---

function updateElectoralCollege(){

  const ecCard=document.getElementById("ecCard");

  if(mapMode!=="results"){

    ecCard.style.display="none";

    return;

  }

  ecCard.style.display="block";



  const electionResults=resultsByYear[currentYear]||{};

  const evTable=getEvTableForYear(currentYear);

  const stateTotals={};



  Object.entries(electionResults).forEach(([fips,r])=>{

    const stFips=fips.slice(0,2);

    if(!evTable[stFips]) return;

    if(!stateTotals[stFips]) stateTotals[stFips]={dem:0,rep:0,rawDem:0,rawRep:0};

    const d=Number(r.dem)||0;

    const rep=Number(r.rep)||0;

    const twoParty=d+rep;

    if(twoParty>0){
      stateTotals[stFips].rawDem+=d;
      stateTotals[stFips].rawRep+=rep;
      const rawM=100*(d-rep)/twoParty;

      const adjM=Math.max(-100,Math.min(100,rawM+npvShift));

      const adjD=twoParty*((100+adjM)/200);

      stateTotals[stFips].dem+=adjD;

      stateTotals[stFips].rep+=(twoParty-adjD);

    }

  });



  let demEv=0,repEv=0;

  const stateMargins=[];

  // DC has three electoral votes and is treated as Democratic in every election shown.
  // Count it exactly once, regardless of whether the county-results file includes DC.
  demEv+=3;
  stateMargins.push({stFips:"11",name:"District of Columbia",evs:3,margin:100});



  Object.entries(evTable).forEach(([stFips,evs])=>{

    if(stFips==="11") return;
    const tot=stateTotals[stFips];

    if(!tot||(tot.dem+tot.rep)<=0) return;

    const margin=100*(tot.dem-tot.rep)/(tot.dem+tot.rep);

    if(margin>0) demEv+=evs;
    else if(margin<0) repEv+=evs;
    else {
      // A simulated exact tie still needs a winner so the EV total remains 538.
      const rawMargin=(tot.rawDem||0)-(tot.rawRep||0);
      const tieWinner=rawMargin===0?NATIONAL_WINNER[currentYear]:(rawMargin>0?"D":"R");
      if(tieWinner==="D") demEv+=evs; else repEv+=evs;
    }

    const name=statesByFips[stFips]?.properties?.name||stateAbbrByFips[stFips]||stFips;

    stateMargins.push({stFips,name,evs,margin});

  });



  // Sort from most Democratic to most Republican to find Tipping-Point State

  stateMargins.sort((a,b)=>b.margin-a.margin);

  let cumEv=0;

  let tippingState=null;

  for(const st of stateMargins){

    cumEv+=st.evs;

    if(cumEv>=270){

      tippingState=st;

      break;

    }

  }



  document.getElementById("ecDemCount").textContent=`D: ${demEv}`;

  document.getElementById("ecRepCount").textContent=`R: ${repEv}`;

  document.getElementById("ecBarDem").style.width=`${(demEv/538)*100}%`;

  document.getElementById("ecBarRep").style.width=`${(repEv/538)*100}%`;



  if(tippingState){

    const actualNpv=actualNpvByYear[currentYear]??0;

    const tippingNpv=actualNpv-tippingState.margin;

    document.getElementById("ecTippingPoint").innerHTML=

      ` • Tipping-Point State: <strong>${esc(tippingState.name)}</strong> (${fmtMarginStr(tippingState.margin)})`;

    document.getElementById("ecTippingNpv").innerHTML=

      `270-EV Tipping-Point NPV: <strong>${fmtMarginStr(tippingNpv)}</strong>`;

  }else{

    document.getElementById("ecTippingPoint").textContent="";

    document.getElementById("ecTippingNpv").textContent="";

  }

}



// --- Dynamic Summary Scoreboard ---

function updateSummaryBar(){

  const stateObj=selectedStateFips?statesByFips[selectedStateFips]:null;

  const scopeName=stateObj&&stateObj.properties?stateObj.properties.name:"United States";

  document.getElementById("sumScopeVal").textContent=scopeName;



  if(mapMode==="results"){

    const electionResults=resultsByYear[currentYear]||{};

    let demVotes=0,repVotes=0,totalVotes=0,demCounties=0,repCounties=0;



    Object.entries(electionResults).forEach(([fips,r])=>{

      if(selectedStateFips&&!fips.startsWith(selectedStateFips)) return;

      const d=Number(r.dem)||0;

      const rep=Number(r.rep)||0;

      const twoParty=d+rep;

      const tot=Number(r.total)||twoParty;



      if(twoParty>0){

        const rawM=100*(d-rep)/twoParty;

        const adjM=Math.max(-100,Math.min(100,rawM+npvShift));

        const adjD=twoParty*((100+adjM)/200);

        const adjR=twoParty-adjD;

        demVotes+=adjD;

        repVotes+=adjR;

        if(adjM>0) demCounties++;

        else if(adjM<0) repCounties++;

      }

      totalVotes+=tot;

    });



    const twoPartyTotal=demVotes+repVotes;

    const demShare=twoPartyTotal>0?(100*demVotes/twoPartyTotal).toFixed(1)+"%":"—";

    const repShare=twoPartyTotal>0?(100*repVotes/twoPartyTotal).toFixed(1)+"%":"—";

    const shiftTag=npvShift!==0?` • NPV Shift ${fmtMarginStr(npvShift)}`:"";



    document.getElementById("sumScopeLabel").textContent=selectedStateFips?"Selected State":"National Overview";

    document.getElementById("sumScopeSub").textContent=`${currentYear}${shiftTag} • ${Math.round(totalVotes).toLocaleString()} votes`;

    document.getElementById("sumDemLabel").textContent=npvShift!==0?"Simulated Democratic":"Democratic Vote";

    document.getElementById("sumDemVal").className="summary-value text-dem";

    document.getElementById("sumDemVal").textContent=`${Math.round(demVotes).toLocaleString()} (${demShare})`;

    document.getElementById("sumDemSub").textContent="Two-party share";

    document.getElementById("sumRepLabel").textContent=npvShift!==0?"Simulated Republican":"Republican Vote";

    document.getElementById("sumRepVal").className="summary-value text-rep";

    document.getElementById("sumRepVal").textContent=`${Math.round(repVotes).toLocaleString()} (${repShare})`;

    document.getElementById("sumRepSub").textContent="Two-party share";

    document.getElementById("sumCountiesLabel").textContent="Counties Won";

    document.getElementById("sumCountiesVal").innerHTML=`<span class="text-dem">D: ${demCounties.toLocaleString()}</span> &nbsp;|&nbsp; <span class="text-rep">R: ${repCounties.toLocaleString()}</span>`;

    document.getElementById("sumCountiesSub").textContent=`${(demCounties+repCounties).toLocaleString()} counties reporting`;

  }else if(mapMode==="shift"){

    const fromYear=Number(document.getElementById("fromYear").value);

    const toYear=Number(document.getElementById("toYear").value);

    const oldRes=resultsByYear[fromYear]||{};

    const newRes=resultsByYear[toYear]||{};

    let oldD=0,oldR=0,newD=0,newR=0,shiftDCount=0,shiftRCount=0;



    Object.entries(newRes).forEach(([fips,nr])=>{

      if(selectedStateFips&&!fips.startsWith(selectedStateFips)) return;

      const or=oldRes[fips];

      if(!or) return;

      const od=Number(or.dem)||0,orep=Number(or.rep)||0;

      const nd=Number(nr.dem)||0,nrep=Number(nr.rep)||0;

      if(od+orep<=0||nd+nrep<=0) return;

      oldD+=od; oldR+=orep;

      newD+=nd; newR+=nrep;

      const s=(100*(nd-nrep)/(nd+nrep))-(100*(od-orep)/(od+orep));

      if(s>0) shiftDCount++;

      else if(s<0) shiftRCount++;

    });



    const oldM=(oldD+oldR)>0?100*(oldD-oldR)/(oldD+oldR):0;

    const newM=(newD+newR)>0?100*(newD-newR)/(newD+newR):0;

    const aggShift=newM-oldM;

    const shiftCls=aggShift>0?"text-dem":aggShift<0?"text-rep":"";



    document.getElementById("sumScopeLabel").textContent=selectedStateFips?"State Shift":"National Shift";

    document.getElementById("sumScopeSub").textContent=`${fromYear} → ${toYear} comparison`;

    document.getElementById("sumDemLabel").textContent="Aggregate Shift";

    document.getElementById("sumDemVal").className="summary-value "+shiftCls;

    document.getElementById("sumDemVal").textContent=fmtMarginStr(aggShift);

    document.getElementById("sumDemSub").textContent=aggShift>0?"Moved toward Democrats":aggShift<0?"Moved toward Republicans":"No net shift";

    document.getElementById("sumRepLabel").textContent="Margin Change";

    document.getElementById("sumRepVal").className="summary-value";

    document.getElementById("sumRepVal").textContent=`${fmtMarginStr(oldM)} → ${fmtMarginStr(newM)}`;

    document.getElementById("sumRepSub").textContent="Two-party margin";

    document.getElementById("sumCountiesLabel").textContent="County Direction";

    document.getElementById("sumCountiesVal").innerHTML=`<span class="text-dem">D+: ${shiftDCount.toLocaleString()}</span> &nbsp;|&nbsp; <span class="text-rep">R+: ${shiftRCount.toLocaleString()}</span>`;

    document.getElementById("sumCountiesSub").textContent="Counties shifting each way";

  }else if(mapMode==="turnout"){

    const fromYear=Number(document.getElementById("fromYear").value);

    const toYear=Number(document.getElementById("toYear").value);

    const oldRes=resultsByYear[fromYear]||{};

    const newRes=resultsByYear[toYear]||{};

    let oldTot=0,newTot=0,upCount=0,downCount=0;



    Object.entries(newRes).forEach(([fips,nr])=>{

      if(selectedStateFips&&!fips.startsWith(selectedStateFips)) return;

      const or=oldRes[fips];

      if(!or) return;

      const ot=Number(or.total)||(Number(or.dem)+Number(or.rep))||0;

      const nt=Number(nr.total)||(Number(nr.dem)+Number(nr.rep))||0;

      if(ot<=0||nt<=0) return;

      oldTot+=ot;

      newTot+=nt;

      if(nt>ot) upCount++;

      else if(nt<ot) downCount++;

    });



    const netDiff=newTot-oldTot;

    const pctChange=oldTot>0?100*netDiff/oldTot:0;

    const pctCls=pctChange>=0?"text-green":"text-rep";



    document.getElementById("sumScopeLabel").textContent=selectedStateFips?"State Turnout":"National Turnout";

    document.getElementById("sumScopeSub").textContent=`${fromYear} → ${toYear} ballots cast`;

    document.getElementById("sumDemLabel").textContent=`${fromYear} Total Ballots`;

    document.getElementById("sumDemVal").className="summary-value";

    document.getElementById("sumDemVal").textContent=oldTot.toLocaleString();

    document.getElementById("sumDemSub").textContent="Baseline election";

    document.getElementById("sumRepLabel").textContent=`${toYear} Total Ballots`;

    document.getElementById("sumRepVal").className="summary-value "+pctCls;

    document.getElementById("sumRepVal").textContent=`${newTot.toLocaleString()} (${pctChange>=0?"+":""}${pctChange.toFixed(1)}%)`;

    document.getElementById("sumRepSub").textContent=`${netDiff>=0?"+":""}${netDiff.toLocaleString()} net ballots`;

    document.getElementById("sumCountiesLabel").textContent="County Turnout";

    document.getElementById("sumCountiesVal").innerHTML=`<span class="text-green">Up: ${upCount.toLocaleString()}</span> &nbsp;|&nbsp; <span class="text-rep">Down: ${downCount.toLocaleString()}</span>`;

    document.getElementById("sumCountiesSub").textContent="Counties growing vs. shrinking";

  }

}



function attachHistoryProps(p,dataFips){

  const meta=countyHistoryMeta[dataFips]||{isBellwether:false,flipCount:0,flipped2024:false};

  p.isBellwether=meta.isBellwether;

  p.flipCount=meta.flipCount;

  p.flipped2024=meta.flipped2024;

}



function updateStateViewColors(){

  const src=map.getSource("states-fill");

  if(!src) return;

  const yearData=resultsByYear[currentYear]||{};

  const totals={};

  Object.entries(yearData).forEach(([fips,r])=>{

    const st=fips.slice(0,2); if(!totals[st]) totals[st]={d:0,r:0};

    totals[st].d+=Number(r.dem)||0; totals[st].r+=Number(r.rep)||0;

  });

  const features=Object.values(statesByFips).map(sf=>{

    const st=String(sf.id).padStart(2,"0"),t=totals[st];

    const raw=t&&t.d+t.r>0?100*(t.d-t.r)/(t.d+t.r):null;

    const m=raw===null?null:Math.max(-100,Math.min(100,raw+npvShift));

    return {type:"Feature",id:sf.id,geometry:sf.geometry,properties:{...sf.properties,stateFips:st,fillColor:m===null?"#d1d5db":getResultsColor(m,m>0?"D":m<0?"R":"T"),margin:m,rawMargin:raw}};

  });

  src.setData({type:"FeatureCollection",features});

}



function updateMapForYear(year){

  currentYear=Number(year);

  const electionResults=resultsByYear[currentYear]||{};

  const actualNpv=actualNpvByYear[currentYear]??0;

  const simNpv=actualNpv+npvShift;



  document.getElementById("actualNpvText").textContent=fmtMarginStr(actualNpv);

  const simNpvEl=document.getElementById("simNpvText");

  simNpvEl.textContent=fmtMarginStr(simNpv);

  simNpvEl.className=simNpv>0?"text-dem":simNpv<0?"text-rep":"";



  const shiftHeadline=npvShift!==0?` (${fmtMarginStr(npvShift)} NPV Shift)`:"";

  document.getElementById("mapTitle").textContent=currentYear+" Presidential Election"+shiftHeadline;

  document.getElementById("selectedYear").textContent=currentYear;

  document.getElementById("yearSlider").value=years.indexOf(currentYear);



  document.querySelectorAll(".year-button").forEach(button=>{

    button.classList.toggle("active",Number(button.dataset.year)===currentYear);

  });



  counties.features.forEach(feature=>{

    const fips=getCountyFips(feature);

    const dataFips=getElectionFips(fips);

    const stateFips=fips.slice(0,2);

    const stateFeature=statesByFips[stateFips];

    const result=electionResults[dataFips];

    const p=feature.properties;

    const rawMargin=result&&(Number(result.dem)+Number(result.rep))>0

      ?100*(Number(result.dem)-Number(result.rep))/(Number(result.dem)+Number(result.rep)):null;

    const adjMargin=rawMargin!==null?Math.max(-100,Math.min(100,rawMargin+npvShift)):null;



    p.winner=adjMargin!==null?(adjMargin>0?"D":adjMargin<0?"R":"T"):(result?result.winner:"NA");

    p.fillColor=!result?"#d1d5db":getResultsColor(adjMargin,p.winner);

    p.dem=result?result.dem:null;

    p.rep=result?result.rep:null;

    p.total=result?result.total:null;

    p.demPct=result?result.demPct:null;

    p.repPct=result?result.repPct:null;

    p.rawMargin=rawMargin;

    p.margin=adjMargin;

    p.countyName=result?result.county:(feature.properties.name||"County "+fips);

    p.state=result?result.state:(stateAbbrByFips[stateFips]||"");

    p.stateFullName=stateFeature&&stateFeature.properties?stateFeature.properties.name:"";

    p.stateFips=stateFips;

    p.electionYear=currentYear;

    p.mapFips=fips;

    p.shiftAvailable=false;

    p.shift=null;

    p.turnoutAvailable=false;

    p.turnoutPct=null;

    attachHistoryProps(p,dataFips);

  });



  map.getSource("counties").setData(counties);

  updateStateViewColors();

  updateElectoralCollege();

  updateSummaryBar();

  refreshCountyExplorer();

  syncUrlHash();

  statusBox.textContent="Showing "+currentYear+" presidential results"+(npvShift!==0?` with ${fmtMarginStr(npvShift)} uniform NPV shift`:"")+" | "+Object.keys(electionResults).length+" county records.";

}



function updateStateViewCompareColors(fromYear,toYear){

  const src=map.getSource("states-fill"); if(!src) return;

  const oldData=resultsByYear[fromYear]||{}, newData=resultsByYear[toYear]||{};

  const totals={};

  Object.keys(oldData).forEach(f=>{const st=f.slice(0,2); if(!totals[st]) totals[st]={old:0,now:0,oldTwo:0,newTwo:0}; const r=oldData[f]; totals[st].old+=Number(r.total)||0; totals[st].oldTwo+=(Number(r.dem)||0)+(Number(r.rep)||0);});

  Object.keys(newData).forEach(f=>{const st=f.slice(0,2); if(!totals[st]) totals[st]={old:0,now:0,oldTwo:0,newTwo:0}; const r=newData[f]; totals[st].now+=Number(r.total)||0; totals[st].newTwo+=(Number(r.dem)||0)+(Number(r.rep)||0);});

  const features=Object.values(statesByFips).map(sf=>{

    const st=String(sf.id).padStart(2,"0"), t=totals[st]; let color="#e5e7eb", value=null;

    if(t){

      if(mapMode==="shift"&&t.oldTwo>0&&t.newTwo>0){const oldD=Object.entries(oldData).filter(([f])=>f.startsWith(st)).reduce((a,[,r])=>a+(Number(r.dem)||0),0); const oldR=t.oldTwo-oldD; const newD=Object.entries(newData).filter(([f])=>f.startsWith(st)).reduce((a,[,r])=>a+(Number(r.dem)||0),0); const newR=t.newTwo-newD; value=100*(newD-newR)/t.newTwo-100*(oldD-oldR)/t.oldTwo; color=getShiftColor(value);}

      else if(mapMode==="turnout"&&t.old>0&&t.now>0){value=100*(t.now-t.old)/t.old;color=getTurnoutColor(value);}

    }

    return {type:"Feature",id:sf.id,geometry:sf.geometry,properties:{...sf.properties,stateFips:st,fillColor:color,margin:value}};

  });

  src.setData({type:"FeatureCollection",features});

}

function getShiftColor(s){if(Math.abs(s)<1)return "#d1d5db";if(s>=1&&s<3)return "#b3d4f0";if(s>=3&&s<6)return "#5b9bd5";if(s>=6)return "#145a96";if(s<=-1&&s>-3)return "#f2b8b5";if(s<=-3&&s>-6)return "#e47770";return "#a91e27";}



function updateMapForCompare(){

  const fromYear=Number(document.getElementById("fromYear").value);

  const toYear=Number(document.getElementById("toYear").value);

  const oldResults=resultsByYear[fromYear]||{};

  const newResults=resultsByYear[toYear]||{};



  document.getElementById("mapTitle").textContent=

    mapMode==="shift"

      ?`${fromYear} to ${toYear} County Margin Shift`

      :`${fromYear} to ${toYear} County Turnout Change`;



  counties.features.forEach(feature=>{

    const fips=getCountyFips(feature);

    const stateFips=fips.slice(0,2);

    const stateFeature=statesByFips[stateFips];

    const dataFips=getElectionFips(fips);

    const oldResult=oldResults[dataFips];

    const newResult=newResults[dataFips];

    const p=feature.properties;

    p.fromYear=fromYear;

    p.toYear=toYear;

    p.shift=null;

    p.shiftAvailable=false;

    p.turnoutPct=null;

    p.turnoutDiff=null;

    p.oldTotal=null;

    p.turnoutAvailable=false;

    p.stateFips=stateFips;

    p.stateFullName=stateFeature&&stateFeature.properties?stateFeature.properties.name:"";

    p.mapFips=fips;

    attachHistoryProps(p,dataFips);



    if(!oldResult||!newResult){

      p.fillColor="#e5e7eb";

      return;

    }



    p.countyName=newResult.county;

    p.state=newResult.state;

    p.dem=newResult.dem;

    p.rep=newResult.rep;

    p.total=newResult.total;

    p.demPct=newResult.demPct;

    p.repPct=newResult.repPct;



    const oldVotes=Number(oldResult.dem)+Number(oldResult.rep);

    const newVotes=Number(newResult.dem)+Number(newResult.rep);

    if(oldVotes>0&&newVotes>0){

      const oldMargin=100*(Number(oldResult.dem)-Number(oldResult.rep))/oldVotes;

      const newMargin=100*(Number(newResult.dem)-Number(newResult.rep))/newVotes;

      p.shift=newMargin-oldMargin;

      p.shiftAvailable=true;

      p.rawMargin=newMargin;

      p.margin=newMargin;

    }



    const oldTot=Number(oldResult.total)||oldVotes;

    const newTot=Number(newResult.total)||newVotes;

    if(oldTot>0&&newTot>0){

      p.oldTotal=oldTot;

      p.turnoutDiff=newTot-oldTot;

      p.turnoutPct=100*(newTot-oldTot)/oldTot;

      p.turnoutAvailable=true;

    }



    if(mapMode==="shift"){

      if(!p.shiftAvailable){

        p.fillColor="#d1d5db";

        return;

      }

      p.fillColor=getShiftColor(p.shift);

    }else if(mapMode==="turnout"){

      p.fillColor=p.turnoutAvailable?getTurnoutColor(p.turnoutPct):"#e5e7eb";

    }

  });



  map.getSource("counties").setData(counties);

  updateStateViewCompareColors(fromYear,toYear);

  updateElectoralCollege();

  updateSummaryBar();

  refreshCountyExplorer();

  syncUrlHash();

  statusBox.textContent=mapMode==="shift"

    ?`Showing county shifts from ${fromYear} to ${toYear}. Positive shifts indicate movement toward Democrats.`

    :`Showing percentage change in total ballots cast from ${fromYear} to ${toYear}.`;

}



function esc(value){

  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

}

function countyLabel(feature){

  const p=feature.properties||{};

  const statePart=p.state||p.stateFullName||"";

  return (p.countyName||"Unknown County")+(statePart?", "+statePart:"");

}

function featureBounds(feature){

  const fipsStr=String(feature.id).padStart(2,"0");

  if(fipsStr==="02"){

    return new maplibregl.LngLatBounds([-171.0,51.2],[-129.9,71.5]);

  }

  const bounds=new maplibregl.LngLatBounds();

  function walk(coords){

    if(!Array.isArray(coords)) return;

    if(typeof coords[0]==="number"&&typeof coords[1]==="number"){

      bounds.extend([coords[0],coords[1]]);

    }else{

      coords.forEach(walk);

    }

  }

  if(feature.geometry) walk(feature.geometry.coordinates);

  return bounds;

}



function zoomToState(stateFeature){

  if(!stateFeature) return;

  const stateFips=String(stateFeature.id).padStart(2,"0");

  selectedStateFips=stateFips;

  selectedCountyFips="";

  stateFilter.value=stateFips;

  applyMapView();



  const bounds=featureBounds(stateFeature);

  if(!bounds.isEmpty()){

    if(activePopup){

      activePopup.remove();

      activePopup=null;

    }

    setSelectedCountyHighlight("");

    map.fitBounds(bounds,{padding:45,maxZoom:8.5,duration:850});

    const stateName=stateFeature.properties?.name||"state";

    document.getElementById("searchMessage").textContent=

      "Zoomed into "+stateName+". Click any county for details, or click outside the map to return to the full US view.";

  }

  updateResetButtonVisibility();

  updateSummaryBar();

  refreshCountyExplorer();

  syncUrlHash();

}



function zoomToCounty(feature){

  const p=feature.properties||{};

  if(p.stateFips){

    selectedStateFips=p.stateFips;

    stateFilter.value=p.stateFips;

    // In State View, reveal county layers when a ranked county is selected.
    applyMapView();

  }

  const bounds=featureBounds(feature);

  if(!bounds.isEmpty()){

    map.fitBounds(bounds,{padding:80,maxZoom:8,duration:900});

  }

  setSelectedCountyHighlight(p.mapFips||"");

  updateResetButtonVisibility();

  updateSummaryBar();

  refreshCountyExplorer();

  document.getElementById("map").scrollIntoView({behavior:"smooth",block:"center"});

  document.getElementById("searchMessage").textContent=

    "Showing "+countyLabel(feature)+". Click outside the map to return to the full US view.";

}



// --- Mini Historical Bar Chart for Popups ---

function buildHistoryChartHtml(mapFips){

  const dataFips=getElectionFips(mapFips);

  const activeFrom=Number(document.getElementById("fromYear").value);

  const activeTo=Number(document.getElementById("toYear").value);



  const cols=years.map(yr=>{

    const rec=(resultsByYear[yr]||{})[dataFips];

    let margin=null;

    if(rec&&(Number(rec.dem)+Number(rec.rep))>0){

      margin=100*(Number(rec.dem)-Number(rec.rep))/(Number(rec.dem)+Number(rec.rep));

    }

    const isHighlighted=mapMode==="results"?yr===currentYear:(yr===activeFrom||yr===activeTo);

    const shortYr="'"+String(yr).slice(2);

    const labelTxt=margin===null?"No data":fmtMarginStr(margin);



    let topBar="",bottomBar="";

    if(margin!==null&&margin>0){

      const pct=Math.max(8,Math.min(100,Math.abs(margin)));

      topBar=`<div class="history-bar-d" style="height:${pct}%"></div>`;

    }else if(margin!==null&&margin<0){

      const pct=Math.max(8,Math.min(100,Math.abs(margin)));

      bottomBar=`<div class="history-bar-r" style="height:${pct}%"></div>`;

    }



    return `<div class="history-col" title="${yr} actual: ${labelTxt}">

      <div class="history-half-top">${topBar}</div>

      <div class="history-half-bottom">${bottomBar}</div>

      <div class="history-yr ${isHighlighted?'active-yr':''}">${shortYr}</div>

    </div>`;

  }).join("");



  return `<div class="popup-chart-wrap">

    <div class="popup-chart-title">Actual margin history (2000–2024)</div>

    <div class="history-chart">${cols}</div>

  </div>`;

}



function bellwetherLabel(){const ys=selectedBellwetherYears();return `★ ${ys[0]}–${ys[ys.length-1]} Bellwether (${ys.length}/${ys.length})`;}

function openCountyDetailsPopup(p,lngLat){

  const chartHtml=buildHistoryChartHtml(p.mapFips);

  const badges=[];

  if(p.isBellwether) badges.push(`<span class="streak-pill">${bellwetherLabel()}</span>`);

  if(p.flipCount>0) badges.push(`<span class="streak-pill swing">${p.flipCount} flip${p.flipCount>1?"s":""} since 2000</span>`);

  const badgeRow=badges.length?`<div style="margin:5px 0">${badges.join(" ")}</div>`:"";



  if(mapMode==="turnout"){

    if(!p.turnoutAvailable){

      showCountyPopup(

        lngLat,

        `<strong>No matching turnout data found.</strong><br><br>Map FIPS: ${p.mapFips}${chartHtml}`,

        p.mapFips

      );

      return;

    }

    const pct=Number(p.turnoutPct);

    const diff=Number(p.turnoutDiff);

    const html=`<div style="font-family:Arial;min-width:235px">

      <strong style="font-size:16px">${esc(p.countyName)}, ${esc(p.state||p.stateFullName)}</strong>

      ${badgeRow}

      <div style="color:#667085;margin:4px 0 8px">Turnout: ${p.fromYear} to ${p.toYear}</div>

      <div>Change: <strong>${pct>=0?"+":""}${pct.toFixed(2)}%</strong> (${diff>=0?"+":""}${diff.toLocaleString()} votes)</div>

      <hr style="border:none;border-top:1px solid #e5eaf0;margin:8px 0">

      <div>${p.fromYear} ballots: ${Number(p.oldTotal).toLocaleString()}</div>

      <div>${p.toYear} ballots: ${Number(p.total).toLocaleString()}</div>

      ${chartHtml}

    </div>`;

    showCountyPopup(lngLat,html,p.mapFips);

    return;

  }



  if(mapMode==="shift"){

    if(!p.shiftAvailable){

      showCountyPopup(

        lngLat,

        `<strong>No matching historical data found.</strong><br><br>Map FIPS: ${p.mapFips}<br>Comparison: ${p.fromYear} to ${p.toYear}${chartHtml}`,

        p.mapFips

      );

      return;

    }

    const direction=p.shift>0?"toward Democrats":p.shift<0?"toward Republicans":"No change";

    const startingMargin=p.margin-p.shift;

    const html=`<div style="font-family:Arial;min-width:235px">

      <strong style="font-size:16px">${esc(p.countyName)}, ${esc(p.state||p.stateFullName)}</strong>

      ${badgeRow}

      <div style="color:#667085;margin:4px 0 8px">${p.fromYear} to ${p.toYear}</div>

      <div>Shift: <strong>${Math.abs(p.shift).toFixed(2)} points</strong> (${direction})</div>

      <hr style="border:none;border-top:1px solid #e5eaf0;margin:8px 0">

      <div>Starting (${p.fromYear}): ${fmtMarginStr(startingMargin)}</div>

      <div>Ending (${p.toYear}): ${fmtMarginStr(p.margin)}</div>

      ${chartHtml}

    </div>`;

    showCountyPopup(lngLat,html,p.mapFips);

    return;

  }



  if(p.dem===null||p.rep===null){

    showCountyPopup(

      lngLat,

      `<strong>No election data found for this county.</strong><br><br>Map FIPS: ${p.mapFips}<br>Election year: ${p.electionYear}${chartHtml}`,

      p.mapFips

    );

    return;

  }



  const rawMargin=Number(p.rawMargin);

  const adjMargin=Number(p.margin);

  const npvRow=npvShift!==0

    ?`<div style="margin-top:4px;padding:5px 7px;background:#f8fafc;border-radius:5px;border:1px solid #e2e8f0">

        <div>Actual margin: <strong>${fmtMarginStr(rawMargin)}</strong></div>

        <div>NPV-shifted (${fmtMarginStr(npvShift)}): <strong>${fmtMarginStr(adjMargin)}</strong></div>

      </div>`

    :`<strong>Two-party margin: ${fmtMarginStr(rawMargin)}</strong>`;



  const html=`<div style="font-family:Arial;min-width:240px">

    <strong style="font-size:16px">${esc(p.countyName||"County")}, ${esc(p.state||p.stateFullName)}</strong>

    ${badgeRow}

    <div style="color:#667085;margin:4px 0 8px">${p.electionYear} Presidential Election</div>

    <div style="color:#2166ac">Democratic: ${Number(p.dem).toLocaleString()} (${Number(p.demPct).toFixed(2)}%)</div>

    <div style="color:#c62828">Republican: ${Number(p.rep).toLocaleString()} (${Number(p.repPct).toFixed(2)}%)</div>

    <hr style="border:none;border-top:1px solid #e5eaf0;margin:8px 0">

    <div style="margin-bottom:4px">Total votes: ${Number(p.total).toLocaleString()}</div>

    ${npvRow}

    ${chartHtml}

  </div>`;

  showCountyPopup(lngLat,html,p.mapFips);

}



// --- County-to-County Head-to-Head Comparison ---

function runHeadToHeadComparison(){

  if(!counties) return;

  const qA=document.getElementById("h2hCountyA").value.trim().toLowerCase();

  const qB=document.getElementById("h2hCountyB").value.trim().toLowerCase();

  if(!qA||!qB) return;



  const normalizeCountyQuery=q=>q.replace(/\s+county(?=,|$)/i,"").replace(/\s+/g," ").trim();

  const findMatch=q=>{

    const normalized=normalizeCountyQuery(q);

    return counties.features.find(x=>countyLabel(x).toLowerCase()===normalized)||

      counties.features.find(x=>countyLabel(x).toLowerCase().includes(normalized));

  };



  const fA=findMatch(qA);

  const fB=findMatch(qB);

  if(!fA||!fB){

    document.getElementById("searchMessage").textContent="Could not match one or both counties for Head-to-Head comparison.";

    return;

  }



  const fipsA=getElectionFips(getCountyFips(fA));

  const fipsB=getElectionFips(getCountyFips(fB));

  const labelA=countyLabel(fA);

  const labelB=countyLabel(fB);



  const getSeries=fips=>years.map(yr=>{

    const rec=(resultsByYear[yr]||{})[fips];

    if(!rec) return {yr,margin:null,total:null};

    const d=Number(rec.dem)||0,r=Number(rec.rep)||0;

    const margin=(d+r)>0?100*(d-r)/(d+r):null;

    const total=Number(rec.total)||(d+r)||null;

    return {yr,margin,total};

  });



  const sA=getSeries(fipsA);

  const sB=getSeries(fipsB);



  // Build Dual-Line SVG Chart

  const W=520,H=220,padL=44,padR=20,padT=18,padB=28;

  const plotW=W-padL-padR,plotH=H-padT-padB;

  const xForIdx=i=>padL+(i/(years.length-1))*plotW;

  const yForMargin=m=>padT+((100-Math.max(-100,Math.min(100,m)))/200)*plotH;



  let gridSvg="";

  [-75,-50,-25,0,25,50,75].forEach(val=>{

    const y=yForMargin(val);

    const stroke=val===0?"#64748b":"#e2e8f0";

    const dash=val===0?"":"stroke-dasharray='3,3'";

    const lbl=val===0?"0":val>0?`D+${val}`:`R+${Math.abs(val)}`;

    gridSvg+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${stroke}" ${dash} stroke-width="${val===0?1.3:1}"/>`;

    gridSvg+=`<text x="${padL-6}" y="${y+3.5}" text-anchor="end" font-size="10" fill="#647485">${lbl}</text>`;

  });



  years.forEach((yr,i)=>{

    const x=xForIdx(i);

    gridSvg+=`<text x="${x}" y="${H-8}" text-anchor="middle" font-size="10.5" fill="#475467">${yr}</text>`;

  });



  const buildLine=(series,color)=>{

    const pts=[];

    let circles="";

    series.forEach((pt,i)=>{

      if(pt.margin===null) return;

      const x=xForIdx(i),y=yForMargin(pt.margin);

      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);

      circles+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" stroke="#ffffff" stroke-width="1.5"><title>${pt.yr}: ${fmtMarginStr(pt.margin)}</title></circle>`;

    });

    const poly=pts.length>1?`<polyline fill="none" stroke="${color}" stroke-width="2.6" points="${pts.join(" ")}"/>`:"";

    return poly+circles;

  };



  document.getElementById("h2hLegend").innerHTML=`

    <span><span class="h2h-dot" style="background:#2166ac"></span>${esc(labelA)}</span>

    <span><span class="h2h-dot" style="background:#d97706"></span>${esc(labelB)}</span>

  `;

  document.getElementById("h2hSvgWrap").innerHTML=

    `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${gridSvg}${buildLine(sA,"#2166ac")}${buildLine(sB,"#d97706")}</svg>`;



  const m2000A=sA[0].margin,m2024A=sA[6].margin;

  const m2000B=sB[0].margin,m2024B=sB[6].margin;

  const shiftA=(m2000A!==null&&m2024A!==null)?fmtMarginStr(m2024A-m2000A):"—";

  const shiftB=(m2000B!==null&&m2024B!==null)?fmtMarginStr(m2024B-m2000B):"—";

  const tGrowthA=(sA[0].total&&sA[6].total)?((100*(sA[6].total-sA[0].total)/sA[0].total).toFixed(1)+"%"):"—";

  const tGrowthB=(sB[0].total&&sB[6].total)?((100*(sB[6].total-sB[0].total)/sB[0].total).toFixed(1)+"%"):"—";

  const flipsA=countyHistoryMeta[fipsA]?.flipCount??0;

  const flipsB=countyHistoryMeta[fipsB]?.flipCount??0;



  document.getElementById("h2hTable").innerHTML=`

    <thead><tr><th>Metric</th><th>${esc(labelA)}</th><th>${esc(labelB)}</th></tr></thead>

    <tbody>

      <tr><td>2000 Margin</td><td>${fmtMarginStr(m2000A)}</td><td>${fmtMarginStr(m2000B)}</td></tr>

      <tr><td>2024 Margin</td><td><strong>${fmtMarginStr(m2024A)}</strong></td><td><strong>${fmtMarginStr(m2024B)}</strong></td></tr>

      <tr><td>2000→2024 Shift</td><td>${shiftA}</td><td>${shiftB}</td></tr>

      <tr><td>2024 Votes Cast</td><td>${sA[6].total?sA[6].total.toLocaleString():"—"}</td><td>${sB[6].total?sB[6].total.toLocaleString():"—"}</td></tr>

      <tr><td>Turnout Growth ('00–'24)</td><td>${tGrowthA}</td><td>${tGrowthB}</td></tr>

      <tr><td>Party Flips ('00–'24)</td><td>${flipsA}</td><td>${flipsB}</td></tr>

    </tbody>

  `;

  document.getElementById("h2hResult").style.display="block";

}

document.getElementById("h2hCompareBtn").addEventListener("click",runHeadToHeadComparison);



// --- County autocomplete: show every county containing the typed 3+ character sequence ---
let allCountyLabels=[];
function initializeCountyAutocomplete(){
  if(!counties) return;
  allCountyLabels=[...new Set(counties.features.map(countyLabel))].sort((a,b)=>a.localeCompare(b));
  ["countySearch","h2hCountyA","h2hCountyB"].forEach(id=>{
    const input=document.getElementById(id);
    if(!input) return;
    const wrapper=document.createElement("div");
    wrapper.className="county-autocomplete";
    input.parentNode.insertBefore(wrapper,input);
    wrapper.appendChild(input);
    const suggestions=document.createElement("div");
    suggestions.className="county-suggestions";
    suggestions.setAttribute("role","listbox");
    wrapper.appendChild(suggestions);
    const hide=()=>{suggestions.style.display="none";};
    input.addEventListener("input",()=>{
      const query=input.value.trim().toLowerCase();
      suggestions.replaceChildren();
      if(query.length<3){hide();return;}
      const matches=allCountyLabels.filter(label=>label.toLowerCase().includes(query));
      matches.forEach(label=>{
        const option=document.createElement("button");
        option.type="button";
        option.textContent=label;
        option.setAttribute("role","option");
        option.addEventListener("mousedown",event=>event.preventDefault());
        option.addEventListener("click",()=>{input.value=label;hide();input.dispatchEvent(new Event("change",{bubbles:true}));});
        suggestions.appendChild(option);
      });
      if(matches.length){suggestions.style.display="block";}else{hide();}
    });
    input.addEventListener("focus",()=>input.dispatchEvent(new Event("input")));
    input.addEventListener("blur",()=>setTimeout(hide,140));
    input.addEventListener("keydown",event=>{if(event.key==="Escape") hide();});
  });
}

// --- County Rankings Explorer & CSV Export ---

function refreshCountyExplorer(){

  if(!counties) return;

  const sort=document.getElementById("rankingSort").value;

  const streakVal=streakFilter.value;



  const available=counties.features.filter(f=>{

    const p=f.properties||{};

    if(selectedStateFips&&p.stateFips!==selectedStateFips) return false;

    if(streakVal==="bellwether"&&!p.isBellwether) return false;

    if(streakVal==="swing"&&(p.flipCount||0)<2) return false;

    if(streakVal==="flip2024"&&!p.flipped2024) return false;



    if(mapMode==="shift") return p.shiftAvailable;

    if(mapMode==="turnout") return p.turnoutAvailable;

    return p.margin!==null&&p.margin!==undefined;

  });

  let rows=available.slice();



  if(mapMode==="results"&&["shiftDem","shiftRep","flip","turnoutUp","turnoutDown"].includes(sort)) rows=[];

  if(mapMode==="shift"&&["turnoutUp","turnoutDown"].includes(sort)) rows=[];

  if(mapMode==="turnout"&&["shiftDem","shiftRep","flip"].includes(sort)) rows=[];



  rows.sort((a,b)=>{

    const x=a.properties,y=b.properties;

    const mx=Number(x.margin),my=Number(y.margin);

    const sx=Number(x.shift),sy=Number(y.shift);

    const tx=Number(x.turnoutPct),ty=Number(y.turnoutPct);

    if(sort==="dem") return my-mx;

    if(sort==="rep") return mx-my;

    if(sort==="close") return Math.abs(mx)-Math.abs(my);

    if(sort==="turnout") return Number(y.total||0)-Number(x.total||0);

    if(sort==="shiftDem") return sy-sx;

    if(sort==="shiftRep") return sx-sy;

    if(sort==="flip"){

      const fx=Math.sign(mx)!==Math.sign(mx-sx);

      const fy=Math.sign(my)!==Math.sign(my-sy);

      return Number(fy)-Number(fx)||Math.abs(sy)-Math.abs(sx);

    }

    if(sort==="turnoutUp") return ty-tx;

    if(sort==="turnoutDown") return tx-ty;

    return 0;

  });



  currentRankedRows=rows;



  const from=document.getElementById("fromYear").value;

  const to=document.getElementById("toYear").value;

  const stateObj=selectedStateFips?statesByFips[selectedStateFips]:null;

  const scopePrefix=stateObj&&stateObj.properties?stateObj.properties.name+" — ":"";

  const shiftSuffix=mapMode==="results"&&npvShift!==0?` (${fmtMarginStr(npvShift)} NPV Shift)`:"";



  document.getElementById("rankingTitle").textContent=

    mapMode==="results"

      ?`County rankings — ${scopePrefix}${currentYear}${shiftSuffix}`

      :`County rankings — ${scopePrefix}${from} to ${to}`;

  const showLimit=Number(document.getElementById("rankingLimit").value)||10;

  document.getElementById("rankingCount").textContent=`Showing ${Math.min(showLimit,rows.length)} of ${rows.length.toLocaleString()} counties`;

  document.getElementById("rankingNote").textContent=

    mapMode==="results"

      ?(rows.length?"Margins reflect Democratic vs. Republican votes (including any active NPV shift). Select a row to zoom to that county.":"Switch to County Shift or Turnout Change mode for this ranking.")

      :"Select any row to zoom directly to that county on the map.";



  const body=document.getElementById("rankingBody");

  if(!rows.length){

    body.innerHTML='<tr><td colspan="6">No counties available for this ranking in the current mode.</td></tr>';

    return;

  }



  const limit=Number(document.getElementById("rankingLimit").value)||10;

  body.innerHTML=rows.slice(0,limit).map((f,i)=>{

    const p=f.properties,m=Number(p.margin),s=Number(p.shift),tPct=Number(p.turnoutPct);

    let value=fmtMarginStr(m);

    let colorClass=m>=0?"party-dem":"party-rep";



    if(mapMode==="turnout"||sort==="turnoutUp"||sort==="turnoutDown"){

      value=`${tPct>=0?"+":""}${tPct.toFixed(2)}%`;

      colorClass=tPct>=0?"text-green":"party-rep";

    }else if(sort==="shiftDem"||sort==="shiftRep"){

      value=s>0?"D+"+s.toFixed(2)+" shift":s<0?"R+"+Math.abs(s).toFixed(2)+" shift":"No change";

      colorClass=s>=0?"party-dem":"party-rep";

    }else if(sort==="flip"){

      value=Math.sign(m)!==Math.sign(m-s)?"Changed party":"No party switch";

    }



    let streakHtml="—";

    if(p.isBellwether) streakHtml=`<span class="streak-pill">${bellwetherLabel()}</span>`;

    else if((p.flipCount||0)>=2) streakHtml=`<span class="streak-pill swing">${p.flipCount} Flips</span>`;

    else if(p.flipCount===1) streakHtml=`1 Flip`;



    return `<tr data-index="${counties.features.indexOf(f)}">

      <td class="rank-number">${i+1}</td>

      <td>${esc(p.countyName)}</td>

      <td>${esc(p.state)}</td>

      <td class="${colorClass}">${esc(value)}</td>

      <td>${Number(p.total||0).toLocaleString()}</td>

      <td>${streakHtml}</td>

    </tr>`;

  }).join("");



  body.querySelectorAll("tr[data-index]").forEach(row=>row.addEventListener("click",()=>{

    const f=counties.features[Number(row.dataset.index)],p=f.properties;

    zoomToCounty(f);

    const center=featureBounds(f).getCenter();

    openCountyDetailsPopup(p,center);

  }));

}



// --- Export CSV ---

document.getElementById("exportCsvButton").addEventListener("click",()=>{

  if(!currentRankedRows.length) return;

  const headers=["Rank","FIPS","County","State","Margin","Shift","Turnout_Pct_Change","Dem_Votes","Rep_Votes","Total_Votes","Flips_Since_2000","Bellwether_2000_2024"];

  const lines=[headers.join(",")];



  currentRankedRows.forEach((f,i)=>{

    const p=f.properties;

    const row=[

      i+1,

      `"${p.mapFips||""}"`,

      `"${String(p.countyName||"").replace(/"/g,'""')}"`,

      `"${p.state||""}"`,

      p.margin!==null&&p.margin!==undefined?Number(p.margin).toFixed(2):"",

      p.shift!==null&&p.shift!==undefined?Number(p.shift).toFixed(2):"",

      p.turnoutPct!==null&&p.turnoutPct!==undefined?Number(p.turnoutPct).toFixed(2):"",

      p.dem??"",

      p.rep??"",

      p.total??"",

      p.flipCount??0,

      p.isBellwether?"Yes":"No"

    ];

    lines.push(row.join(","));

  });



  const blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8;"});

  const url=URL.createObjectURL(blob);

  const a=document.createElement("a");

  a.href=url;

  a.download=`seatcast-counties-${mapMode}-${currentYear}.csv`;

  a.click();

  URL.revokeObjectURL(url);

});



function findCounty(){

  const q=document.getElementById("countySearch").value.trim().toLowerCase();

  if(!q) return;

  const f=counties.features.find(x=>countyLabel(x).toLowerCase()===q)||

    counties.features.find(x=>countyLabel(x).toLowerCase().includes(q));

  if(!f){

    document.getElementById("searchMessage").textContent="County not found. Try county name, comma, and state abbreviation.";

    return;

  }

  zoomToCounty(f);

  const p=f.properties,center=featureBounds(f).getCenter();

  openCountyDetailsPopup(p,center);

}

document.getElementById("countySearchButton").addEventListener("click",findCounty);

document.getElementById("countySearch").addEventListener("keydown",e=>{if(e.key==="Enter")findCounty();});

document.getElementById("rankingSort").addEventListener("change",refreshCountyExplorer);

document.getElementById("rankingLimit").addEventListener("change",refreshCountyExplorer);



stateFilter.addEventListener("change",()=>{

  const val=stateFilter.value;

  if(!val){

    resetToBigMap();

  }else if(statesByFips[val]){

    zoomToState(statesByFips[val]);

  }

});



function selectYear(year){

  stopTimelapse();

  showMapMode("results");

  updateMapForYear(year);

}

function showMapMode(mode){

  if(mode!=="results") stopTimelapse();

  mapMode=mode;

  document.getElementById("resultsMode").classList.toggle("active",mode==="results");

  document.getElementById("shiftMode").classList.toggle("active",mode==="shift");

  document.getElementById("turnoutMode").classList.toggle("active",mode==="turnout");



  document.getElementById("resultsControls").style.display=mode==="results"?"block":"none";

  document.getElementById("compareControls").style.display=mode!=="results"?"block":"none";

  document.getElementById("resultsLegend").style.display=mode==="results"?"flex":"none";

  document.getElementById("shiftLegend").style.display=mode==="shift"?"flex":"none";

  document.getElementById("turnoutLegend").style.display=mode==="turnout"?"flex":"none";



  if(mode==="shift"){

    document.getElementById("compareControlsTitle").textContent="Compare two presidential elections (Margin Shift)";

    document.getElementById("compareDescription").textContent="Positive shifts mean movement toward Democrats. Negative shifts mean movement toward Republicans. The comparison uses the two-party vote margin.";

  }else if(mode==="turnout"){

    document.getElementById("compareControlsTitle").textContent="Compare two presidential elections (Turnout Change)";

    document.getElementById("compareDescription").textContent="Green indicates growth in total ballots cast; amber/orange indicates a drop in total ballots cast between the two elections.";

  }



  if(!counties) return;

  if(mode==="shift"){

    document.getElementById("rankingSort").value="shiftDem";

    updateMapForCompare();

  }else if(mode==="turnout"){

    document.getElementById("rankingSort").value="turnoutUp";

    updateMapForCompare();

  }else{

    document.getElementById("rankingSort").value="dem";

    updateMapForYear(currentYear);

  }

}



document.querySelectorAll(".year-button").forEach(button=>

  button.addEventListener("click",()=>selectYear(Number(button.dataset.year)))

);

document.getElementById("yearSlider").addEventListener("input",event=>

  selectYear(years[Number(event.target.value)])

);

document.getElementById("resultsMode").addEventListener("click",()=>showMapMode("results"));

document.getElementById("shiftMode").addEventListener("click",()=>showMapMode("shift"));

document.getElementById("turnoutMode").addEventListener("click",()=>showMapMode("turnout"));

document.getElementById("fromYear").addEventListener("change",()=>{if(mapMode!=="results")updateMapForCompare();});

document.getElementById("toYear").addEventListener("change",()=>{if(mapMode!=="results")updateMapForCompare();});



function restoreFromUrlHash(){

  if(!window.location.hash||window.location.hash.length<2) return false;

  const params=new URLSearchParams(window.location.hash.slice(1));

  isRestoringHash=true;



  const c1=params.get("c1"),c2=params.get("c2"),c3=params.get("c3");

  if(c1) document.getElementById("cutoff1").value=c1;

  if(c2) document.getElementById("cutoff2").value=c2;

  if(c3) document.getElementById("cutoff3").value=c3;

  updateResultsLegend();



  const npv=params.get("npv");

  if(npv!==null){

    npvShift=Number(npv)||0;

    npvSlider.value=Math.max(-15,Math.min(15,npvShift));

    npvInput.value=npvShift;

  }



  const mode=params.get("mode");

  const yr=Number(params.get("year"));

  const from=params.get("from");

  const to=params.get("to");

  const st=params.get("state");

  const cty=params.get("county");



  if(from&&years.includes(Number(from))) document.getElementById("fromYear").value=from;

  if(to&&years.includes(Number(to))) document.getElementById("toYear").value=to;



  if(mode==="shift"||mode==="turnout"){

    showMapMode(mode);

  }else{

    const targetYr=years.includes(yr)?yr:2024;

    updateMapForYear(targetYr);

  }



  if(cty){

    const cFeature=counties.features.find(f=>getCountyFips(f)===cty);

    if(cFeature){

      zoomToCounty(cFeature);

      openCountyDetailsPopup(cFeature.properties,featureBounds(cFeature).getCenter());

    }

  }else if(st&&statesByFips[st]){

    zoomToState(statesByFips[st]);

  }



  isRestoringHash=false;

  syncUrlHash();

  return true;

}



map.on("load",async()=>{

  try{

    updateResultsLegend();
    const lower48Camera=map.cameraForBounds(LOWER48_BOUNDS,{padding:35});
    if(lower48Camera&&Number.isFinite(lower48Camera.zoom)) LOWER48_MIN_ZOOM=lower48Camera.zoom;
    map.setMinZoom(LOWER48_MIN_ZOOM);
    map.setMaxBounds([[-130,20],[-60,55]]);

    statusBox.textContent="Loading county boundaries...";

    const boundaryResponse=await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json");

    if(!boundaryResponse.ok) throw new Error("Could not load county boundaries.");

    const topology=await boundaryResponse.json();

    counties=topojson.feature(topology,topology.objects.counties);

    const statesGeo=topojson.feature(topology,topology.objects.states);

    statesGeo.features.forEach(s=>{

      statesByFips[String(s.id).padStart(2,"0")]=s;

    });

    const stateBorders=topojson.mesh(topology,topology.objects.states,(a,b)=>a!==b);



    statusBox.textContent="Loading historical election results...";

    const dataResponse=await fetch("./seatcast_presidential_history_2000_2024.json");

    if(!dataResponse.ok) throw new Error("Could not load historical JSON. Check that the file is uploaded.");

    const electionData=await dataResponse.json();



    const yearTotals={};

    const allFipsSet=new Set();



    electionData.forEach(result=>{

      const year=Number(result.year);

      const fips=String(result.fips).padStart(5,"0");

      allFipsSet.add(fips);

      if(!resultsByYear[year]) resultsByYear[year]={};

      resultsByYear[year][fips]=result;

      if(result.state) stateAbbrByFips[fips.slice(0,2)]=result.state;



      if(!yearTotals[year]) yearTotals[year]={dem:0,rep:0};

      yearTotals[year].dem+=(Number(result.dem)||0);

      yearTotals[year].rep+=(Number(result.rep)||0);

    });



    Object.entries(yearTotals).forEach(([yr,totals])=>{

      const twoParty=totals.dem+totals.rep;

      actualNpvByYear[Number(yr)]=twoParty>0?100*(totals.dem-totals.rep)/twoParty:0;

    });



    // Compute 2000-2024 Bellwether & Flip Streaks per county

    allFipsSet.forEach(fips=>{

      let bellwetherMatches=0;

      let totalYearsPresent=0;

      let flipCount=0;

      let prevWinner=null;

      let w2020=null,w2024=null;



      years.forEach(yr=>{

        const rec=(resultsByYear[yr]||{})[fips];

        if(!rec) return;

        const d=Number(rec.dem)||0,r=Number(rec.rep)||0;

        if(d+r<=0) return;

        const w=d>r?"D":"R";

        totalYearsPresent++;

        if(w===NATIONAL_WINNER[yr]) bellwetherMatches++;

        if(prevWinner&&w!==prevWinner) flipCount++;

        prevWinner=w;

        if(yr===2020) w2020=w;

        if(yr===2024) w2024=w;

      });



      countyHistoryMeta[fips]={

        isBellwether:totalYearsPresent===years.length&&bellwetherMatches===years.length,

        flipCount,

        flipped2024:Boolean(w2020&&w2024&&w2020!==w2024)

      };

    });



    recalculateBellwethers();



    // Populate State Filter Dropdown

    Object.entries(statesByFips)

      .filter(([fips])=>Number(fips)<=56)

      .sort((a,b)=>(a[1].properties?.name||"").localeCompare(b[1].properties?.name||""))

      .forEach(([fips,sFeature])=>{

        const opt=document.createElement("option");

        opt.value=fips;

        const abbr=stateAbbrByFips[fips]?` (${stateAbbrByFips[fips]})`:"";

        opt.textContent=(sFeature.properties?.name||fips)+abbr;

        stateFilter.appendChild(opt);

      });



    statesGeo.features.forEach(sf=>{sf.properties=sf.properties||{};sf.properties.stateFips=String(sf.id).padStart(2,"0");sf.properties.fillColor="#d1d5db";});

    map.addSource("states-fill",{type:"geojson",data:statesGeo});

    map.addLayer({id:"state-fill",type:"fill",source:"states-fill",paint:{"fill-color":["get","fillColor"],"fill-opacity":0.92}});

    map.addSource("counties",{type:"geojson",data:counties});

    map.addLayer({

      id:"county-fill",type:"fill",source:"counties",

      paint:{"fill-color":["get","fillColor"],"fill-opacity":0.92}

    });

    map.addLayer({

      id:"county-outline",type:"line",source:"counties",

      paint:{"line-color":"#111827","line-width":["interpolate",["linear"],["zoom"],3,0.35,6,0.75,9,1.15],"line-opacity":0.88}

    });

    map.addLayer({

      id:"streak-outline",type:"line",source:"counties",

      filter:["==","mapFips",""],

      paint:{"line-color":"#eab308","line-width":1.6,"line-opacity":0.95}

    });

    map.addLayer({

      id:"hover-outline",type:"line",source:"counties",

      filter:["==","mapFips",""],

      paint:{"line-color":"#101827","line-width":1.8}

    });

    map.addLayer({

      id:"selected-outline",type:"line",source:"counties",

      filter:["==","mapFips",""],

      paint:{"line-color":"#f59e0b","line-width":2.6}

    });

    map.addSource("state-borders",{

      type:"geojson",

      data:{type:"Feature",geometry:stateBorders,properties:{}}

    });

    map.addLayer({

      id:"state-outline",type:"line",source:"state-borders",

      paint:{

        "line-color":"#101827",

        "line-width":["interpolate",["linear"],["zoom"],2,1.6,5,2.8,8,4.0]

      }

    });



    if(!restoreFromUrlHash()){

      updateMapForYear(2024);

      setMapRegion("lower48");

    }

    initializeCountyAutocomplete();
    applyMapView();
    applyStreakMapHighlight();
    const marginCard=document.querySelector("#resultsControls .control-card:has(#cutoff1)");
    if(marginCard) document.getElementById("settingsMarginSlot").appendChild(marginCard);
    document.getElementById("settingsOutline").value=mapHighlightSelect.value;
    document.getElementById("settingsMapView").value=mapView;

    statusBox.textContent="Historical election map loaded successfully.";



    applyMapView();

    map.on("mousemove","state-fill",event=>{

      map.getCanvas().style.cursor="pointer";

      const p=event.features[0].properties;

      const stateValue=p.margin===null||p.margin===undefined?"No data":
        mapMode==="turnout"
          ?`Turnout change: ${Number(p.margin)>=0?"+":""}${Number(p.margin).toFixed(2)}% (${document.getElementById("fromYear").value}→${document.getElementById("toYear").value})`
          :mapMode==="shift"
            ?`Margin shift: ${fmtMarginStr(Number(p.margin))}`
            :`${fmtMarginStr(Number(p.margin))} — ${currentYear}`;
      hoverTooltip.innerHTML=`<div class="tt-title">${esc(p.name||"State")}</div><div class="tt-stat">${stateValue}</div><div class="tt-hint">Click to explore counties</div>`;

      hoverTooltip.style.display="block";

      hoverTooltip.style.left=Math.min(event.point.x+14,map.getContainer().clientWidth-220)+"px";

      hoverTooltip.style.top=Math.min(event.point.y+14,map.getContainer().clientHeight-70)+"px";

    });

    map.on("mouseleave","state-fill",()=>{map.getCanvas().style.cursor="";hoverTooltip.style.display="none";});

    map.on("click","state-fill",event=>{

      const sf=statesByFips[String(event.features[0].properties.stateFips).padStart(2,"0")];

      if(sf) zoomToState(sf);

    });



    // Hover over county

    map.on("mousemove","county-fill",event=>{

      map.getCanvas().style.cursor="pointer";

      const p=event.features[0].properties;

      const stateDisplay=p.stateFullName||p.state||"";

      if(selectedStateFips&&p.stateFips!==selectedStateFips){
        map.setFilter("hover-outline",["==","mapFips",""]);
        hoverTooltip.innerHTML=`<div class="tt-title">${esc(stateDisplay||"Another state")}</div><div class="tt-hint">Click to zoom into ${esc(stateDisplay||"this state")}</div>`;
        hoverTooltip.style.display="block";
        const mapRect=map.getContainer().getBoundingClientRect();
        let left=event.point.x+14,top=event.point.y+14;
        if(left+245>mapRect.width) left=event.point.x-245;
        if(top+95>mapRect.height) top=event.point.y-95;
        hoverTooltip.style.left=Math.max(8,left)+"px";
        hoverTooltip.style.top=Math.max(8,top)+"px";
        return;
      }

      map.setFilter("hover-outline",["==","mapFips",p.mapFips||""]);

      const title=(p.countyName||"County")+(stateDisplay?", "+(p.state||stateDisplay):"");

      let statHtml=`<div class="tt-stat tt-neutral">No data</div>`;



      if(mapMode==="turnout"&&p.turnoutAvailable){

        const pct=Number(p.turnoutPct);

        const cls=pct>=0?"tt-green":"tt-amber";

        statHtml=`<div class="tt-stat ${cls}">${p.fromYear}→${p.toYear}: ${pct>=0?"+":""}${pct.toFixed(2)}% ballots</div>`;

      }else if(mapMode==="shift"&&p.shiftAvailable){

        const s=Number(p.shift);

        const cls=s>0?"tt-dem":s<0?"tt-rep":"tt-neutral";

        const txt=s>0?`D+${s.toFixed(2)} shift`:s<0?`R+${Math.abs(s).toFixed(2)} shift`:"No change";

        statHtml=`<div class="tt-stat ${cls}">${p.fromYear}→${p.toYear}: ${txt}</div>`;

      }else if(mapMode==="results"&&p.margin!==null&&p.margin!==undefined){

        const m=Number(p.margin);

        const cls=m>0?"tt-dem":m<0?"tt-rep":"tt-neutral";

        const adjLabel=npvShift!==0?" (adj.)":"";

        statHtml=`<div class="tt-stat ${cls}">${currentYear}: ${fmtMarginStr(m)}${adjLabel}</div>`;

        if(document.getElementById("compareNpvToggle")?.checked){
          const nationalNpv=(actualNpvByYear[currentYear]??0)+npvShift;
          const relative=m-nationalNpv;
          const relativeText=relative>0?`D+${relative.toFixed(2)} vs NPV`:relative<0?`R+${Math.abs(relative).toFixed(2)} vs NPV`:"Matches national NPV";
          statHtml+=`<div class="tt-stat tt-neutral">${relativeText} (National: ${fmtMarginStr(nationalNpv)})</div>`;
        }

      }



      const badgeHtml=p.isBellwether

        ?`<div class="tt-badge">${bellwetherLabel()}</div>`

        :(p.flipCount>=2?`<div class="tt-badge">Swing County (${p.flipCount} flips)</div>`:"");



      const hint=map.getZoom()<STATE_ZOOM_THRESHOLD&&!selectedStateFips

        ?`Click to zoom to ${esc(p.stateFullName||stateDisplay||"state")}`

        :"Click for county details & history";



      hoverTooltip.innerHTML=`

        <div class="tt-title">${esc(title)}</div>

        ${statHtml}

        ${badgeHtml}

        <div class="tt-hint">${hint}</div>

      `;

      hoverTooltip.style.display="block";



      const mapRect=map.getContainer().getBoundingClientRect();

      let left=event.point.x+14;

      let top=event.point.y+14;

      if(left+245>mapRect.width) left=event.point.x-245;

      if(top+95>mapRect.height) top=event.point.y-95;

      hoverTooltip.style.left=Math.max(8,left)+"px";

      hoverTooltip.style.top=Math.max(8,top)+"px";

    });



    map.on("mouseleave","county-fill",()=>{

      map.getCanvas().style.cursor="";

      hoverTooltip.style.display="none";

      map.setFilter("hover-outline",["==","mapFips",""]);

    });



    // Click handler

    map.on("click",event=>{

      if(mapView==="state"&&(!selectedStateFips||map.getZoom()<STATE_ZOOM_THRESHOLD)) return;

      const features=map.queryRenderedFeatures(event.point,{layers:["county-fill"]});



      if(!features.length){

        if(map.getZoom()>DEFAULT_ZOOM+0.35||selectedStateFips||activePopup){

          resetToBigMap();

        }

        return;

      }



      const p=features[0].properties;

      if(selectedStateFips&&p.stateFips!==selectedStateFips){
        const otherState=statesByFips[p.stateFips];
        if(otherState) zoomToState(otherState);
        return;
      }

      if(map.getZoom()<STATE_ZOOM_THRESHOLD&&!selectedStateFips){

        const stateFeature=statesByFips[p.stateFips];

        if(stateFeature){

          zoomToState(stateFeature);

          return;

        }

      }



      setSelectedCountyHighlight(p.mapFips||"");

      openCountyDetailsPopup(p,event.lngLat);

    });

  }catch(error){

    showError(error.message);

    statusBox.textContent="Map failed to load.";

  }

});
