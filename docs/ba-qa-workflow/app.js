/* Every interface string is "English||Tiếng Việt"; L() picks one. Data comes per language from build.py. */
const ORD={C:0,H:1,M:2,L:3};
const STATUSES=["Open","In Review","Confirmed","Rejected","Deferred","Accepted Assumption"];
const STL={"Open":"Open||Còn mở","In Review":"In Review||Đang xem xét","Confirmed":"Confirmed||Đã chốt","Rejected":"Rejected||Loại bỏ","Deferred":"Deferred||Hoãn lại","Accepted Assumption":"Accepted Assumption||Giả định được chấp nhận"};
const DONE=new Set(["Confirmed","Rejected","Deferred","Accepted Assumption"]);
const KEY="toki-baqa-v1";
let S={phase:0,status:{},dor:{},f:{},lang:"en"};
try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s&&s.status)S=Object.assign(S,s)}catch(e){}
if(!ALL[S.lang])S.lang="en";
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const L=s=>{const i=s.indexOf("||");return i<0?s:S.lang==="vi"?s.slice(i+2):s.slice(0,i)};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/`(.+?)`/g,"<span class='id'>$1</span>");
const pill=(t,c)=>"<span class='pill "+c+"'>"+esc(t)+"</span>";
const SEVL={C:"Critical||Nghiêm trọng",H:"High||Cao",M:"Medium||Trung bình",L:"Low||Thấp"};
const TTL={P:"Positive||Tích cực",N:"Negative||Phủ định",B:"Boundary||Biên",X:"Exception||Ngoại lệ"},TTC={P:"ok",N:"C",B:"H",X:"a"};
const sev=s=>pill(L(SEVL[s]),s);
const id=s=>"<span class='id'>"+esc(s)+"</span>";
const ids=a=>"<span class='id' style='white-space:normal'>"+esc(a.join(" ")||"—")+"</span>";
const table=(head,rows,cls)=>"<div class='scroll'><table><thead><tr>"+head.map(h=>"<th>"+esc(L(h))+"</th>").join("")+"</tr></thead><tbody>"+(rows.length?rows.map(r=>"<tr>"+r.map((c,i)=>"<td class='"+((cls||[])[i]||"")+"'>"+c+"</td>").join("")+"</tr>").join(""):"<tr><td colspan='"+head.length+"' style='color:var(--muted)'>"+L("Nothing matches these filters.||Không có gì khớp với bộ lọc.")+"</td></tr>")+"</tbody></table></div>";

/* ---- state derived from the decision log ---- */
let D,Q,A,allAC,allTS;
function load(){D=ALL[S.lang];Q=Object.fromEntries(D.questions.map(q=>[q.id,q]));A=Object.fromEntries(D.assumptions.map(a=>[a.id,a]));
  allAC=D.frs.flatMap(f=>f.acs.map(a=>Object.assign({fr:f.id},a)));allTS=allAC.flatMap(a=>a.tests.map(t=>Object.assign({ac:a.id,fr:a.fr},t)))}
load();
const st=i=>S.status[i]||(i==="AS-05"?"Accepted Assumption":"Open");
const openQ=()=>D.questions.filter(q=>!DONE.has(st(q.id)));
const blockers=()=>openQ().filter(q=>ORD[q.sev]<=1);
const openA=()=>D.assumptions.filter(a=>!DONE.has(st(a.id)));
function frState(f){const o=f.open.filter(i=>!DONE.has(st(i))),qs=o.filter(i=>Q[i]);
  if(qs.some(i=>ORD[Q[i].sev]<=1))return"B";if(qs.length)return"Q";return o.length?"A":"R"}
const FRS={R:["Ready||Sẵn sàng","ok"],A:["Ready if assumptions accepted||Sẵn sàng nếu chấp nhận giả định","a"],Q:["Core ready, details open||Lõi sẵn sàng, chi tiết còn mở","M"],B:["Blocked||Bị chặn","C"]};
const flowBlocked=f=>f.open.filter(i=>Q[i]&&ORD[Q[i].sev]<=1&&!DONE.has(st(i)));
const DOR=[["Requirements are clear and unambiguous||Yêu cầu rõ ràng, không mơ hồ","BA",()=>D.frs.every(f=>frState(f)!=="B"),()=>L("No requirement is blocked||Không yêu cầu nào bị chặn")],
 ["Business rules are confirmed||Quy tắc nghiệp vụ đã được xác nhận","BA / PO",null],
 ["User flows are complete||User flow đầy đủ","BA / UX",()=>D.flows.every(f=>!flowBlocked(f).length),()=>L("No flow waits on a high-priority question||Không flow nào chờ câu hỏi ưu tiên cao")],
 ["UI states are defined||Các trạng thái UI đã được định nghĩa","BA / UX",null],
 ["Acceptance criteria are testable||Tiêu chí chấp nhận kiểm thử được","BA / QA",()=>allAC.every(a=>a.tests.length>0),()=>L("Every criterion has a test||Tiêu chí nào cũng có test")],
 ["Critical questions are resolved||Các câu hỏi nghiêm trọng đã được giải quyết","BA",()=>blockers().length===0,()=>L("No Critical or High question is open||Không còn câu hỏi Nghiêm trọng hay Cao nào mở")],
 ["Assumptions are confirmed or explicitly accepted||Giả định đã được xác nhận hoặc chấp nhận rõ ràng","BA / PO",()=>openA().length===0,()=>L("Every assumption has a decision||Giả định nào cũng có quyết định")],
 ["Test scenarios are identified||Đã xác định kịch bản test","QA",()=>allTS.length>0,()=>allTS.length+L(" scenarios|| kịch bản")],
 ["Requirements traceability is established||Đã thiết lập truy vết yêu cầu","BA / QA",()=>D.frs.every(f=>f.acs.length>0),()=>L("Every requirement maps to criteria and tests||Yêu cầu nào cũng nối tới tiêu chí và test")],
 ["Technical feasibility is validated||Tính khả thi kỹ thuật đã được kiểm chứng","Developer / Tech Lead",null],
 ["Dependencies are identified||Đã xác định các phụ thuộc","BA / Developer",()=>true,()=>D.depends.length+L(" recorded in phase 3|| mục ghi ở phase 3")],
 ["Scope and priorities are confirmed||Phạm vi và ưu tiên đã được xác nhận","PO",null]];
const dorVal=(d,i)=>d[2]?d[2]():!!S.dor[i];
function verdict(){const b=blockers().length,rest=DOR.filter((d,i)=>!dorVal(d,i)).length;
  if(b)return[L("Blocked||Bị chặn"),"C",b+L(" high-priority questions open|| câu hỏi ưu tiên cao còn mở"),"B"];
  if(rest||openQ().length)return[L("Ready with accepted risks||Sẵn sàng, có rủi ro được chấp nhận"),"M",openQ().length+L(" lower-priority questions open · || câu hỏi ưu tiên thấp hơn còn mở · ")+rest+L(" checklist items unticked|| mục checklist chưa đánh dấu"),"W"];
  return[L("Ready||Sẵn sàng"),"ok",L("Definition of Ready met||Đạt Definition of Ready"),"R"]}

/* ---- the workflow itself ---- */
const PH=[
 {n:"Prototype analysis||Phân tích prototype",obj:"Understand the product, its features, screens, interactions and expected user journeys from the prototype.||Hiểu sản phẩm, các tính năng, màn hình, tương tác và hành trình người dùng mong đợi từ prototype.",
  ba:"Analyse every screen and component|Identify features, roles and entry points|Understand navigation and interactions|Infer business rules from the interface|Relate features to one another||Phân tích mọi màn hình và thành phần|Xác định tính năng, vai trò và lối vào|Hiểu điều hướng và tương tác|Suy ra quy tắc nghiệp vụ từ giao diện|Liên hệ các tính năng với nhau",
  qa:"Review interactions and expected behaviour|Identify missing interface states|Spot negative and alternative scenarios|Check navigation is consistent|Note usability and functional issues||Rà tương tác và hành vi mong đợi|Xác định trạng thái giao diện còn thiếu|Tìm kịch bản phủ định và thay thế|Kiểm tra điều hướng nhất quán|Ghi lại vấn đề về khả dụng và chức năng",
  out:["prototype-analysis.md","screen-inventory.md","feature-inventory.md"],c:()=>D.screens.length+L(" screens|| màn hình")},
 {n:"Gaps and questions||Gap và câu hỏi",obj:"Identify missing, ambiguous, inconsistent or undefined requirements, from seven angles.||Xác định yêu cầu còn thiếu, mơ hồ, không nhất quán hoặc chưa định nghĩa, từ bảy góc nhìn.",
  ba:"Identify functional and business gaps|Write the questions stakeholders must answer|Record assumptions made from incomplete information||Xác định gap về chức năng và nghiệp vụ|Viết các câu hỏi các bên phải trả lời|Ghi lại giả định đặt ra do thiếu thông tin",
  qa:"Identify missing test scenarios|Flag unclear expected outcomes|Find edge cases and failure scenarios||Xác định kịch bản test còn thiếu|Đánh dấu kết quả mong đợi chưa rõ|Tìm trường hợp biên và kịch bản lỗi",
  out:["gap-analysis.md","open-questions.md","assumptions.md"],c:()=>D.findings.length+L(" findings|| phát hiện")},
 {n:"Triage and priority||Phân loại và ưu tiên",obj:"Consolidate and prioritise every finding before clarification starts.||Gộp và xếp ưu tiên mọi phát hiện trước khi bắt đầu làm rõ.",
  ba:"Consolidate BA and QA findings|Remove duplicates|Categorise by type and impact|Find dependencies and conflicts|Assign owners and priorities||Gộp phát hiện của BA và QA|Bỏ trùng lặp|Phân nhóm theo loại và ảnh hưởng|Tìm phụ thuộc và mâu thuẫn|Giao người phụ trách và ưu tiên",
  qa:"Contribute findings and severity|Challenge priorities from a risk view|Identify critical blockers||Đóng góp phát hiện và mức độ|Phản biện ưu tiên từ góc nhìn rủi ro|Xác định điểm chặn nghiêm trọng",
  out:["findings-backlog.md"],c:()=>D.triage.length+L(" merged|| đã gộp")},
 {n:"Requirement clarification||Làm rõ yêu cầu",obj:"Resolve open questions and validate assumptions with the people who own them.||Giải quyết câu hỏi mở và kiểm chứng giả định với những người chịu trách nhiệm.",
  ba:"Review questions with the PO and stakeholders|Clarify rules and expected behaviour|Confirm what is in and out of scope|Record each decision and its reason|Update or reject assumptions||Rà câu hỏi với PO và các bên|Làm rõ quy tắc và hành vi mong đợi|Xác nhận trong và ngoài phạm vi|Ghi lại từng quyết định và lý do|Cập nhật hoặc loại bỏ giả định",
  qa:"Check that clarified requirements are testable|Find missing conditions and outcomes|Challenge unclear scenarios|Raise further questions from testing||Kiểm tra yêu cầu đã làm rõ có test được không|Tìm điều kiện và kết quả còn thiếu|Phản biện kịch bản chưa rõ|Nêu thêm câu hỏi từ góc nhìn test",
  out:["requirement-decisions.md","open-questions.md","assumptions.md","business-rules.md"],c:()=>openQ().length+L(" open|| còn mở")},
 {n:"Flow and logic validation||Kiểm định flow và logic",obj:"Make sure every journey and business behaviour is defined: happy, alternative, error and edge paths.||Bảo đảm mọi hành trình và hành vi nghiệp vụ đều được định nghĩa: luồng chính, thay thế, lỗi và biên.",
  ba:"Update flows from confirmed decisions|Define happy, alternative and error paths|Validate decision points and rules|Validate navigation and state changes|Find missing screens||Cập nhật flow theo quyết định đã chốt|Định nghĩa luồng chính, thay thế và lỗi|Kiểm định điểm quyết định và quy tắc|Kiểm định điều hướng và chuyển trạng thái|Tìm màn hình còn thiếu",
  qa:"Review that flows are complete|Find missing test paths|Validate the outcome of each branch|Find negative scenarios||Rà flow đã đầy đủ chưa|Tìm đường test còn thiếu|Kiểm định kết quả của từng nhánh|Tìm kịch bản phủ định",
  out:["user-flow.md","business-rules.md"],c:()=>D.flows.length+L(" flows|| flow")},
 {n:"Functional requirements||Yêu cầu chức năng",obj:"Turn confirmed decisions into clear, structured, implementable requirements with unique ids.||Chuyển các quyết định đã chốt thành yêu cầu rõ ràng, có cấu trúc, làm được, với mã định danh riêng.",
  ba:"Define functional requirements and ids|Define inputs, outputs and behaviour|Define validation and constraints|Define roles and permissions|Define non-functional requirements||Định nghĩa yêu cầu chức năng và mã|Định nghĩa đầu vào, đầu ra và hành vi|Định nghĩa kiểm tra và ràng buộc|Định nghĩa vai trò và quyền|Định nghĩa yêu cầu phi chức năng",
  qa:"Review completeness|Flag ambiguous statements|Check each is measurable and testable|Find missing negative and boundary conditions||Rà độ đầy đủ|Đánh dấu câu mơ hồ|Kiểm tra từng yêu cầu đo được và test được|Tìm điều kiện phủ định và biên còn thiếu",
  out:["functional-requirements.md","non-functional-requirements.md","business-rules.md"],c:()=>D.frs.length+" FR · "+D.nfr.length+" NFR"},
 {n:"Acceptance criteria||Tiêu chí chấp nhận",obj:"Define verifiable conditions that decide whether each requirement is correctly built.||Định nghĩa các điều kiện kiểm chứng được để quyết định mỗi yêu cầu đã được làm đúng chưa.",
  ba:"Define the expected outcome of each requirement|Reflect only confirmed rules|Use consistent, unambiguous language||Định nghĩa kết quả mong đợi của từng yêu cầu|Chỉ phản ánh quy tắc đã xác nhận|Dùng ngôn ngữ nhất quán, không mơ hồ",
  qa:"Review testability and completeness|Find missing positive and negative cases|Validate boundary conditions|Check each criterion can be verified||Rà khả năng test và độ đầy đủ|Tìm trường hợp tích cực và phủ định còn thiếu|Kiểm định điều kiện biên|Kiểm tra từng tiêu chí kiểm chứng được",
  out:["acceptance-criteria.md"],c:()=>allAC.length+" AC"},
 {n:"QA test design||Thiết kế test",obj:"Prepare test scenarios from validated requirements and acceptance criteria.||Chuẩn bị kịch bản test từ yêu cầu và tiêu chí chấp nhận đã kiểm định.",
  ba:"Clarify business-related scenarios|Validate expected business outcomes|Help resolve unclear requirements||Làm rõ kịch bản liên quan nghiệp vụ|Kiểm định kết quả nghiệp vụ mong đợi|Hỗ trợ giải quyết yêu cầu chưa rõ",
  qa:"Derive scenarios from requirements and flows|Design positive and negative cases|Find boundary and edge cases|Plan permission and integration tests|List the test data needed||Rút kịch bản từ yêu cầu và flow|Thiết kế trường hợp tích cực và phủ định|Tìm trường hợp biên|Lên kế hoạch test phân quyền và tích hợp|Liệt kê dữ liệu test cần có",
  out:["test-strategy.md","test-scenarios.md","test-cases.md","test-data-requirements.md"],c:()=>allTS.length+" TS"},
 {n:"Traceability and coverage||Truy vết và độ phủ",obj:"Connect every requirement to its flow, criteria and tests, and find what is not covered.||Nối mọi yêu cầu với flow, tiêu chí và test của nó, và tìm ra những gì chưa được phủ.",
  ba:"Map screens to flows and flows to requirements|Map rules to criteria|Find inconsistencies across artifacts||Nối màn hình với flow và flow với yêu cầu|Nối quy tắc với tiêu chí|Tìm chỗ không nhất quán giữa các tài liệu",
  qa:"Map criteria to test scenarios|Find requirements without tests|Find tests without a requirement||Nối tiêu chí với kịch bản test|Tìm yêu cầu chưa có test|Tìm test không có yêu cầu",
  out:["requirements-traceability-matrix.md","coverage-analysis.md"],c:()=>D.frs.length+L(" rows|| dòng")},
 {n:"Readiness review||Đánh giá sẵn sàng",obj:"Decide whether the requirements are clear, validated and testable enough to build.||Quyết định yêu cầu đã đủ rõ, đã kiểm định và test được để bắt đầu làm chưa.",
  ba:"Confirm requirements, rules and flows|Confirm critical questions are resolved|Confirm assumptions are accepted or rejected||Xác nhận yêu cầu, quy tắc và flow|Xác nhận câu hỏi nghiêm trọng đã giải quyết|Xác nhận giả định được chấp nhận hoặc loại bỏ",
  qa:"Confirm criteria are testable|Confirm scenarios exist|Confirm traceability||Xác nhận tiêu chí test được|Xác nhận đã có kịch bản|Xác nhận truy vết",
  out:["development-readiness-report.md"],c:()=>verdict()[0]}];
const LEAD="Lead||Chủ trì";
const RACI=["UI prototype analysis||Phân tích UI prototype|Lead|Review|Support|Support","Gap identification||Xác định gap|Lead|Contribute|Support|Support","Open questions||Câu hỏi mở|Lead|Contribute|Answer|Answer technical questions","Findings prioritisation||Xếp ưu tiên phát hiện|Lead|Contribute|Approve priority|Support","Business rules||Quy tắc nghiệp vụ|Lead|Validate|Approve|Review feasibility","User flow||User flow|Lead|Review|Support|Review","Functional requirements||Yêu cầu chức năng|Lead|Review|Approve|Review","Acceptance criteria||Tiêu chí chấp nhận|Lead|Validate|Approve|Review","Test scenarios||Kịch bản test|Support|Lead|Support|Support","Test cases||Test case|Review|Lead|—|Support","Traceability||Truy vết|Shared|Shared|—|Support","Development readiness||Sẵn sàng phát triển|Shared|Shared|Approve scope|Approve technical readiness","Test execution||Thực thi test|Support|Lead|Support UAT|Fix defects"];
const ROLE={"Lead":LEAD,"Review":"Review||Rà soát","Support":"Support||Hỗ trợ","Contribute":"Contribute||Đóng góp","Answer":"Answer||Trả lời","Answer technical questions":"Answer technical questions||Trả lời câu hỏi kỹ thuật","Approve priority":"Approve priority||Duyệt ưu tiên","Validate":"Validate||Kiểm định","Approve":"Approve||Duyệt","Review feasibility":"Review feasibility||Rà tính khả thi","Shared":"Shared||Cùng làm","Approve scope":"Approve scope||Duyệt phạm vi","Approve technical readiness":"Approve technical readiness||Duyệt sẵn sàng kỹ thuật","Support UAT":"Support UAT||Hỗ trợ UAT","Fix defects":"Fix defects||Sửa lỗi","—":"—"};
const TREE="docs/\n├── 01-discovery/\n│   ├── prototype-analysis.md\n│   ├── screen-inventory.md\n│   └── feature-inventory.md\n├── 02-gap-analysis/\n│   ├── gap-analysis.md\n│   ├── open-questions.md\n│   ├── assumptions.md\n│   └── findings-backlog.md\n├── 03-requirements/\n│   ├── requirement-decisions.md\n│   ├── business-rules.md\n│   ├── user-flow.md\n│   ├── functional-requirements.md\n│   ├── non-functional-requirements.md\n│   └── acceptance-criteria.md\n├── 04-qa/\n│   ├── test-strategy.md\n│   ├── test-scenarios.md\n│   ├── test-cases.md\n│   ├── test-data-requirements.md\n│   ├── requirements-traceability-matrix.md\n│   └── coverage-analysis.md\n└── 05-readiness/\n    └── development-readiness-report.md";
const PRINCIPLES=[["BA and QA work in parallel||BA và QA làm song song","From the first look at the prototype. BA follows rules, journeys and expected behaviour; QA follows testability, coverage and what can go wrong.||Ngay từ lần đầu xem prototype. BA theo quy tắc, hành trình và hành vi mong đợi; QA theo khả năng test, độ phủ và những gì có thể hỏng."],
 ["Questions must lead to decisions||Câu hỏi phải dẫn tới quyết định","Each has an id, an owner, a priority, a status and a recorded answer. No undocumented assumption, and no developer deciding a business rule alone.||Mỗi câu có mã, người phụ trách, ưu tiên, trạng thái và câu trả lời được ghi lại. Không có giả định không ghi chép, và không để developer tự quyết quy tắc nghiệp vụ."],
 ["Requirements must be testable||Yêu cầu phải test được","Each has a description, its rules, the expected behaviour, acceptance criteria and test scenarios.||Mỗi yêu cầu có mô tả, quy tắc, hành vi mong đợi, tiêu chí chấp nhận và kịch bản test."],
 ["Maintain traceability||Giữ truy vết","The same ids run through requirements, flows, criteria and tests, so a change can be followed.||Cùng một bộ mã chạy xuyên qua yêu cầu, flow, tiêu chí và test, nên theo dõi được mọi thay đổi."],
 ["Do not force 100% clarification||Không ép làm rõ 100%","Critical rules, core journeys, and security and data risks must be settled. Everything deferred has an owner and an explicit decision.||Quy tắc quan trọng, hành trình cốt lõi, và rủi ro bảo mật, dữ liệu phải được chốt. Mọi thứ hoãn lại đều có người phụ trách và quyết định rõ ràng."]];

const li=s=>L(s.split("||").map(x=>x).join("||")).split("|").map(x=>"<li>"+esc(x)+"</li>").join("");
function head(i){const p=PH[i-1];return "<div><div class='eyebrow'>"+L("Phase||Phase")+" "+i+L(" of 10||/10")+"</div><h2>"+esc(L(p.n))+"</h2><p class='lede'>"+esc(L(p.obj))+"</p></div>"
 +"<div class='brief'><div><h4>BA</h4><ul>"+li(p.ba)+"</ul></div><div><h4>QA</h4><ul>"+li(p.qa)+"</ul></div><div><h4>"+L("Expected outputs||Đầu ra mong đợi")+"</h4><div class='files'>"+p.out.map(x=>"<span class='file'>"+x+"</span>").join("")+"</div></div></div>"}
const stats=a=>"<div class='stats'>"+a.map(x=>"<div class='stat'><b>"+x[0]+"</b><span>"+esc(L(x[1]))+"</span></div>").join("")+"</div>";
const sel=(k,label,opts,show)=>"<label for='f-"+k+"'>"+L(label)+"</label><select id='f-"+k+"' data-f='"+k+"'><option value=''>"+L("All||Tất cả")+"</option>"+opts.map(o=>"<option value='"+esc(o)+"'"+(S.f[k]===o?" selected":"")+">"+esc(show?show(o):o)+"</option>").join("")+"</select>";
const F=k=>S.f[k]||"";
const uniq=a=>[...new Set(a)];
const shown=n=>"<span class='id'>"+n+L(" shown|| đang hiện")+"</span>";
const h3=s=>"<h3>"+L(s)+"</h3>";
const note=(s,c)=>"<div class='note "+(c||"")+"'>"+fmt(L(s))+"</div>";
const vcls=v=>v[3]==="B"?"bad":v[3]==="R"?"good":"warn";
const sevSel=k=>sel(k,"Priority||Ưu tiên",["C","H","M","L"],o=>L(SEVL[o]));
const undecided=i=>fmt((Q[i]||{}).q||(A[i]||{}).text||"");

const VIEW=[
()=>{const v=verdict(),b=blockers(),nb=D.flows.filter(f=>flowBlocked(f).length).length,fb=D.frs.filter(f=>frState(f)==="B").length;
 const succ=[["All gaps reviewed and prioritised||Mọi gap đã được rà và xếp ưu tiên",true,D.findings.length+L(" findings merged into || phát hiện gộp thành ")+D.triage.length],
  ["Critical open questions resolved||Câu hỏi nghiêm trọng đã giải quyết",b.length===0,b.length+L(" open|| còn mở")],
  ["Business rules confirmed or accepted as assumptions||Quy tắc nghiệp vụ đã xác nhận hoặc được chấp nhận là giả định",openA().length===0,openA().length+L(" assumptions without a decision|| giả định chưa có quyết định")],
  ["Flows cover primary, alternative and exception paths||Flow phủ luồng chính, thay thế và ngoại lệ",nb===0,nb+"/"+D.flows.length+L(" flows blocked|| flow bị chặn")],
  ["Functional requirements clear and unambiguous||Yêu cầu chức năng rõ ràng, không mơ hồ",fb===0,fb+"/"+D.frs.length+L(" blocked|| bị chặn")],
  ["Acceptance criteria measurable and testable||Tiêu chí chấp nhận đo được và test được",true,allAC.length+L(" criteria|| tiêu chí")],
  ["Test scenarios cover the agreed requirements||Kịch bản test phủ các yêu cầu đã thống nhất",true,allTS.length+L(" scenarios, at least one per criterion|| kịch bản, mỗi tiêu chí ít nhất một")],
  ["Traceability established||Đã thiết lập truy vết",true,L("Screen → flow → rule → FR → AC → TS||Màn hình → flow → quy tắc → FR → AC → TS")],
  ["Development readiness reviewed and approved||Mức sẵn sàng phát triển đã được rà và duyệt",v[3]==="R",v[0]]];
 return "<div><div class='eyebrow'>"+L("Overview||Tổng quan")+"</div><h2>"+L("The workflow, and where Toki stands in it||Quy trình, và Toki đang ở đâu trong đó")+"</h2><p class='lede'>"+L("A structured way for a Business Analyst and a QA engineer to read a prototype, find what is missing, get decisions, and hand over requirements that can be built and tested. Choose a phase to see its work and its Toki results.||Một cách làm có cấu trúc để Business Analyst và QA đọc prototype, tìm ra những gì còn thiếu, lấy quyết định, và bàn giao yêu cầu làm được và test được. Chọn một phase để xem công việc và kết quả của Toki.")+"</p></div>"
 +"<div class='note "+vcls(v)+"'><b>"+esc(v[0])+".</b> "+esc(v[2])+". "+L("The verdict follows the decision log in phase 4: change a question's status there and it is recalculated here.||Kết luận đi theo sổ quyết định ở phase 4: đổi trạng thái một câu hỏi ở đó thì ở đây được tính lại.")+"</div>"
 +"<div class='two'><div class='flow'><div class='end'>"+L("Prototype and product requirements||Prototype và yêu cầu sản phẩm")+"</div>"+PH.map((p,i)=>"<div class='arrow'></div><button data-go='"+(i+1)+"'><span class='n'>"+String(i+1).padStart(2,"0")+"</span><span><b>"+esc(L(p.n))+"</b><small>"+p.out.join(" · ")+"</small></span><span class='id'>"+esc(p.c())+"</span></button>").join("")+"<div class='arrow'></div><div class='end'>"+L("Development tickets and implementation → QA execution → UAT and release||Ticket phát triển và triển khai → QA thực thi → UAT và phát hành")+"</div></div>"
 +"<div style='display:flex;flex-direction:column;gap:22px'><div>"+h3("Definition of success||Định nghĩa thành công")+"<div class='scroll' style='margin-top:8px'>"+succ.map(s=>"<div class='check'><span class='mark "+(s[1]?"y":"x")+"'>"+(s[1]?"✓":"✕")+"</span><span>"+esc(L(s[0]))+"<br><small>"+esc(s[2])+"</small></span></div>").join("")+"</div></div>"
 +"<div>"+h3("Working principles||Nguyên tắc làm việc")+"<div class='scroll' style='margin-top:8px'>"+PRINCIPLES.map(p=>"<div class='check' style='grid-template-columns:1fr'><span><b>"+esc(L(p[0]))+"</b><br><small>"+esc(L(p[1]))+"</small></span></div>").join("")+"</div></div></div></div>"
 +h3("Who does what||Ai làm gì")+table(["Activity||Hoạt động","BA","QA","PO / UX","Developer"],RACI.map(r=>{const i=r.indexOf("|",r.indexOf("||")+2),c=r.slice(i+1).split("|");return[esc(L(r.slice(0,i)))].concat(c.map(x=>x==="Lead"?pill(L(LEAD),"a"):esc(L(ROLE[x]||x))))}))
 +h3("Artifact structure||Cấu trúc tài liệu")+"<div class='tree'>"+TREE+"</div>"},
()=>head(1)+stats([[D.screens.length,"screens and panels||màn hình và panel"],[D.counts.actions,"actions handled||thao tác được xử lý"],[D.counts.roles,"roles||vai trò"],[D.counts.writtenFlows,"written journeys||hành trình đã viết"]])
 +note("The prototype simulates one person, always an Owner, with sample data and instant actions. It shows chatting faithfully. It contains nothing about getting in, nothing about waiting or failing, and nothing about a second person or device.||Prototype mô phỏng một người, luôn là Owner, với dữ liệu mẫu và thao tác tức thì. Nó thể hiện trung thực việc chat. Nó không có gì về việc vào hệ thống, không có gì về chờ đợi hay thất bại, và không có gì về người hoặc thiết bị thứ hai.")
 +h3("Screen inventory||Danh mục màn hình")+table(["Screen||Màn hình","Purpose||Mục đích","Main actions||Thao tác chính","Release phase||Phase phát hành"],D.screens.map(s=>["<b>"+esc(s.name)+"</b>",esc(s.purpose),esc(s.actions),esc(s.phase)]),["","w","w","n"])
 +h3("Journeys the prototype does not cover||Hành trình prototype không phủ")+table(["Scenario||Kịch bản","In the prototype||Trong prototype","Since written or drawn||Đã viết hoặc vẽ sau đó"],D.missingFlows.map(r=>r.map(esc))),
()=>{const cats=uniq(D.findings.map(f=>f.cat)),types=uniq(D.findings.map(f=>f.type));
 const rows=D.findings.filter(f=>(!F("cat")||f.cat===F("cat"))&&(!F("type")||f.type===F("type"))&&(!F("fsev")||f.sev===F("fsev"))).sort((a,b)=>ORD[a.sev]-ORD[b.sev]);
 const n=s=>D.findings.filter(f=>f.sev===s).length;
 return head(2)+stats([[D.findings.length,"findings||phát hiện"],[n("C"),"critical||nghiêm trọng"],[n("H"),"high||cao"],[D.questions.length,"open questions||câu hỏi mở"],[D.assumptions.length,"assumptions||giả định"]])
 +"<div class='bar'>"+sel("cat","Category||Nhóm",cats)+sel("type","Type||Loại",types)+sel("fsev","Severity||Mức độ",["C","H","M","L"],o=>L(SEVL[o]))+shown(rows.length)+"</div>"
 +table(["ID","Finding||Phát hiện","Evidence in the prototype||Bằng chứng trong prototype","Category||Nhóm","Type||Loại","Severity||Mức độ","Status||Tình trạng"],rows.map(f=>[id(f.id),"<b>"+esc(f.text)+"</b>",esc(f.evidence),esc(f.cat),esc(f.type),sev(f.sev),fmt(f.status)]),["","w","w","n","n","","w"])
 +note("The questions and assumptions raised here are worked in phase 4, where each gets a status and a decision.||Các câu hỏi và giả định nêu ở đây được xử lý ở phase 4, nơi mỗi mục có trạng thái và quyết định.")},
()=>head(3)+stats([[D.findings.length+D.questions.length+D.assumptions.length,"raw items||mục thô"],[D.triage.length,"merged findings||phát hiện đã gộp"],[D.triage.filter(t=>t.sev==="C").length,"critical blockers||điểm chặn nghiêm trọng"],[D.dupes.length,"duplicate groups||nhóm trùng lặp"],[D.conflicts.length,"conflicts||mâu thuẫn"]])
 +h3("Findings backlog||Backlog phát hiện")+table(["ID","Finding||Phát hiện","Merges||Gộp từ","Category||Nhóm","Priority||Ưu tiên","Business impact||Ảnh hưởng","Owner||Phụ trách","Depends on · status||Phụ thuộc · tình trạng"],D.triage.slice().sort((a,b)=>ORD[a.sev]-ORD[b.sev]).map(t=>[id(t.id),"<b>"+esc(t.text)+"</b>",ids(t.merges),esc(t.cat),sev(t.sev),esc(t.impact),esc(t.owner),fmt(t.note)]),["","w","w","n","","w","n","w"])
 +h3("Duplicates removed||Trùng lặp đã gộp")+table(["Same problem||Cùng một vấn đề","Recorded as||Đã ghi nhận là","Kept in||Giữ ở"],D.dupes.map(r=>[esc(r[0]),id(r[1]),id(r[2])]))
 +h3("Conflicting findings||Phát hiện mâu thuẫn nhau")+table(["Topic||Chủ đề","The prototype||Prototype","Against||Đối lập với","Standing||Tình trạng"],D.conflicts.map(r=>r.map(fmt)))
 +h3("Dependencies||Phụ thuộc")+table(["Settle this first||Việc này phải xong trước","Because it holds up||Vì nó giữ chân"],D.depends.map(r=>r.map(esc))),
()=>{const owners=uniq(D.questions.flatMap(q=>q.owner.split(", ")));
 const rows=D.questions.filter(q=>(!F("qst")||st(q.id)===F("qst"))&&(!F("qsev")||q.sev===F("qsev"))&&(!F("own")||q.owner.includes(F("own"))));
 const stSel=i=>"<select data-st='"+i+"' id='st-"+i+"' aria-label='"+i+"'>"+STATUSES.map(s=>"<option value='"+s+"'"+(st(i)===s?" selected":"")+">"+L(STL[s])+"</option>").join("")+"</select>";
 return head(4)+stats([[D.confirmed.length,"confirmed decisions||quyết định đã chốt"],[openQ().length,"questions open||câu hỏi còn mở"],[blockers().length,"of them high priority||trong đó ưu tiên cao"],[openA().length,"assumptions undecided||giả định chưa quyết định"]])
 +note("**This log is live.** Set a status as each question is settled; requirement readiness in phases 6 and 10 follows. Statuses are kept in this browser only. The proposals are suggestions: none is used as a rule until it is confirmed.||**Sổ này hoạt động trực tiếp.** Đặt trạng thái khi mỗi câu hỏi được chốt; mức sẵn sàng của yêu cầu ở phase 6 và 10 đổi theo. Trạng thái chỉ lưu trong trình duyệt này. Các đề xuất chỉ là gợi ý: không cái nào được dùng làm quy tắc cho tới khi được chốt.")
 +h3("Decision log: open questions||Sổ quyết định: câu hỏi mở")+"<div class='bar'>"+sel("qst","Status||Trạng thái",STATUSES,o=>L(STL[o]))+sevSel("qsev")+sel("own","Owner||Phụ trách",owners)+shown(rows.length)+"<button class='btn' data-act='reset'>"+L("Reset all statuses||Đặt lại mọi trạng thái")+"</button></div>"
 +table(["ID","Decision needed||Cần quyết định","Proposal||Đề xuất","Owner||Phụ trách","Priority||Ưu tiên","Status||Trạng thái"],rows.map(q=>[id(q.id),"<b>"+fmt(q.q)+"</b>",fmt(q.proposal),esc(q.owner),sev(q.sev),stSel(q.id)]),["","w","w","n","",""])
 +h3("Assumptions||Giả định")+table(["ID","Assumed||Đang giả định","Why this value||Vì sao chọn vậy","Status||Trạng thái"],D.assumptions.map(a=>[id(a.id),"<b>"+fmt(a.text)+"</b>",fmt(a.why),stSel(a.id)]),["","w","w",""])
 +"<details class='fr'><summary><span class='id'>"+D.confirmed.length+"</span><b>"+L("Confirmed decisions already on record||Các quyết định đã chốt và được ghi lại")+"</b>"+pill(L(STL.Confirmed),"ok")+"</summary><div class='body' style='padding-left:14px'>"+table(["ID","Kind||Loại","Question||Câu hỏi","Answer chosen||Câu trả lời đã chọn"],D.confirmed.map(c=>[id(c.id),esc(c.kind),esc(c.q),"<b>"+esc(c.a)+"</b>"]),["","n","w","w"])+"</div></details>"},
()=>{const blocked=D.flows.filter(f=>flowBlocked(f).length),sum=k=>D.flows.reduce((a,f)=>a+f[k],0);
 return head(5)+stats([[D.flows.length,"flows drawn||flow đã vẽ"],[sum("steps"),"steps||bước"],[sum("decisions"),"decision points||điểm quyết định"],[sum("errors"),"error states||trạng thái lỗi"],[blocked.length,"blocked||bị chặn"]])
 +table(["Flow","Steps||Bước","Decisions||Quyết định","Error states||Trạng thái lỗi","Built on (confirmed)||Dựa trên (đã chốt)","Still assumed or open||Còn giả định hoặc mở","Result||Kết quả"],D.flows.map(f=>{const b=flowBlocked(f),o=f.open.filter(i=>!DONE.has(st(i)));return[id(f.id)+" <b>"+esc(f.title)+"</b>",f.steps,f.decisions,f.errors,ids(f.decided),ids(o),b.length?pill(L("Blocked by ||Bị chặn bởi ")+b.join(", "),"C"):o.length?pill(L("Valid, details open||Hợp lệ, chi tiết còn mở"),"M"):pill(L("Valid||Hợp lệ"),"ok")]}),["w","n","n","n","","",""])
 +note("Checked by script: every decision has at least two answers drawn, every step can be reached, and no step stops without being an end or a stated refusal. The charts themselves are on the Flows tab of the Toki Blueprint.||Được script kiểm tra: mọi quyết định có ít nhất hai câu trả lời được vẽ, mọi bước đều tới được, và không bước nào dừng lại mà không phải điểm kết thúc hoặc lần từ chối có ghi rõ. Các sơ đồ nằm ở tab Flows của Toki Blueprint.")
 +h3("Business rules||Quy tắc nghiệp vụ")+table(["ID","Rule||Quy tắc","Flows||Flow","Decided by||Quyết định bởi"],D.rules.map(r=>[id(r[0]),esc(r[1]),esc(r[2]),id(r[3])]),["","w","n",""])},
()=>{const areas=uniq(D.frs.map(f=>f.area));const rows=D.frs.filter(f=>(!F("area")||f.area===F("area"))&&(!F("rs")||frState(f)===F("rs")));
 const n=k=>D.frs.filter(f=>frState(f)===k).length;
 return head(6)+stats([[D.frs.length,"functional||chức năng"],[D.nfr.length,"non-functional||phi chức năng"],[n("R")+n("A"),"can start||bắt đầu được"],[n("Q"),"core ready||lõi sẵn sàng"],[n("B"),"blocked||bị chặn"]])
 +note("Each requirement states only what was decided, and quotes the answer. Whatever is still assumed or open is listed under it and is not part of the requirement.||Mỗi yêu cầu chỉ nêu những gì đã được quyết định, và trích lại câu trả lời. Những gì còn giả định hoặc còn mở được ghi bên dưới và không thuộc yêu cầu.")
 +"<div class='bar'>"+sel("area","Area||Mảng",areas)+sel("rs","Readiness||Mức sẵn sàng",["R","A","Q","B"],o=>L(FRS[o][0]))+shown(rows.length)+"</div><div>"
 +rows.map(f=>{const s=FRS[frState(f)],o=f.open.filter(i=>!DONE.has(st(i)));return "<details class='fr'><summary>"+id(f.id)+"<span><b>"+esc(f.text)+"</b><small style='display:block;color:var(--muted)'>"+esc(f.area)+"</small></span>"+pill(L(s[0]),s[1])+"</summary><div class='body'><dl><dt>"+L("Decided by||Quyết định bởi")+"</dt><dd>"+f.decided.map(d=>id(d.id)+" "+esc(d.a)).join("<br>")+"</dd><dt>"+L("Not yet decided||Chưa quyết định")+"</dt><dd>"+(o.length?o.map(i=>id(i)+" "+undecided(i)).join("<br>"):L("Nothing||Không có"))+"</dd><dt>"+L("Screen||Màn hình")+"</dt><dd>"+esc(f.screen)+"</dd><dt>"+L("Flow · rules||Flow · quy tắc")+"</dt><dd>"+esc(f.flows||"—")+" · "+esc(f.rules||"—")+"</dd></dl>"
   +f.acs.map(a=>"<div class='ac'>"+id(a.id)+" "+esc(a.text)+"</div>").join("")+"</div></details>"}).join("")+"</div>"
 +h3("Non-functional requirements||Yêu cầu phi chức năng")+table(["ID","Requirement||Yêu cầu","Decided by||Quyết định bởi","How it is measured||Đo bằng cách nào"],D.nfr.map(n=>[id(n.id),esc(n.text),id(n.src),fmt(n.measure)]),["","w","","w"])
 +h3("Non-functional areas with no decision||Mảng phi chức năng chưa có quyết định")+table(["Area||Mảng","Waits on||Chờ"],D.nfrMissing.map(r=>[esc(r[0]),id(r[1])]))},
()=>head(7)+stats([[allAC.length,"criteria||tiêu chí"],[D.frs.length,"requirements covered||yêu cầu được phủ"],[(allAC.length/D.frs.length).toFixed(1),"criteria per requirement||tiêu chí mỗi yêu cầu"]])
 +note("Each criterion is answered with yes or no, and its numbers come from decisions. A criterion that would need an undecided number is not written; it appears under missing coverage in phase 9.||Mỗi tiêu chí trả lời được bằng có hoặc không, và các con số lấy từ quyết định. Tiêu chí nào cần một con số chưa quyết định thì không được viết; nó xuất hiện ở phần thiếu độ phủ của phase 9.")
 +table(["ID","Requirement||Yêu cầu","Criterion||Tiêu chí","Tests||Test"],allAC.map(a=>[id(a.id),id(a.fr),esc(a.text),ids(a.tests.map(t=>t.id))]),["","","w",""]),
()=>{const types=["P","N","B","X"];const rows=allTS.filter(t=>(!F("tt")||t.type===F("tt"))&&(!F("tfr")||t.fr===F("tfr")));
 return head(8)+stats([[allTS.length,"scenarios||kịch bản"]].concat(types.map(t=>[allTS.filter(x=>x.type===t).length,TTL[t]])))
 +"<div class='bar'>"+sel("tt","Type||Loại",types,o=>L(TTL[o]))+sel("tfr","Requirement||Yêu cầu",D.frs.map(f=>f.id))+shown(rows.length)+"</div>"
 +table(["ID","Type||Loại","Scenario and expected result||Kịch bản và kết quả mong đợi","Criterion||Tiêu chí","Requirement||Yêu cầu"],rows.map(t=>[id(t.id),pill(L(TTL[t.type]),TTC[t.type]),esc(t.text),id(t.ac),id(t.fr)]),["","","w","",""])
 +h3("Technical points to prove before or during test design||Điểm kỹ thuật cần chứng minh trước hoặc trong khi thiết kế test")+table(["To prove||Cần chứng minh","Affects||Ảnh hưởng tới","How||Bằng cách"],D.techDeps.map(r=>[esc(r[0]),id(r[1]),esc(r[2])]),["w","","w"])},
()=>{const gaps=D.frs.filter(f=>f.open.some(i=>!DONE.has(st(i))));
 return head(9)+stats([[D.frs.length,"requirements traced||yêu cầu được truy vết"],["100%","criteria with a test||tiêu chí có test"],[gaps.length,"requirements with undecided parts||yêu cầu còn phần chưa quyết định"]])
 +h3("Traceability matrix||Ma trận truy vết")+table(["UI screen||Màn hình","Flow","Rules||Quy tắc","Requirement||Yêu cầu","Acceptance criteria||Tiêu chí chấp nhận","Test scenarios||Kịch bản test"],D.frs.map(f=>[esc(f.screen),esc(f.flows||"—"),ids(f.rules?f.rules.split(" "):[]),id(f.id),ids(f.acs.map(a=>a.id)),ids(f.acs.flatMap(a=>a.tests.map(t=>t.id)))]),["w","n","","","",""])
 +h3("Coverage analysis: what cannot be tested yet||Phân tích độ phủ: những gì chưa test được")+table(["Requirement||Yêu cầu","Undecided part||Phần chưa quyết định","Waits on||Chờ"],gaps.map(f=>{const o=f.open.filter(i=>!DONE.has(st(i)));return[id(f.id)+" "+esc(f.text.split(".")[0])+".",o.map(undecided).join("<br>"),ids(o)]}),["w","w",""])
 +note("Not yet written as requirements, so not traced: threads, reactions, pins, Activity filters, Files, People, Preferences, status, typing indicator, sign out. They are in scope and described in written journeys, but have no decision of their own to write a criterion from (question VQ-01).||Chưa được viết thành yêu cầu nên chưa truy vết: thread, reaction, ghim, bộ lọc Activity, Files, People, Preferences, trạng thái, chỉ báo đang gõ, sign out. Chúng thuộc phạm vi và có trong các hành trình đã viết, nhưng chưa có quyết định riêng để viết tiêu chí (câu hỏi VQ-01).","warn")},
()=>{const v=verdict(),b=blockers();const n=k=>D.frs.filter(f=>frState(f)===k);
 return head(10)+"<div class='note "+vcls(v)+"'>"+pill(v[0],v[1]+" big")+" &nbsp;"+esc(v[2])+". "+L("No development ticket is drawn until this reads Ready, or the remaining items are accepted in writing.||Không rút ticket phát triển nào cho tới khi ở đây ghi Sẵn sàng, hoặc các mục còn lại được chấp nhận bằng văn bản.")+"</div>"
 +h3("Definition of Ready||Definition of Ready")+"<div class='scroll'>"+DOR.map((d,i)=>{const ok=dorVal(d,i);return "<div class='check'><span class='mark "+(ok?"y":"x")+"'>"+(ok?"✓":"✕")+"</span><span>"+esc(L(d[0]))+(d[3]?"<br><small>"+esc(d[3]())+"</small>":"")+"</span><span class='id'>"+esc(d[1])+"</span>"+(d[2]?"<small>"+L("calculated||tự tính")+"</small>":"<label><input type='checkbox' id='dor-"+i+"' data-dor='"+i+"'"+(ok?" checked":"")+"> "+L("confirmed||đã xác nhận")+"</label>")+"</div>"}).join("")+"</div>"
 +h3("Readiness by requirement||Mức sẵn sàng theo yêu cầu")+table(["Readiness||Mức sẵn sàng","Requirements||Yêu cầu","What it means||Nghĩa là"],[["R","Fully decided; can be specified and built.||Đã quyết định đủ; viết spec và làm được."],["A","Buildable once the listed assumptions get a yes.||Làm được khi các giả định liệt kê được đồng ý."],["Q","The decided part can be built; the open detail is answered before its ticket closes.||Phần đã quyết định làm được; chi tiết còn mở được trả lời trước khi đóng ticket."],["B","A high-priority question decides its screens or rules. Do not start.||Một câu hỏi ưu tiên cao quyết định màn hình hoặc quy tắc của nó. Chưa bắt đầu."]].map(r=>[pill(L(FRS[r[0]][0]),FRS[r[0]][1]),ids(n(r[0]).map(f=>f.id)),esc(L(r[1]))]),["n","","w"])
 +"<h3>"+L("High-priority questions still open||Câu hỏi ưu tiên cao còn mở")+" ("+b.length+")</h3>"+table(["ID","Decision needed||Cần quyết định","Owner||Phụ trách","Holds up||Giữ chân"],b.map(q=>[id(q.id),fmt(q.q),esc(q.owner),ids(D.frs.filter(f=>f.open.includes(q.id)).map(f=>f.id))]),["","w","n",""])
 +h3("Deferred to later releases||Hoãn sang các bản phát hành sau")+table(["Phase","Name||Tên","Delivers||Nội dung"],D.deferred.map(p=>[id(p.id),"<b>"+esc(p.name)+"</b>",esc(p.delivers)]),["","n","w"])}
];

function render(){const v=verdict();
 document.documentElement.lang=S.lang;
 document.getElementById("title").innerHTML="<h1>Toki · BA &amp; QA Workflow</h1><p>"+L("From prototype to development-ready requirements, in ten phases. Filled with the Toki findings of ||Từ prototype tới yêu cầu sẵn sàng phát triển, qua mười phase. Điền bằng các phát hiện của Toki ngày ")+esc(D.built)+".</p>";
 document.querySelectorAll("[data-lang]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lang===S.lang)));
 document.getElementById("gate").innerHTML=pill(v[0],v[1]+" big")+"<span class='id'>"+blockers().length+L(" blocking · || chặn · ")+openQ().length+L(" open · || mở · ")+D.frs.filter(f=>frState(f)!=="B").length+"/"+D.frs.length+L(" FR startable|| FR bắt đầu được")+"</span>";
 document.getElementById("rail").innerHTML="<button data-go='0'"+(S.phase===0?" aria-current='page'":"")+"><span class='n'>—</span><span>"+L("Overview||Tổng quan")+"</span><span class='c'></span></button><div class='sep'></div>"+PH.map((p,i)=>"<button data-go='"+(i+1)+"'"+(S.phase===i+1?" aria-current='page'":"")+"><span class='n'>"+String(i+1).padStart(2,"0")+"</span><span>"+esc(L(p.n))+"</span><span class='c'>"+esc(p.c())+"</span></button>").join("");
 document.getElementById("main").innerHTML=VIEW[S.phase]()}
document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(g){S.phase=+g.dataset.go;S.f={};save();render();window.scrollTo(0,0);return}
 const l=e.target.closest("[data-lang]");if(l){const y=window.scrollY;S.lang=l.dataset.lang;S.f={};load();save();render();window.scrollTo(0,y);return}
 if(e.target.closest("[data-act='reset']")){S.status={};save();render()}});
document.addEventListener("change",e=>{const t=e.target;
 if(t.dataset.st){const y=window.scrollY;S.status[t.dataset.st]=t.value;save();render();window.scrollTo(0,y);const el=document.getElementById("st-"+t.dataset.st);if(el)el.focus()}
 else if(t.dataset.f){S.f[t.dataset.f]=t.value;render();const el=document.getElementById("f-"+t.dataset.f);if(el)el.focus()}
 else if(t.dataset.dor){S.dor[t.dataset.dor]=t.checked;save();render()}});
render();
