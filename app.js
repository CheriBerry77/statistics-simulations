
let chart;

function buildPopulation(rate){
 let pop=[];
 for(let i=0;i<10000;i++){
   pop.push({
    support:Math.random()<rate,
    group:Math.random()<0.5?'A':'B'
   });
 }
 return pop;
}

function drawSample(pop,size,method){
 let s=[];
 if(method==='srs'){
   s=[...pop].sort(()=>Math.random()-0.5).slice(0,size);
 }
 else if(method==='convenience'){
   s=pop.slice(0,size);
 }
 else if(method==='voluntary'){
   s=pop.filter(p=>p.support?Math.random()<0.8:Math.random()<0.2).slice(0,size);
 }
 else if(method==='stratified'){
   let a=pop.filter(x=>x.group==='A').slice(0,size/2);
   let b=pop.filter(x=>x.group==='B').slice(0,size/2);
   s=[...a,...b];
 }
 else{
   s=pop.filter(x=>x.group==='A').slice(0,size);
 }
 return s;
}

function proportion(arr){
 return arr.filter(x=>x.support).length/arr.length;
}

function runOnce(){
 const rate=Number(document.getElementById('support').value)/100;
 const size=Number(document.getElementById('size').value);
 const method=document.getElementById('method').value;

 const pop=buildPopulation(rate);
 const samp=drawSample(pop,size,method);

 const p=proportion(pop);
 const phat=proportion(samp);
 const moe=1.96*Math.sqrt(phat*(1-phat)/size);

 document.getElementById('results').innerHTML=
 `Population=${(p*100).toFixed(2)}%<br>
 Sample=${(phat*100).toFixed(2)}%<br>
 Error=${(Math.abs(phat-p)*100).toFixed(2)}%<br>
 95% CI: [${((phat-moe)*100).toFixed(1)}%, ${((phat+moe)*100).toFixed(1)}%]`;
}

function runMany(){
 const rate=Number(document.getElementById('support').value)/100;
 const size=Number(document.getElementById('size').value);
 const method=document.getElementById('method').value;

 const pop=buildPopulation(rate);
 const trueP=proportion(pop);

 let vals=[];
 let cover=0;

 for(let i=0;i<1000;i++){
   const s=drawSample(pop,size,method);
   const phat=proportion(s);
   vals.push(phat);

   const moe=1.96*Math.sqrt(phat*(1-phat)/size);
   if(phat-moe<=trueP && trueP<=phat+moe) cover++;
 }

 const bins=new Array(20).fill(0);
 vals.forEach(v=>{
   let idx=Math.min(19,Math.floor(v*20));
   bins[idx]++;
 });

 if(chart) chart.destroy();

 chart=new Chart(document.getElementById('hist'),{
   type:'bar',
   data:{
    labels:bins.map((_,i)=>i),
    datasets:[{label:'Sampling Distribution',data:bins}]
   }
 });

 const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
 document.getElementById('results').innerHTML +=
 `<br><br>Average Estimate: ${(avg*100).toFixed(2)}%
 <br>Long-run Bias: ${((avg-trueP)*100).toFixed(2)}%
 <br>Coverage Rate: ${(cover/10).toFixed(1)}%`;
}

let answer='';
function newChallenge(){
 const methods=['srs','convenience','voluntary','stratified','cluster'];
 answer=methods[Math.floor(Math.random()*methods.length)];
 document.getElementById('challenge').innerHTML=
 `Challenge: Guess which sampling method produced a hidden sample.
 <br><button onclick="reveal()">Reveal Answer</button>`;
}
function reveal(){
 document.getElementById('challenge').innerHTML += `<br>Answer: ${answer}`;
}
