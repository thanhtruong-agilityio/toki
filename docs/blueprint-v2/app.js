/* Toki Blueprint v2. Every interface string is "English||Tiếng Việt"; L() picks one. Data comes per language from build.py. */
const ORD={C:0,H:1,M:2,L:3};
const STATUSES=["Open","In Review","Confirmed","Rejected","Deferred","Accepted Assumption"];
const STL={"Open":"Open||Còn mở","In Review":"In Review||Đang xem xét","Confirmed":"Confirmed||Đã chốt","Rejected":"Rejected||Loại bỏ","Deferred":"Deferred||Hoãn lại","Accepted Assumption":"Accepted Assumption||Giả định được chấp nhận"};
const STC={"Open":"H","In Review":"a","Confirmed":"ok","Rejected":"L","Deferred":"L","Accepted Assumption":"ok"};
const DONE=new Set(["Confirmed","Rejected","Deferred","Accepted Assumption"]);
const KEY="toki-blueprint-v2";
const SRCL={user:"Your own answer||Bạn tự trả lời",recommended:"You chose the recommended option||Bạn chọn phương án được đề xuất",deferred:"Deferred||Hoãn lại"};
let S={tab:0,status:{},f:{},lang:"en"};
try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s&&s.status)S=Object.assign(S,s)}catch(e){}
if(!ALL[S.lang])S.lang="en";
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const L=s=>{const i=s.indexOf("||");return i<0?s:S.lang==="vi"?s.slice(i+2):s.slice(0,i)};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/`(.+?)`/g,"<span class='id'>$1</span>");
const pill=(t,c)=>"<span class='pill "+c+"'>"+esc(t)+"</span>";
const SEVL={C:"Critical||Nghiêm trọng",H:"High||Cao",M:"Medium||Trung bình",L:"Low||Thấp"};
const TTL={P:"Positive||Tích cực",N:"Negative||Phủ định",B:"Boundary||Biên",X:"Exception||Ngoại lệ"},TTC={P:"ok",N:"C",B:"H",X:"a"};
const KIND={ans:"Brainstorming answer||Trả lời khi brainstorming",gas:"Confirmed assumption||Giả định đã xác nhận",rev:"Review answer||Trả lời khi review",rule:"Rule from a gap||Quy tắc từ gap",q:"Question||Câu hỏi",asm:"Assumption||Giả định"};
const sev=s=>s?pill(L(SEVL[s]),s):"";
const id=s=>"<span class='id'>"+esc(s)+"</span>";
const ids=a=>"<span class='id' style='white-space:normal'>"+esc(a.join(" ")||"—")+"</span>";
const table=(head,rows,cls)=>"<div class='scroll'><table><thead><tr>"+head.map(h=>"<th>"+esc(L(h))+"</th>").join("")+"</tr></thead><tbody>"+(rows.length?rows.map(r=>"<tr>"+r.map((c,i)=>"<td class='"+((cls||[])[i]||"")+"'>"+c+"</td>").join("")+"</tr>").join(""):"<tr><td colspan='"+head.length+"' style='color:var(--muted)'>"+L("Nothing matches these filters.||Không có gì khớp với bộ lọc.")+"</td></tr>")+"</tbody></table></div>";
const h3=s=>"<h3>"+esc(L(s))+"</h3>";
const note=(s,c)=>"<div class='note "+(c||"")+"'>"+fmt(L(s))+"</div>";
const stats=a=>"<div class='stats'>"+a.map(x=>"<div class='stat'><b>"+x[0]+"</b><span>"+esc(L(x[1]))+"</span></div>").join("")+"</div>";
const sel=(k,label,opts,show)=>"<label for='f-"+k+"'>"+L(label)+"</label><select id='f-"+k+"' data-f='"+k+"'><option value=''>"+L("All||Tất cả")+"</option>"+opts.map(o=>"<option value='"+esc(o)+"'"+(F(k)===o?" selected":"")+">"+esc(show?show(o):o)+"</option>").join("")+"</select>";
const F=k=>S.f[k]==null?(k==="dst"?"open":""):S.f[k];
const uniq=a=>[...new Set(a)];
const shown=n=>"<span class='id'>"+n+L(" shown|| đang hiện")+"</span>";
const title=(eyebrow,t,lede)=>"<div><div class='eyebrow'>"+esc(L(eyebrow))+"</div><h2>"+esc(L(t))+"</h2><p class='lede'>"+fmt(L(lede))+"</p></div>";
const fold=(left,mid,right,body,open)=>"<details class='fr'"+(open?" open":"")+"><summary>"+left+"<span>"+mid+"</span>"+(right||"<span></span>")+"</summary><div class='body'>"+body+"</div></details>";
function block(b){switch(b.type){
 case"h":return"<h3>"+fmt(b.text)+"</h3>";case"p":return"<p class='lede' style='margin:0'>"+fmt(b.text)+"</p>";
 case"note":return"<div class='note'>"+fmt(b.text)+"</div>";
 case"list":return(b.ordered?"<ol class='plain' style='padding-left:22px'>":"<ul class='plain'>")+b.items.map(i=>"<li>"+fmt(i)+"</li>").join("")+(b.ordered?"</ol>":"</ul>");
 case"table":return table(b.head,b.rows.map(r=>r.map(fmt)));
 case"pre":return"<pre class='code'>"+esc(b.text)+"</pre>";
 case"svg":return"<figure class='chart'>"+b.svg+"</figure>"+(b.caption?"<p class='cap'>"+fmt(b.caption)+"</p>":"");
 case"cols":return"<div class='cols'>"+b.boxes.map(x=>"<div><h4>"+fmt(x.title)+"</h4><ul class='plain'>"+x.items.map(i=>"<li>"+fmt(i)+"</li>").join("")+"</ul></div>").join("")+"</div>";
 default:return""}}

/* ---- state derived from the decision log ---- */
let D,DEC,allAC,allTS;
function load(){D=ALL[S.lang];DEC=Object.fromEntries(D.decisions.map(d=>[d.id,d]));
  allAC=D.frs.flatMap(f=>f.acs.map(a=>Object.assign({fr:f.id},a)));allTS=allAC.flatMap(a=>a.tests.map(t=>Object.assign({ac:a.id,fr:a.fr},t)))}
load();
const st=i=>S.status[i]||DEC[i].status;
const isOpen=i=>!DONE.has(st(i));
const openQ=()=>D.decisions.filter(d=>d.kind==="q"&&isOpen(d.id));
const blockers=()=>openQ().filter(d=>ORD[d.sev]<=1);
const openA=()=>D.decisions.filter(d=>d.kind==="asm"&&isOpen(d.id));
function frState(f){const o=f.open.filter(isOpen),qs=o.filter(i=>DEC[i].kind==="q");
  if(qs.some(i=>ORD[DEC[i].sev]<=1))return"B";if(qs.length)return"Q";return o.length?"A":"R"}
const FRS={R:["Ready||Sẵn sàng","ok"],A:["Ready if assumptions accepted||Sẵn sàng nếu chấp nhận giả định","a"],Q:["Core ready, details open||Lõi sẵn sàng, chi tiết còn mở","M"],B:["Blocked||Bị chặn","C"]};
const FRBY=()=>Object.fromEntries(D.frs.map(f=>[f.id,f]));
const chartBlocked=c=>c.open.filter(i=>DEC[i].kind==="q"&&ORD[DEC[i].sev]<=1&&isOpen(i));
function verdict(){const b=blockers().length,o=openQ().length+openA().length;
  if(b)return[L("Not ready||Chưa sẵn sàng"),"C",b+L(" high-priority questions open|| câu hỏi ưu tiên cao còn mở"),"bad"];
  if(o)return[L("Ready with accepted risks||Sẵn sàng, có rủi ro được chấp nhận"),"M",o+L(" lower-priority items open|| mục ưu tiên thấp hơn còn mở"),"warn"];
  return[L("Ready||Sẵn sàng"),"ok",L("Every question and assumption has a decision||Mọi câu hỏi và giả định đều có quyết định"),"good"]}
const dref=i=>"<a href='#' data-d='"+i+"' class='id' title='"+esc(DEC[i]?DEC[i].old:"")+"'>"+i+"</a>";
const drefs=a=>a.length?a.map(dref).join(" "):"—";
const stSel=i=>"<select data-st='"+i+"' id='st-"+i+"' aria-label='"+i+"'>"+STATUSES.map(s=>"<option value='"+s+"'"+(st(i)===s?" selected":"")+">"+L(STL[s])+"</option>").join("")+"</select>";

const TABS=[
 ["Overview||Tổng quan",()=>verdict()[0]],
 ["Prototype||Prototype",()=>D.screens.length+L(" screens|| màn hình")],
 ["Findings||Phát hiện",()=>D.findings.length],
 ["Decisions||Quyết định",()=>openQ().length+L(" open|| mở")],
 ["Flows||Flow",()=>D.charts.length+" + "+D.written.length],
 ["Requirements||Yêu cầu",()=>D.frs.length+" FR"],
 ["QA||QA",()=>allTS.length+" TS"],
 ["Technical||Kỹ thuật",()=>""],
 ["Plan||Kế hoạch",()=>D.milestones.length+" M"]];

const VIEW=[
/* 1 · Overview */
()=>{const v=verdict(),b=blockers(),o=D.overview,n=k=>D.frs.filter(f=>frState(f)===k).length;
 return title("Overview||Tổng quan","Where Toki stands, and what it needs from you||Toki đang ở đâu, và cần gì từ bạn",o.summary)
 +"<div class='note "+v[3]+"'>"+pill(v[0],v[1]+" big")+" &nbsp;"+esc(v[2])+". "+L("Every number on this page is counted from the decision log; change a status on the Decisions tab and it moves.||Mọi con số trên trang này được đếm từ sổ quyết định; đổi một trạng thái ở tab Quyết định thì chúng đổi theo.")+"</div>"
 +stats([[D.decisions.filter(d=>!isOpen(d.id)).length,"decisions settled||quyết định đã chốt"],[openQ().length,"questions open||câu hỏi còn mở"],[b.length,"of them blocking||trong đó đang chặn"],[openA().length,"assumptions undecided||giả định chưa quyết định"],[(n("R")+n("A"))+"/"+D.frs.length,"requirements can start||yêu cầu bắt đầu được"]])
 +h3("Needed from you first||Cần từ bạn trước tiên")+table(["ID","Decision needed||Cần quyết định","Who decides||Ai quyết định","Holds up||Giữ chân"],b.map(q=>[dref(q.id),"<b>"+fmt(q.q)+"</b>",esc(q.owner),ids(D.frs.filter(f=>f.open.includes(q.id)).map(f=>f.id))]),["","w","n",""])
 +"<div class='two'><div>"+h3("Product||Sản phẩm")+"<ul class='plain' style='margin-top:8px'>"+o.product.map(x=>"<li>"+fmt(x)+"</li>").join("")+"</ul></div><div>"+h3("Technical||Kỹ thuật")+"<ul class='plain' style='margin-top:8px'>"+o.technical.map(x=>"<li>"+fmt(x)+"</li>").join("")+"</ul></div></div>"
 +h3("How this page was reorganised on 13 Nov 2026||Trang này được sắp xếp lại thế nào ngày 13/11/2026")+table(["Before||Trước đây","Now||Bây giờ","Why||Vì sao"],[
  ["Nine id series for questions and assumptions (Q, OQ, G, NR, FA, FQ, GQ, AS, VQ) across four tabs||Chín dãy mã cho câu hỏi và giả định (Q, OQ, G, NR, FA, FQ, GQ, AS, VQ) rải trên bốn tab","One decision log, D-001 onward, each with a status. The earlier id stays in its own column.||Một sổ quyết định, từ D-001, mỗi mục có trạng thái. Mã cũ nằm ở một cột riêng.","One place answers 'what is still open?'||Một nơi trả lời 'còn gì chưa chốt?'"],
  ["Gaps in two lists (GAP, N), merged again in a third (T)||Gap ở hai danh sách (GAP, N), gộp lại ở danh sách thứ ba (T)","One findings backlog of 15; the 72 detailed findings open inside each.||Một backlog 15 phát hiện; 72 phát hiện chi tiết mở ra bên trong từng mục.","Each problem appears once||Mỗi vấn đề chỉ xuất hiện một lần"],
  ["Questions & Gaps, Gap analysis and Validation overlapped||Questions & Gaps, Gap analysis và Validation chồng lên nhau","Findings → Decisions → Requirements → QA, the order of the BA & QA workflow.||Phát hiện → Quyết định → Yêu cầu → QA, đúng thứ tự của quy trình BA & QA.","Tabs follow what the reader needs next||Tab đi theo thứ người đọc cần tiếp theo"],
  ["The Flows tab also held rules, assumptions and questions||Tab Flows chứa cả quy tắc, giả định và câu hỏi","Flows holds charts and written journeys only.||Flows chỉ chứa sơ đồ và hành trình đã viết.","A tab does one job||Mỗi tab làm một việc"],
  ["Plan, Milestones and Roadmap: three tabs, written before validation||Plan, Milestones và Roadmap: ba tab, viết trước khi kiểm định","One Plan tab that opens with the readiness gate; each area shows the requirements it builds and whether it may start.||Một tab Kế hoạch mở đầu bằng cổng sẵn sàng; mỗi mảng cho thấy các yêu cầu nó thực hiện và đã bắt đầu được chưa.","The plan follows the requirements||Kế hoạch đi sau yêu cầu"]].map(r=>r.map(x=>esc(L(x)))),["w","w","w"])},
/* 2 · Prototype */
()=>title("Tab 2||Tab 2","The prototype, and what is in it||Prototype, và những gì có trong đó","The prototype itself, usable here, then the inventory of its screens. It simulates one person, always an Owner, with sample data and instant actions.||Chính prototype, dùng được ngay tại đây, rồi tới danh mục màn hình. Nó mô phỏng một người, luôn là Owner, với dữ liệu mẫu và thao tác tức thì.")
 +"<iframe class='pframe' id='pf' title='Prototype'></iframe>"
 +stats([[D.screens.length,"screens and panels||màn hình và panel"],[D.counts.actions,"actions handled||thao tác được xử lý"]])
 +h3("Screen inventory||Danh mục màn hình")+table(["Screen||Màn hình","Purpose||Mục đích","Main actions||Thao tác chính","Release phase||Phase phát hành"],D.screens.map(s=>["<b>"+esc(s.name)+"</b>",esc(s.purpose),esc(s.actions),esc(s.phase)]),["","w","w","n"]),
/* 3 · Findings */
()=>{const rows=D.findings.filter(f=>!F("fsev")||f.sev===F("fsev")).sort((a,b)=>ORD[a.sev]-ORD[b.sev]),n=D.findings.reduce((a,f)=>a+f.details.length,0);
 return title("Tab 3||Tab 3","What is missing or wrong||Những gì còn thiếu hoặc sai","One backlog. Each finding merges the detailed observations behind it and points to the decisions that would settle it. Open a row to see the detail.||Một backlog duy nhất. Mỗi phát hiện gộp các quan sát chi tiết đứng sau nó và trỏ tới các quyết định sẽ giải quyết nó. Mở một dòng để xem chi tiết.")
 +stats([[D.findings.length,"findings||phát hiện"],[n,"detailed observations inside||quan sát chi tiết bên trong"],[D.findings.filter(f=>f.sev==="C").length,"critical||nghiêm trọng"],[D.conflicts.length,"conflicts||mâu thuẫn"]])
 +"<div class='bar'>"+sel("fsev","Priority||Ưu tiên",["C","H","M","L"],o=>L(SEVL[o]))+shown(rows.length)+"</div><div>"
 +rows.map(f=>{const od=f.decisions.filter(isOpen);return fold(id(f.id),"<b>"+esc(f.text)+"</b><small style='display:block;color:var(--muted)'>"+esc(f.cat)+" · "+esc(f.owner)+" · "+f.details.length+L(" observations|| quan sát")+" · "+od.length+L(" decisions open|| quyết định còn mở")+"</small>",sev(f.sev),
   "<dl><dt>"+L("Business impact||Ảnh hưởng")+"</dt><dd>"+esc(f.impact)+"</dd><dt>"+L("Depends on · status||Phụ thuộc · tình trạng")+"</dt><dd>"+(fmt(f.note)||"—")+"</dd><dt>"+L("Decisions||Quyết định")+"</dt><dd>"+drefs(f.decisions)+"</dd></dl>"
   +(f.details.length?table(["ID","Observation||Quan sát","Evidence · required behaviour||Bằng chứng · hành vi yêu cầu","Type||Loại","Severity||Mức độ"],f.details.map(d=>[id(d.id),"<b>"+esc(d.text)+"</b>"+(d.status?"<small>"+fmt(d.status)+"</small>":""),esc(d.evidence),esc(d.type),sev(d.sev)]),["","w","w","n",""]):""))}).join("")+"</div>"
 +h3("Conflicts between the prototype and a decision||Mâu thuẫn giữa prototype và một quyết định")+table(["Topic||Chủ đề","The prototype||Prototype","Against||Đối lập với","Standing||Tình trạng"],D.conflicts.map(r=>r.map(fmt)))
 +h3("Dependencies||Phụ thuộc")+table(["Settle this first||Việc này phải xong trước","Because it holds up||Vì nó giữ chân"],D.depends.map(r=>r.map(esc)))},
/* 4 · Decisions */
()=>{const owners=uniq(D.decisions.flatMap(d=>d.owner.split(", ")).filter(Boolean)),q=(F("dq")||"").toLowerCase();
 const rows=D.decisions.filter(d=>(F("dst")===""||(F("dst")==="open"?isOpen(d.id):st(d.id)===F("dst")))&&(!F("dk")||d.kind===F("dk"))&&(!F("dsev")||d.sev===F("dsev"))&&(!F("down")||d.owner.includes(F("down")))&&(!q||(d.id+" "+d.old+" "+d.q+" "+d.a).toLowerCase().includes(q)))
  .sort((a,b)=>(isOpen(b.id)-isOpen(a.id))||((ORD[a.sev]??9)-(ORD[b.sev]??9))||a.id.localeCompare(b.id));
 return title("Tab 4||Tab 4","What is decided, and what still needs an answer||Đã chốt gì, và còn gì cần trả lời","One log for every question, answer, rule and assumption. An assumption is a decision that has not been confirmed yet, so it lives here with a status like the rest. The proposal of an open item is a suggestion and is used nowhere until confirmed.||Một sổ cho mọi câu hỏi, câu trả lời, quy tắc và giả định. Giả định là một quyết định chưa được xác nhận, nên nó nằm ở đây với trạng thái như các mục khác. Đề xuất của một mục còn mở chỉ là gợi ý và không được dùng ở đâu cho tới khi được chốt.")
 +stats([[D.decisions.length,"entries||mục"],[D.decisions.filter(d=>!isOpen(d.id)).length,"settled||đã chốt"],[openQ().length,"questions open||câu hỏi còn mở"],[blockers().length,"blocking||đang chặn"],[openA().length,"assumptions undecided||giả định chưa quyết định"]])
 +"<div class='bar'><label for='f-dst'>"+L("Status||Trạng thái")+"</label><select id='f-dst' data-f='dst'><option value=''>"+L("All||Tất cả")+"</option><option value='open'"+(F("dst")==="open"?" selected":"")+">"+L("Not settled||Chưa chốt")+"</option>"+STATUSES.map(s=>"<option value='"+s+"'"+(F("dst")===s?" selected":"")+">"+L(STL[s])+"</option>").join("")+"</select>"
 +sel("dk","Kind||Loại",Object.keys(KIND),o=>L(KIND[o]))+sel("dsev","Priority||Ưu tiên",["C","H","M","L"],o=>L(SEVL[o]))+sel("down","Who decides||Ai quyết định",owners)
 +"<label for='f-dq'>"+L("Find||Tìm")+"</label><input type='search' id='f-dq' data-f='dq' value='"+esc(F("dq"))+"' placeholder='"+L("id, earlier id or words||mã, mã cũ hoặc từ khoá")+"'>"+shown(rows.length)+"<button class='btn' data-quick='brain'>"+L("Brainstorming questions||Câu hỏi brainstorming")+"</button><button class='btn' data-act='reset'>"+L("Reset statuses||Đặt lại trạng thái")+"</button></div>"
 +table(["ID","Kind||Loại","Question||Câu hỏi","Answer · proposal||Câu trả lời · đề xuất","Who decides||Ai quyết định","Priority||Ưu tiên","Status||Trạng thái"],rows.map(d=>["<span id='row-"+d.id+"'>"+id(d.id)+"</span><div class='sub'>"+esc(d.old)+"</div>",esc(L(KIND[d.kind]))+(d.topic?"<div class='sub' style='font-family:var(--sans)'>"+esc(d.topic)+"</div>":""),"<b>"+fmt(d.q)+"</b>"+(d.options?"<small>"+L("Options: ||Phương án: ")+fmt(d.options)+"</small>":""),(isOpen(d.id)&&d.kind!=="asm"?"<small style='margin:0 0 3px'>"+L("Proposal, not confirmed||Đề xuất, chưa chốt")+"</small>":"")+fmt(d.a)+(d.source&&SRCL[d.source]?"<small>"+L(SRCL[d.source])+"</small>":""),esc(d.owner),sev(d.sev),stSel(d.id)]),["n","n","w","w","n","",""])
 +(D.stillOpen.length?h3("Decided later, on purpose||Chủ động để quyết định sau")+table(["Item||Hạng mục","Decide when||Quyết định khi nào","Note||Ghi chú"],D.stillOpen.map(o=>["<b>"+fmt(o.item)+"</b>",esc(o.when||""),fmt(o.note||"")]),["w","n","w"]):"")
 +note("Statuses you set here are kept in this browser only. To record an answer for good, tell Claude; it is written into the data and every tab is rebuilt from it.||Trạng thái bạn đặt ở đây chỉ lưu trong trình duyệt này. Để ghi nhận hẳn một câu trả lời, hãy nói với Claude; nó được ghi vào dữ liệu và mọi tab được dựng lại từ đó.")},
/* 5 · Flows */
()=>{const groups=uniq(D.charts.map(c=>c.group)),wg=uniq(D.written.map(f=>f.group));
 return title("Tab 5||Tab 5","How people move through Toki||Người dùng đi qua Toki thế nào","Charts first, then the written step-by-step journeys. Under each chart: what the prototype has, and the decisions behind each condition. Rules, assumptions and questions are no longer kept here; they are on the Decisions and Requirements tabs.||Sơ đồ trước, rồi tới các hành trình viết từng bước. Dưới mỗi sơ đồ: prototype có gì, và các quyết định đứng sau từng điều kiện. Quy tắc, giả định và câu hỏi không còn nằm ở đây; chúng ở tab Quyết định và Yêu cầu.")
 +stats([[D.charts.length,"charts||sơ đồ"],[D.charts.filter(c=>chartBlocked(c).length).length,"blocked by a question||bị chặn bởi một câu hỏi"],[D.written.filter(f=>String(f.phase)==="1").length,"written journeys, phase 1||hành trình đã viết, phase 1"],[D.written.filter(f=>String(f.phase)!=="1").length,"outlines for later phases||phác thảo cho phase sau"]])
 +groups.map(g=>"<h3>"+esc(g)+"</h3><div>"+D.charts.filter(c=>c.group===g).map(c=>{const b=chartBlocked(c),o=c.open.filter(isOpen);
   return fold(id(c.id),"<b>"+esc(c.title.split(" ").slice(1).join(" "))+"</b>",b.length?pill(L("Blocked||Bị chặn"),"C"):o.length?pill(L("Valid, details open||Hợp lệ, chi tiết còn mở"),"M"):pill(L("Valid||Hợp lệ"),"ok"),
    "<figure class='chart'>"+c.svg+"</figure>"+(c.caption?"<p class='cap'>"+fmt(c.caption)+"</p>":"")+"<ul class='plain'>"+c.notes.map(n=>"<li>"+fmt(n)+"</li>").join("")+"</ul>"
    +"<dl><dt>"+L("Waits on||Chờ")+"</dt><dd>"+drefs(o)+"</dd></dl>"
    +"<details class='fr'><summary><span class='id'>"+c.sources.length+"</span><b>"+L("Sources||Nguồn")+"</b><span></span></summary><div class='body' style='padding-left:14px'><ul class='plain'>"+c.sources.map(s=>Array.isArray(s)?"<li><b>"+fmt(s[0])+"</b><br>"+fmt(s[1])+"</li>":"<li>"+fmt(s)+"</li>").join("")+"</ul></div></details>")}).join("")+"</div>").join("")
 +h3("Written journeys||Hành trình đã viết")+note("Drafted by Claude under D-019; several were never confirmed line by line. They are a proposal until the question about accepting them is answered.||Do Claude soạn theo D-019; nhiều hành trình chưa từng được xác nhận từng dòng. Chúng là đề xuất cho tới khi câu hỏi về việc chấp nhận chúng được trả lời.","warn")
 +wg.map(g=>"<h3 style='font-size:13px;color:var(--muted)'>"+esc(g)+"</h3><div>"+D.written.filter(f=>f.group===g).map(f=>fold(id(f.id),"<b>"+esc(f.title)+"</b>","<span class='sub'>"+(String(f.phase)!=="1"?"phase "+esc(f.phase)+" · ":"")+esc(f.roles.join(" · "))+"</span>",
    (f.context?"<p style='margin:0'><b>"+L("Context||Bối cảnh")+":</b> "+fmt(f.context)+"</p>":"")+"<ol class='plain' style='padding-left:20px;margin:0;color:var(--ink-2)'>"+f.steps.map(s=>"<li>"+fmt(s)+"</li>").join("")+"</ol>"+(f.cases.length?"<ul class='plain'>"+f.cases.map(s=>"<li>"+fmt(s)+"</li>").join("")+"</ul>":""))).join("")+"</div>").join("")},
/* 6 · Requirements */
()=>{const areas=uniq(D.frs.map(f=>f.area)),rows=D.frs.filter(f=>(!F("area")||f.area===F("area"))&&(!F("rs")||frState(f)===F("rs"))),n=k=>D.frs.filter(f=>frState(f)===k).length,cap=D.capabilities;
 return title("Tab 6||Tab 6","What must be built||Phải làm những gì","Scope, roles, business rules, then the requirements. A functional requirement states only what was decided and quotes the answer; whatever is still open is listed under it and is not part of it. Its acceptance criteria are inside each requirement.||Phạm vi, vai trò, quy tắc nghiệp vụ, rồi tới yêu cầu. Yêu cầu chức năng chỉ nêu những gì đã được quyết định và trích lại câu trả lời; những gì còn mở được ghi bên dưới và không thuộc yêu cầu. Tiêu chí chấp nhận nằm trong từng yêu cầu.")
 +stats([[D.frs.length,"functional||chức năng"],[D.nfr.length,"non-functional||phi chức năng"],[allAC.length,"acceptance criteria||tiêu chí chấp nhận"],[D.rules.length,"business rules||quy tắc nghiệp vụ"],[n("B"),"requirements blocked||yêu cầu bị chặn"]])
 +h3("Scope||Phạm vi")+D.scope.map(block).join("")
 +h3("Roles||Vai trò")+table(["Role||Vai trò","Who||Là ai","Sees||Thấy gì"],D.roles.map(r=>["<b>"+esc(r.name)+"</b>",esc(r.who),esc(r.sees)]),["n","w","w"])
 +fold("<span class='id'>"+cap.rows.length+"</span>","<b>"+L("Who may do what||Ai được làm gì")+"</b>",pill(L("Awaiting sign-off||Chờ duyệt"),"H"),table(["Action||Hành động"].concat(cap.columns),cap.rows.map(r=>[esc(r.action)].concat(r.values.map(esc))),["w"]))
 +fold("<span class='id'>"+D.states.length+"</span>","<b>"+L("States of an account, a channel and a message||Trạng thái của tài khoản, kênh và tin nhắn")+"</b>","",table(["Object||Đối tượng","State||Trạng thái","Meaning||Ý nghĩa"],D.states.map(x=>[esc(x.object),"<b>"+esc(x.state)+"</b>",fmt(x.meaning)]),["n","n","w"]))
 +(D.eventMatrix?fold("<span class='id'>"+D.eventMatrix.rows.length+"</span>","<b>"+esc(D.eventMatrix.title)+"</b>","","<p style='margin:0'>"+fmt(D.eventMatrix.intro||"")+"</p>"+table(D.eventMatrix.columns,D.eventMatrix.rows.map(r=>r.map(fmt)),["w"])):"")
 +D.reqMore.map(x=>fold("<span class='id'>·</span>","<b>"+esc(x.title)+"</b>","",x.blocks.map(block).join(""))).join("")
 +fold("<span class='id'>"+D.rules.length+"</span>","<b>"+L("Business rules||Quy tắc nghiệp vụ")+"</b>","",table(["ID","Rule||Quy tắc","Flows||Flow","Decided by||Quyết định bởi"],D.rules.map(r=>[id(r[0]),esc(r[1]),esc(r[2]),id(r[3])]),["","w","n",""]))
 +h3("Functional requirements||Yêu cầu chức năng")+"<div class='bar'>"+sel("area","Area||Mảng",areas)+sel("rs","Readiness||Mức sẵn sàng",["R","A","Q","B"],o=>L(FRS[o][0]))+shown(rows.length)+"</div><div>"
 +rows.map(f=>{const s=FRS[frState(f)],o=f.open.filter(isOpen);return fold(id(f.id),"<b>"+esc(f.text)+"</b><small style='display:block;color:var(--muted)'>"+esc(f.area)+"</small>",pill(L(s[0]),s[1]),
   "<dl><dt>"+L("Decided by||Quyết định bởi")+"</dt><dd>"+f.decided.map(d=>dref(d.ref)+" "+esc(d.a)).join("<br>")+"</dd><dt>"+L("Not yet decided||Chưa quyết định")+"</dt><dd>"+(o.length?o.map(i=>dref(i)+" "+fmt(DEC[i].q)).join("<br>"):L("Nothing||Không có"))+"</dd><dt>"+L("Screen||Màn hình")+"</dt><dd>"+esc(f.screen)+"</dd><dt>"+L("Flow · rules||Flow · quy tắc")+"</dt><dd>"+esc(f.flows||"—")+" · "+esc(f.rules||"—")+"</dd></dl>"
   +f.acs.map(a=>"<div class='ac'>"+id(a.id)+" "+esc(a.text)+"</div>").join(""))}).join("")+"</div>"
 +h3("Non-functional requirements||Yêu cầu phi chức năng")+table(["ID","Requirement||Yêu cầu","Decided by||Quyết định bởi","How it is measured||Đo bằng cách nào"],D.nfr.map(n=>[id(n.id),esc(n.text),id(n.src),fmt(n.measure)]),["","w","","w"])
 +h3("Non-functional areas with no decision||Mảng phi chức năng chưa có quyết định")+table(["Area||Mảng","Waits on||Chờ"],D.nfrMissing.map(r=>[esc(r[0]),id(r[1])]))},
/* 7 · QA */
()=>{const types=["P","N","B","X"],rows=allTS.filter(t=>(!F("tt")||t.type===F("tt"))&&(!F("tfr")||t.fr===F("tfr"))),gaps=D.frs.filter(f=>f.open.some(isOpen));
 return title("Tab 7||Tab 7","How it will be checked||Sẽ kiểm thế nào","Test scenarios drawn from the acceptance criteria, the matrix that ties screen to test, and what cannot be tested yet.||Kịch bản test rút từ tiêu chí chấp nhận, ma trận nối từ màn hình tới test, và những gì chưa test được.")
 +stats([[allTS.length,"scenarios||kịch bản"]].concat(types.map(t=>[allTS.filter(x=>x.type===t).length,TTL[t]])))
 +h3("Test scenarios||Kịch bản test")+"<div class='bar'>"+sel("tt","Type||Loại",types,o=>L(TTL[o]))+sel("tfr","Requirement||Yêu cầu",D.frs.map(f=>f.id))+shown(rows.length)+"</div>"
 +table(["ID","Type||Loại","Scenario and expected result||Kịch bản và kết quả mong đợi","Criterion||Tiêu chí","Requirement||Yêu cầu"],rows.map(t=>[id(t.id),pill(L(TTL[t.type]),TTC[t.type]),esc(t.text),id(t.ac),id(t.fr)]),["","","w","",""])
 +h3("Traceability matrix||Ma trận truy vết")+table(["UI screen||Màn hình","Flow","Rules||Quy tắc","Requirement||Yêu cầu","Acceptance criteria||Tiêu chí chấp nhận","Test scenarios||Kịch bản test"],D.frs.map(f=>[esc(f.screen),esc(f.flows||"—"),ids(f.rules?f.rules.split(" "):[]),id(f.id),ids(f.acs.map(a=>a.id)),ids(f.acs.flatMap(a=>a.tests.map(t=>t.id)))]),["w","n","","","",""])
 +h3("What cannot be tested yet||Những gì chưa test được")+table(["Requirement||Yêu cầu","Undecided part||Phần chưa quyết định","Waits on||Chờ"],gaps.map(f=>{const o=f.open.filter(isOpen);return[id(f.id)+" "+esc(f.text.split(".")[0])+".",o.map(i=>fmt(DEC[i].q)).join("<br>"),drefs(o)]}),["w","w",""])
 +h3("Technical points to prove||Điểm kỹ thuật cần chứng minh")+table(["To prove||Cần chứng minh","Affects||Ảnh hưởng tới","How||Bằng cách"],D.techDeps.map(r=>[esc(r[0]),id(r[1]),esc(r[2])]),["w","","w"])},
/* 8 · Technical */
()=>title("Tab 8||Tab 8","What it is built with||Làm bằng gì","Unchanged from v1: architecture, code structure, data model, API, frontend, deployment and testing.||Giữ nguyên từ v1: kiến trúc, cấu trúc code, mô hình dữ liệu, API, frontend, triển khai và kiểm thử.")
 +D.technical.map((s,i)=>fold("<span class='id'>"+(i+1)+"</span>","<b>"+esc(s.title)+"</b>","",(s.intro?"<p style='margin:0'>"+fmt(s.intro)+"</p>":"")+s.blocks.map(block).join(""),i===0)).join(""),
/* 9 · Plan */
()=>{const v=verdict(),FB=FRBY(),W={B:0,Q:1,A:2,R:3};
 const aState=a=>a.frs.length?a.frs.map(i=>frState(FB[i])).sort((x,y)=>W[x]-W[y])[0]:"F";
 const AL={F:["Foundation: no product question||Nền tảng: không có câu hỏi sản phẩm","ok"],R:FRS.R,A:FRS.A,Q:["Can start; details open||Bắt đầu được; chi tiết còn mở","M"],B:["Wait: blocked requirement||Chờ: yêu cầu bị chặn","C"]};
 const all=D.milestones.flatMap(m=>m.areas),nT=a=>a.reduce((x,y)=>x+y.tickets.length,0),can=all.filter(a=>aState(a)!=="B"),wait=all.filter(a=>aState(a)==="B");
 return title("Tab 9||Tab 9","In what order, and what may start||Theo thứ tự nào, và cái gì bắt đầu được","The plan follows the requirements. It opens with the gate; each area of work then shows the requirements it builds and whether it may start. The tickets are the v1 drafts, unchanged: they are not confirmed work until the gate opens.||Kế hoạch đi sau yêu cầu. Nó mở đầu bằng cổng; mỗi mảng công việc sau đó cho thấy các yêu cầu nó thực hiện và đã bắt đầu được chưa. Ticket là bản nháp của v1, giữ nguyên: chúng chưa phải công việc đã chốt cho tới khi cổng mở.")
 +"<div class='note "+v[3]+"'>"+pill(v[0],v[1]+" big")+" &nbsp;"+esc(v[2])+".</div>"
 +stats([[nT(all),"draft tickets||ticket nháp"],[nT(can),"in areas that may start||ở mảng bắt đầu được"],[nT(wait),"in areas that wait||ở mảng phải chờ"],[D.milestones.length,"milestones||milestone"]])
 +note("Requirements are linked to plan **areas**, not yet to single tickets. Linking each ticket to its requirement is the next step if this structure is accepted; a ticket with no requirement then shows either a missing requirement or a ticket that is not needed.||Yêu cầu mới được nối với **mảng** của kế hoạch, chưa tới từng ticket. Nối từng ticket với yêu cầu của nó là bước tiếp theo nếu cấu trúc này được chấp nhận; khi đó ticket không có yêu cầu sẽ cho thấy hoặc thiếu yêu cầu, hoặc ticket không cần.","warn")
 +D.milestones.map(m=>"<h3>"+id(m.id)+" "+esc(m.name)+"</h3><p class='cap' style='margin:0;max-width:80ch'>"+fmt(m.goal)+"<br><b>"+L("Done when||Xong khi")+":</b> "+fmt(m.exit||"")+"</p>"
   +(D.intents.filter(i=>i.milestone===m.id).length?fold("<span class='id'>"+D.intents.filter(i=>i.milestone===m.id).length+"</span>","<b>"+L("Intents: the outcomes this milestone delivers||Intent: các kết quả milestone này mang lại")+"</b>",pill(L("draft||nháp"),"L"),table(["ID","Want||Mong muốn","For whom||Cho ai","Done when||Xong khi","Tickets||Ticket"],D.intents.filter(i=>i.milestone===m.id).map(i=>[id(i.id),"<b>"+fmt(i.want)+"</b>",esc(i.who),fmt(i.done),ids(i.tickets||[])]),["","w","n","w",""])):"")+"<div>"+m.areas.map(a=>{const s=aState(a),o=uniq(a.frs.flatMap(i=>FB[i].open.filter(x=>isOpen(x)&&DEC[x].kind==="q"&&ORD[DEC[x].sev]<=1)));
   return fold("<span class='id'>"+a.tickets.length+"</span>","<b>"+esc(a.name)+"</b><small style='display:block;color:var(--muted)'>"+(a.frs.length?a.frs.join(" "):L("no functional requirement||không có yêu cầu chức năng"))+"</small>",pill(L(AL[s][0]),AL[s][1]),
    "<dl><dt>"+L("Builds||Thực hiện")+"</dt><dd>"+(a.frs.length?a.frs.map(i=>id(i)+" "+esc(FB[i].text.split(".")[0])+". "+pill(L(FRS[frState(FB[i])][0]),FRS[frState(FB[i])][1])).join("<br>"):"—")+"</dd><dt>"+L("Waits on||Chờ")+"</dt><dd>"+drefs(o)+"</dd></dl>"
    +table(["Ticket","Title||Tiêu đề","Scope||Phạm vi","Size||Cỡ"],a.tickets.map(t=>[id(t.id),"<b>"+fmt(t.title)+"</b>",fmt(t.scope),esc(t.size)]),["","w","w","n"]))}).join("")+"</div>").join("")
 +((D.plan.notes||[]).length?h3("Notes on the order of work||Ghi chú về thứ tự công việc")+"<ul class='plain'>"+D.plan.notes.map(x=>"<li>"+fmt(x)+"</li>").join("")+"</ul>":"")
 +h3("Roadmap||Lộ trình")+(D.plan.phasesIntro?"<p class='cap' style='margin:0'>"+fmt(D.plan.phasesIntro)+"</p>":"")+table(["Phase","Name||Tên","Delivers||Nội dung","State||Tình trạng"],D.phases.map(p=>[id(p.id),"<b>"+esc(p.name)+"</b>",esc(p.delivers),esc(p.state)]),["","n","w","n"])}
];

let protoDone=false;
function loadProto(){const f=document.getElementById("pf");if(!f)return;try{const bin=atob(document.getElementById("proto-b64").textContent.trim()),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);f.srcdoc=new TextDecoder().decode(bytes)}catch(e){}}
function render(){const v=verdict();
 document.documentElement.lang=S.lang;
 document.getElementById("title").innerHTML="<h1>Toki Blueprint</h1><p>"+esc(D.tagline)+" · "+esc(D.built)+"</p>";
 document.querySelectorAll("[data-lang]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lang===S.lang)));
 document.getElementById("gate").innerHTML=pill(v[0],v[1]+" big")+"<span class='id'>"+blockers().length+L(" blocking · || chặn · ")+openQ().length+L(" open · || mở · ")+D.frs.filter(f=>frState(f)!=="B").length+"/"+D.frs.length+L(" FR startable|| FR bắt đầu được")+"</span>";
 document.getElementById("rail").innerHTML=TABS.map((t,i)=>"<button data-go='"+i+"'"+(S.tab===i?" aria-current='page'":"")+"><span class='n'>"+(i+1)+"</span><span>"+esc(L(t[0]))+"</span><span class='c'>"+esc(String(t[1]()))+"</span></button>").join("");
 document.getElementById("main").innerHTML=VIEW[S.tab]();
 if(S.tab===1)loadProto()}
function go(i){S.tab=i;S.f={};save();render();window.scrollTo(0,0)}
document.addEventListener("click",e=>{const d=e.target.closest("[data-d]");
 if(d){e.preventDefault();S.tab=3;S.f={dst:"",dq:d.dataset.d};save();render();window.scrollTo(0,0);return}
 const g=e.target.closest("[data-go]");if(g){go(+g.dataset.go);return}
 const l=e.target.closest("[data-lang]");if(l){const y=window.scrollY;S.lang=l.dataset.lang;S.f={};load();save();render();window.scrollTo(0,y);return}
 if(e.target.closest("[data-quick='brain']")){S.f={dst:"",dk:"ans"};render();return}
 if(e.target.closest("[data-act='reset']")){S.status={};save();render()}});
document.addEventListener("change",e=>{const t=e.target;
 if(t.dataset.st){const y=window.scrollY;S.status[t.dataset.st]=t.value;save();render();window.scrollTo(0,y);const el=document.getElementById("st-"+t.dataset.st);if(el)el.focus()}
 else if(t.dataset.f){S.f[t.dataset.f]=t.value;render();const el=document.getElementById("f-"+t.dataset.f);if(el)el.focus()}});
render();
