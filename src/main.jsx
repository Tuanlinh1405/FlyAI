import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight, BarChart3, Bell, Box, CalendarDays, Check, ChevronDown,
  CircleAlert, Clock3, Database, FileSpreadsheet, Gauge, Home, LineChart,
  Menu, PackageCheck, Plane, Search, ShieldCheck, ShoppingCart, Sparkles,
  Target, TrendingDown, TrendingUp, UploadCloud, Users, Warehouse, X
} from 'lucide-react'
import './styles.css'

const nf = new Intl.NumberFormat('vi-VN')

const routes = [
  { id: 'overview', label: 'Tổng quan', icon: Home },
  { id: 'input', label: 'Input', icon: FileSpreadsheet },
  { id: 'forecast', label: 'Dự báo nhu cầu', icon: LineChart },
  { id: 'capacity', label: 'Phân tích năng lực', icon: Database },
  { id: 'plan', label: 'Kế hoạch chuẩn bị', icon: CalendarDays },
]

const demand = [1200, 1800, 2300, 2000, 2800, 3600, 4500, 2200]
const slots = ['08–10', '10–12', '12–14', '14–16', '16–18', '18–20', '20–22', '22–24']
const products = [
  { sku: 'A', name: 'Áo thun basic', orders: 4860, share: '26,3%', change: 32, status: 'Áp lực lớn' },
  { sku: 'B', name: 'Quần jean nữ', orders: 3920, share: '21,2%', change: 18, status: 'Áp lực lớn' },
  { sku: 'C', name: 'Túi xách thời trang', orders: 2850, share: '15,4%', change: 12, status: 'Áp lực lớn' },
  { sku: 'D', name: 'Giày thể thao', orders: 1980, share: '10,7%', change: -6, status: 'Cao' },
  { sku: 'E', name: 'Áo khoác', orders: 1320, share: '7,1%', change: -4, status: 'Trung bình' },
]

function Logo({ compact = false }) {
  return <div className={`logo ${compact ? 'compact' : ''}`}>
    <span className="logo-mark"><Plane size={22} fill="currentColor" /></span>
    <span><strong>FLYING HIGH</strong>{!compact && <small>Smarter Logistics, Higher Growth</small>}</span>
  </div>
}

function MockBadge() {
  return <span className="mock-badge"><Sparkles size={13} /> Dữ liệu minh họa</span>
}

function Metric({ icon: Icon, label, value, suffix, tone = 'blue', note }) {
  return <article className={`metric-card tone-${tone}`}>
    <span className="metric-icon"><Icon size={22} /></span>
    <div><p>{label}</p><strong>{value}</strong>{suffix && <span className="suffix"> {suffix}</span>}{note && <small>{note}</small>}</div>
  </article>
}

function Panel({ title, icon: Icon, action, children, className = '' }) {
  return <section className={`panel ${className}`}>
    <header className="panel-head"><h2>{Icon && <Icon size={20} />} {title}</h2>{action}</header>
    {children}
  </section>
}

function AppShell({ page, setPage, children }) {
  const [open, setOpen] = useState(false)
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <button className="close-menu" onClick={() => setOpen(false)} aria-label="Đóng menu"><X /></button>
      <Logo />
      <nav>{routes.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setOpen(false) }}><Icon size={20} /><span>{label}</span></button>)}</nav>
      <div className="ai-card"><span className="bot"><Sparkles /></span><div><strong>AI Forecast</strong><p>Trợ lý dự báo cho phiên livestream</p></div><ArrowRight size={17} /></div>
    </aside>
    <main className="app-main">
      <header className="app-topbar">
        <button className="menu-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu /></button>
        <div className="workflow-tabs">
          {routes.slice(2).map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={18} />{label}</button>)}
        </div>
        <div className="account"><button className="bell" aria-label="Thông báo"><Bell size={20} /><b>3</b></button><span className="avatar">SD</span><strong>Seller Demo</strong><ChevronDown size={16} /></div>
      </header>
      <div className="content"><div className="content-meta"><MockBadge /><span>Cập nhật: 08/03/2026 · 14:30</span></div>{children}</div>
    </main>
  </div>
}

function DemandChart() {
  const max = 5000
  const points = demand.map((v, i) => `${42 + i * 68},${180 - v / max * 135}`).join(' ')
  return <div className="chart-wrap" aria-label="Biểu đồ dự báo đơn hàng theo khung thời gian">
    <svg viewBox="0 0 560 225" role="img">
      {[0,1,2,3,4].map(i => <line key={i} x1="35" x2="530" y1={180-i*34} y2={180-i*34} className="grid-line" />)}
      {demand.map((v, i) => <g key={i}><rect x={26+i*68} y={180-v/max*135} width="34" height={v/max*135} rx="5" className={i===6 ? 'bar peak' : 'bar'} /><text x={43+i*68} y={174-v/max*135} className="value-label">{nf.format(v)}</text><text x={43+i*68} y="203" className="axis-label">{slots[i]}</text></g>)}
      <polyline points={points} className="trend-line" /><g>{demand.map((v,i)=><circle key={i} cx={42+i*68} cy={180-v/max*135} r="4" className="trend-dot" />)}</g>
    </svg>
  </div>
}

function InputPage() {
  return <>
    <Panel title="Thị trường & Livestream" icon={CalendarDays}>
      <p className="section-note">Các yếu tố có thể làm nhu cầu thay đổi trong kỳ livestream.</p>
      <div className="form-grid">
        {[
          ['Loại chiến dịch','Mega Sale'],['Ngày livestream','11/11/2026'],['Thời gian','20:00 – 23:00'],['Mức giảm giá dự kiến','30%'],['Voucher','500'],['Traffic dự kiến','30.000'],['Conversion dự kiến','4,5%']
        ].map(([label,value])=><label key={label}><span>{label}</span><div>{value}<ChevronDown size={15}/></div></label>)}
      </div>
      <div className="check-row"><strong>Hỗ trợ từ sàn TMĐT</strong>{['Freeship/trợ giá','Banner trang chủ','Flash Sale'].map(x=><span key={x}><i><Check size={13}/></i>{x}</span>)}</div>
    </Panel>
    <Panel title="Lịch sử bán hàng" icon={Target}>
      <p className="section-note">Dữ liệu lịch sử được dùng để tạo feature và kiểm tra chất lượng dự báo.</p>
      <div className="upload-grid">
        <label className="dropzone"><UploadCloud size={34}/><strong>Tải file Excel/CSV</strong><span>Kéo thả file hoặc chọn từ thiết bị</span><input type="file" accept=".csv,.xlsx,.xls"/><b>Chọn file</b></label>
        <div className="file-preview"><div className="file-title"><FileSpreadsheet/><div><strong>sales_history.xlsx</strong><span>Đã tải lên thành công</span></div></div><div className="file-stats"><span>12.450 dòng</span><span>85 SKU</span><span>6 tháng</span></div><strong>Kênh bán hàng</strong><div className="channels"><span><i><Check/></i>Shopee</span><span><i><Check/></i>TikTok Shop</span><span>Lazada</span><span>Website</span></div></div>
        <div className="campaigns"><strong>Campaign trước đây</strong><table><thead><tr><th>Thời gian</th><th>Tổng đơn hàng</th></tr></thead><tbody><tr><td>11/11/2025</td><td>8.250</td></tr><tr><td>12/12/2025</td><td>10.420</td></tr><tr><td>06/06/2026</td><td>7.850</td></tr></tbody></table></div>
      </div>
    </Panel>
    <Panel title="Năng lực doanh nghiệp" icon={Gauge}>
      <div className="capability-grid">
        <div><strong><Users/> Nhân sự & năng suất</strong><p><span>Nhân sự khả dụng<b>20 người</b></span><span>Picking<b>50 đơn/người/giờ</b></span><span>Packing<b>40 đơn/người/giờ</b></span></p></div>
        <div><strong><Box/> Đặc điểm đơn hàng</strong><p><span>Item TB/đơn<b>2,1</b></span><span>Thời gian xử lý TB<b>3,5 phút/đơn</b></span></p></div>
        <div><strong><Warehouse/> Tồn kho & vật tư</strong><p><span>Available-to-promise<b>5.000 sản phẩm</b></span><span>Vật tư đóng gói<b>Đủ</b></span></p></div>
        <div><strong><PackageCheck/> Đơn hàng & vận hành</strong><p><span>Đơn đang chờ<b>350 đơn</b></span><span>Staging capacity<b>1.000 đơn</b></span><span>Cut-off<b>23:30</b></span></p></div>
      </div>
    </Panel>
  </>
}

function ForecastPage() {
  return <>
    <div className="metrics four"><Metric icon={ShoppingCart} label="Tổng số đơn hàng dự kiến" value="18.500" suffix="đơn" note="↑ 22% so với phiên trước"/><Metric icon={Box} label="Số SKU có phát sinh nhu cầu" value="85" suffix="SKU" note="8 SKU chiếm phần lớn nhu cầu"/><Metric icon={Clock3} label="Khung giờ tăng cao nhất" value="20:00–22:00" note="Dự kiến tăng 35%"/><Metric icon={BarChart3} label="SKU có nhu cầu cao" value="A, B, C" note="Chiếm 68% tổng số đơn"/></div>
    <div className="two-col main-split"><Panel title="Dự báo đơn hàng theo khung thời gian" icon={ShoppingCart} action={<button className="soft-button"><CalendarDays size={16}/>08/03/2026<ChevronDown size={15}/></button>}><div className="legend"><span><i className="dot blue"/>Số đơn dự kiến</span><span><i className="line blue"/>Xu hướng</span></div><DemandChart/></Panel>
    <Panel title="SKU có nhu cầu cao" icon={Box} action={<button className="soft-button">Top 5<ChevronDown size={15}/></button>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Hạng</th><th>SKU</th><th>Tên sản phẩm</th><th>Dự kiến</th><th>Tỷ lệ</th><th>Trạng thái</th></tr></thead><tbody>{products.map((p,i)=><tr key={p.sku}><td><span className={`rank rank-${i+1}`}>{i+1}</span></td><td><b>{p.sku}</b></td><td>{p.name}</td><td><b>{nf.format(p.orders)}</b></td><td>{p.share}</td><td><span className={`status ${i<3?'danger':i===3?'warn':'info'}`}>{p.status}</span></td></tr>)}</tbody></table></div></Panel></div>
    <Panel title="Mức tăng/giảm nhu cầu theo SKU so với phiên trước" icon={BarChart3}><div className="product-strip">{products.map(p=><article key={p.sku}><span className="product-letter">{p.sku}</span><div><strong>{p.name}</strong><b className={p.change>0?'up':'down'}>{p.change>0?<TrendingUp/>:<TrendingDown/>}{Math.abs(p.change)}%</b><small>So với phiên trước</small></div></article>)}</div></Panel>
  </>
}

const stages = [
  ['Xác nhận đơn',3200,3500],['In vận đơn',4800,4000],['Lấy hàng',3600,3800],['Đóng gói',5200,3700],['Bàn giao',1700,1900]
]

function CapacityBars() {
  return <div className="capacity-bars">{stages.map(([name,need,cap])=><div className="stage" key={name}><div className="bar-pair"><i style={{height:`${need/55}px`}}><b>{nf.format(need)}</b></i><i className="light" style={{height:`${cap/55}px`}}><b>{nf.format(cap)}</b></i></div><span>{name}</span></div>)}</div>
}

function CapacityPage() {
  return <>
    <div className="metrics five"><Metric icon={Box} label="Khối lượng xử lý dự kiến" value="18.500" suffix="đơn"/><Metric icon={Gauge} label="Năng lực xử lý hiện tại" value="16.900" suffix="đơn"/><Metric icon={CircleAlert} label="Tổng thiếu công suất" value="2.300" suffix="đơn" tone="red"/><Metric icon={Warehouse} label="Công đoạn nguy cơ nghẽn" value="Đóng gói" tone="red" note="Tải trọng vượt 42%"/><Metric icon={Users} label="Nhu cầu nhân sự bổ sung" value="+8" suffix="nhân sự"/></div>
    <div className="two-col capacity-layout"><Panel title="Đánh giá khả năng xử lý đơn hàng" icon={Gauge}><p className="subheading">Khối lượng dự kiến và năng lực hiện tại theo công đoạn</p><CapacityBars/><div className="staff-line"><strong>Nhu cầu nhân sự theo khung giờ</strong><svg viewBox="0 0 620 100"><polyline points="30,74 165,54 300,38 435,22 570,58"/><polyline className="dashed" points="30,82 165,66 300,56 435,56 570,72"/>{[8,12,16,18,10].map((v,i)=><g key={i}><circle cx={30+i*135} cy={[74,54,38,22,58][i]} r="4"/><text x={30+i*135} y={[66,46,30,14,50][i]}>{v}</text></g>)}</svg></div></Panel>
    <Panel title="Điểm nghẽn theo công đoạn" icon={Target}><table className="data-table"><thead><tr><th>Công đoạn</th><th>Nhu cầu</th><th>Năng lực</th><th>Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>{stages.map(([n,a,b])=><tr key={n}><td><b>{n}</b></td><td>{nf.format(a)}</td><td>{nf.format(b)}</td><td className={a>b?'negative':'positive'}>{a>b?'+':''}{nf.format(a-b)}</td><td><span className={`status ${a>b?(a-b>1000?'danger':'warn'):'success'}`}>{a>b?(a-b>1000?'Vượt năng lực':'Cảnh báo'):'Ổn định'}</span></td></tr>)}</tbody></table></Panel></div>
    <Panel title="Cảnh báo nguy cơ chậm bàn giao" icon={CircleAlert}><div className="risk-grid"><Metric icon={ShieldCheck} label="Mức độ rủi ro" value="Cao" tone="red"/><Metric icon={FileSpreadsheet} label="Đơn có nguy cơ chậm" value="2.150" suffix="đơn"/><Metric icon={Clock3} label="Khung giờ quá tải" value="20:00–22:00"/><Metric icon={Box} label="Công đoạn gây chậm" value="Đóng gói" tone="red"/><Metric icon={Target} label="Khả năng đạt cut-off" value="82%" tone="red"/></div><div className="alert-box"><CircleAlert/><p>Nhu cầu dự kiến vượt năng lực ở công đoạn đóng gói và in vận đơn. Ưu tiên bổ sung nhân sự, chuẩn bị vật tư và phân bổ nguồn lực trước 20:00.</p></div></Panel>
  </>
}

function PlanPage() {
  const mats=[['Túi đóng gói','12.000','15.000','+3.000','Đủ dùng'],['Hộp carton','4.500','3.000','-1.500','Thiếu hàng'],['Băng keo','2.000','2.500','+500','Đủ dùng'],['Phiếu vận đơn','3.000','1.800','-1.200','Cần bổ sung']]
  return <>
    <div className="metrics five"><Metric icon={Box} label="SKU cần ưu tiên" value="A, B, C" note="3 SKU trọng tâm"/><Metric icon={Users} label="Nhân sự cần bổ sung" value="+8" suffix="nhân sự" tone="red"/><Metric icon={PackageCheck} label="Vật tư cần chuẩn bị" value="21.500" suffix="bộ"/><Metric icon={Clock3} label="Khung giờ chuẩn bị cao điểm" value="20:00–22:00"/><Metric icon={Target} label="Tỷ lệ sẵn sàng kế hoạch" value="84%" note="↑ 12% so với hôm trước"/></div>
    <div className="two-col main-split"><Panel title="Đề xuất chuẩn bị hàng và xử lý đơn" icon={TrendingUp}><table className="data-table"><thead><tr><th>Hạng</th><th>SKU</th><th>Tên sản phẩm</th><th>Số lượng dự kiến</th><th>Khu vực chuẩn bị</th><th>Hành động đề xuất</th></tr></thead><tbody>{products.map((p,i)=><tr key={p.sku}><td>{i+1}</td><td><b>{p.sku}</b></td><td>{p.name}</td><td><b>{nf.format(p.orders)}</b></td><td>{i<2?'Khu pick nhanh':i===2?'Gần bàn đóng gói':'Khu hàng thường'}</td><td><span className={i<3?'action-ready':'action-later'}>{i<3?<Check/>:<ArrowRight/>}{i<3?(i===2?'Chuẩn bị gần bàn đóng gói':'Đưa ra khu vực pick nhanh'):'Xử lý sau nhóm ưu tiên'}</span></td></tr>)}</tbody></table></Panel>
    <Panel title="Phân bổ khối lượng xử lý theo thời gian" icon={BarChart3}><CapacityBars/></Panel></div>
    <div className="two-col plan-bottom"><Panel title="Đề xuất chuẩn bị nhân sự" icon={Users}><CapacityBars/></Panel><Panel title="Đề xuất chuẩn bị vật tư đóng gói" icon={PackageCheck}><table className="data-table"><thead><tr><th>Vật tư</th><th>Nhu cầu</th><th>Hiện có</th><th>Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>{mats.map((m,i)=><tr key={m[0]}><td><b>{m[0]}</b></td><td>{m[1]}</td><td>{m[2]}</td><td className={m[3].startsWith('-')?'negative':'positive'}>{m[3]}</td><td><span className={`status ${i===1?'danger':i===3?'warn':'success'}`}>{m[4]}</span></td></tr>)}</tbody></table><div className="readiness"><span><b>Tỷ lệ sẵn sàng vật tư đóng gói</b><strong>76%</strong></span><i><b style={{width:'76%'}}/></i></div></Panel></div>
  </>
}

function OverviewPage({ navigate }) {
  return <div className="overview-page"><div className="welcome"><div><MockBadge/><h1>Chuẩn bị chủ động cho phiên livestream tiếp theo.</h1><p>Hoàn thiện dữ liệu đầu vào để hệ thống tạo dự báo nhu cầu, đánh giá năng lực và đề xuất kế hoạch vận hành.</p><button onClick={()=>navigate('input')}>Bắt đầu nhập dữ liệu <ArrowRight/></button></div><div className="readiness-ring"><span><b>68%</b><small>Mức độ sẵn sàng</small></span></div></div><div className="overview-grid"><Panel title="Quy trình chuẩn bị" icon={Sparkles}><div className="steps">{routes.slice(1).map(({label,icon:Icon},i)=><button key={label} onClick={()=>navigate(routes[i+1].id)}><span>{i+1}</span><Icon/><strong>{label}</strong><small>{['Cung cấp dữ liệu chiến dịch và lịch sử bán hàng','Ước tính nhu cầu theo SKU và thời gian','Xác định điểm nghẽn và rủi ro','Phân bổ hàng hóa, nhân sự và vật tư'][i]}</small></button>)}</div></Panel><Panel title="Việc cần hoàn thành" icon={PackageCheck}><ul className="task-list"><li className="done"><Check/>Thông tin chiến dịch</li><li className="done"><Check/>Lịch sử bán hàng</li><li><Clock3/>Xác nhận năng suất đóng gói</li><li><Clock3/>Kiểm tra tồn kho vật tư</li></ul></Panel></div></div>
}

function DashboardApp({ goLanding }) {
  const initial=location.hash.replace('#/','') || 'input'
  const [page,setPageState]=useState(routes.some(r=>r.id===initial)?initial:'input')
  const setPage=(id)=>{setPageState(id); history.replaceState(null,'',`#/`+id); window.scrollTo(0,0)}
  const content={overview:<OverviewPage navigate={setPage}/>,input:<InputPage/>,forecast:<ForecastPage/>,capacity:<CapacityPage/>,plan:<PlanPage/>}[page]
  return <AppShell page={page} setPage={setPage}>{content}</AppShell>
}

function Landing({ enterApp }) {
  return <div className="landing">
    <header className="landing-nav"><Logo/><nav><a href="#home">Trang chủ</a><a href="#features">Tính năng</a><a href="#process">Quy trình</a><a href="#faq">FAQ</a></nav><div><button className="ghost">Đăng nhập</button><button onClick={enterApp}>Bắt đầu ngay</button></div></header>
    <main><section className="hero" id="home"><img src="/hero-logistics.png" alt="Nền tảng logistics hỗ trợ seller livestream"/><div className="hero-copy"><span>GIẢI PHÁP LOGISTICS THÔNG MINH CHO SELLER</span><h1>Dự báo chính xác.<br/>Chuẩn bị chủ động.<br/>Vận hành <em>hiệu quả</em>.</h1><p>FLYING HIGH giúp seller dự báo nhu cầu, đánh giá năng lực xử lý và lập kế hoạch chuẩn bị đơn hàng cho từng phiên livestream.</p><div className="hero-actions"><button onClick={enterApp}>Bắt đầu khám phá <ArrowRight/></button><button className="ghost" onClick={enterApp}>Xem dashboard</button></div><ul><li><Search/>Dễ sử dụng</li><li><ShieldCheck/>Bảo mật dữ liệu</li><li><Users/>Đồng hành cùng seller</li></ul></div></section>
    <section className="problems"><div><span>BẠN CÓ ĐANG GẶP NHỮNG VẤN ĐỀ NÀY?</span><h2>Livestream bùng nổ,<br/>nhưng vận hành vẫn là thách thức.</h2></div>{[[Users,'Khó dự báo lượng đơn'],[Box,'Quá tải trong xử lý'],[Clock3,'Nguy cơ chậm bàn giao'],[TrendingUp,'Chi phí tăng cao']].map(([Icon,t])=><article key={t}><Icon/><strong>{t}</strong><p>Thiếu dữ liệu và kế hoạch khiến đội vận hành khó phản ứng kịp thời.</p></article>)}</section>
    <section className="feature-section" id="features"><div className="section-title"><span>TÍNH NĂNG NỔI BẬT</span><h2>Tất cả những gì seller cần,<br/>trong <em>một nền tảng duy nhất.</em></h2><p>Kiểm soát toàn bộ phiên livestream từ khâu nhập dữ liệu đến kế hoạch chuẩn bị.</p></div><div className="feature-cards">{[[FileSpreadsheet,'Nhập dữ liệu'],[BarChart3,'Dự báo nhu cầu'],[Gauge,'Phân tích năng lực'],[PackageCheck,'Kế hoạch chuẩn bị']].map(([Icon,t],i)=><button key={t} onClick={()=>{location.hash=`#/${routes[i+1].id}`;enterApp()}}><Icon/><strong>{t}</strong><p>{['Cung cấp thông tin phiên livestream, SKU và năng lực xử lý.','Dự kiến khối lượng đơn hàng, SKU nổi bật và khung giờ cao điểm.','Đánh giá khả năng xử lý, điểm nghẽn và nguy cơ quá tải.','Đề xuất chuẩn bị hàng, nhân sự, vật tư và phân bổ công việc.'][i]}</p><span>Xem chi tiết <ArrowRight/></span></button>)}</div></section>
    <section className="process" id="process"><div><span>QUY TRÌNH HOẠT ĐỘNG</span><h2>Chỉ 4 bước để sẵn sàng<br/>cho phiên livestream.</h2><p>Dữ liệu đầu vào được chuyển thành kế hoạch hành động rõ ràng.</p></div><div className="process-steps">{[[FileSpreadsheet,'Nhập dữ liệu'],[BarChart3,'Dự báo nhu cầu'],[Gauge,'Phân tích năng lực'],[PackageCheck,'Kế hoạch chuẩn bị']].map(([Icon,t],i)=><article key={t}><b>{i+1}</b><Icon/><strong>{t}</strong><p>{['Cung cấp dữ liệu cần thiết','Ước tính nhu cầu','Nhận diện điểm nghẽn','Đề xuất nguồn lực'][i]}</p></article>)}</div></section>
    <section className="cta"><div><span>SẴN SÀNG CHO PHIÊN LIVESTREAM TIẾP THEO</span><h2>Bắt đầu tối ưu vận hành cùng FLYING HIGH.</h2><p>Trải nghiệm dự báo nhu cầu, phân tích năng lực và lập kế hoạch trên dữ liệu minh họa.</p><button onClick={enterApp}>Xem dashboard <ArrowRight/></button></div><Plane size={120}/></section>
    </main><footer><Logo/><span>© 2026 FLYING HIGH. All rights reserved.</span></footer>
  </div>
}

function Root() {
  const [inApp,setInApp]=useState(location.hash.startsWith('#/'))
  useEffect(()=>{const f=()=>setInApp(location.hash.startsWith('#/'));addEventListener('hashchange',f);return()=>removeEventListener('hashchange',f)},[])
  const enterApp=()=>{if(!location.hash.startsWith('#/'))location.hash='#/input';setInApp(true)}
  return inApp?<DashboardApp/>:<Landing enterApp={enterApp}/>
}

createRoot(document.getElementById('root')).render(<Root />)
