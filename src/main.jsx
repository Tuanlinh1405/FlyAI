import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight, BarChart3, Bell, Box, CalendarDays, Check, ChevronDown,
  CircleAlert, Clock3, Database, FileSpreadsheet, Gauge, Home, LineChart,
  Menu, PackageCheck, Plane, Search, ShieldCheck, ShoppingCart, Sparkles, SquarePen,
  Target, TrendingDown, TrendingUp, UploadCloud, Users, Warehouse, X
} from 'lucide-react'
import './styles.css'
import { analyzeUpload, DEFAULT_ANALYSIS, deriveScenario } from './dataEngine'
import { runMlForecast } from './mlClient'

const nf = new Intl.NumberFormat('vi-VN')
const money = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const DataContext = createContext(null)
const useAppData = () => useContext(DataContext)

const routes = [
  { id: 'about', label: 'Trang chủ', icon: Home },
  { id: 'overview', label: 'Input', icon: SquarePen },
  { id: 'forecast', label: 'Dự báo nhu cầu', icon: LineChart },
  { id: 'capacity', label: 'Phân tích năng lực', icon: Database },
  { id: 'plan', label: 'Kế hoạch chuẩn bị', icon: CalendarDays },
]

const topRoutes = ['forecast','capacity','plan','about'].map(id=>routes.find(route=>route.id===id))
const DEFAULT_ASSUMPTIONS = {
  campaignType:'Mega Sale', eventDate:'2026-11-11', startTime:'20:00', endTime:'23:00', cutoffTime:'23:30',
  traffic:30000, conversion:4.5, discount:30, voucher:500, freeship:true, banner:true, flashSale:true,
  itemsPerOrder:2.15, processingMinutes:51.5, efficiency:85, availableToPromise:5000,
  backlog:350, staging:1000, bags:1500, cartons:500, tape:80, labels:1500, cartonRate:35, ordersPerTape:25,
  confirmStaff:3, confirmRate:90, printStaff:3, printRate:75, pickingStaff:6, pickingRate:50, packingStaff:6, packingRate:40, handoffStaff:2, handoffRate:80,
}

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

function EmptyDataState({ title }) {
  const {setPage}=useAppData()
  return <Panel title={title} icon={UploadCloud}><div className="empty-data"><FileSpreadsheet size={44}/><strong>Chưa có dữ liệu để phân tích</strong><p>Hãy tải file Excel hoặc CSV ở trang Input. Dự báo, năng lực và kế hoạch chỉ được tạo từ file vừa tải.</p><button onClick={()=>setPage('overview')}><UploadCloud size={16}/>Đi đến tải dữ liệu</button></div></Panel>
}

function AppShell({ page, setPage, children }) {
  const [open, setOpen] = useState(false)
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <button className="close-menu" onClick={() => setOpen(false)} aria-label="Đóng menu"><X /></button>
      <Logo />
      <nav>{routes.map(({ id, label, icon: Icon, disabled }) => <button key={id} className={`${page === id ? 'active' : ''} ${disabled ? 'disabled' : ''}`} disabled={disabled} title={disabled ? 'Sẽ được triển khai ở giai đoạn sau' : undefined} onClick={() => { setPage(id); setOpen(false) }}><Icon size={20} /><span>{label}</span>{disabled && <small>Sắp có</small>}</button>)}</nav>
      <div className="ai-card"><span className="bot"><Sparkles /></span><div><strong>AI Forecast</strong><p>Trợ lý dự báo cho phiên livestream</p></div><ArrowRight size={17} /></div>
    </aside>
    <main className="app-main">
      <header className="app-topbar">
        <button className="menu-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu /></button>
        <div className="workflow-tabs">
          {topRoutes.map(({ id, label, icon: Icon, disabled }) => <button key={id} className={`${page === id ? 'active' : ''} ${disabled ? 'disabled' : ''}`} disabled={disabled} onClick={() => setPage(id)}><Icon size={18} />{label}</button>)}
        </div>
        <div className="account"><button className="bell" aria-label="Thông báo"><Bell size={20} /><b>3</b></button><span className="avatar">SD</span><strong>Seller Demo</strong><ChevronDown size={16} /></div>
      </header>
      <div className="content">{children}</div>
      <footer className="app-footer"><span><b>FLYING HIGH</b><i/>Smarter Logistics, Higher Growth</span><span><Clock3 size={14}/> Cập nhật lần cuối: 08/03/2026&nbsp;&nbsp;14:30</span></footer>
    </main>
  </div>
}

function DemandChart({ values = demand, labels = slots }) {
  const max = Math.max(...values, 1) * 1.15
  const points = values.map((v, i) => `${42 + i * 68},${180 - v / max * 135}`).join(' ')
  return <div className="chart-wrap" aria-label="Biểu đồ dự báo đơn hàng theo khung thời gian">
    <svg viewBox="0 0 560 225" role="img">
      {[0,1,2,3,4].map(i => <line key={i} x1="35" x2="530" y1={180-i*34} y2={180-i*34} className="grid-line" />)}
      {values.map((v, i) => <g key={i}><rect x={26+i*68} y={180-v/max*135} width="34" height={v/max*135} rx="5" className={v===Math.max(...values) ? 'bar peak' : 'bar'} /><text x={43+i*68} y={174-v/max*135} className="value-label">{nf.format(v)}</text><text x={43+i*68} y="203" className="axis-label">{labels[i]}</text></g>)}
      <polyline points={points} className="trend-line" /><g>{values.map((v,i)=><circle key={i} cx={42+i*68} cy={180-v/max*135} r="4" className="trend-dot" />)}</g>
    </svg>
  </div>
}

function OverviewPage() {
  const {data,assumptions,updateAssumption,handleUpload,upload,resetData}=useAppData()
  const numberField=(name)=>({value:assumptions[name],onChange:event=>updateAssumption(name,Number(event.target.value))})
  const stageInputs=[['confirm','Xác nhận'],['print','In vận đơn'],['picking','Lấy hàng'],['packing','Đóng gói'],['handoff','Bàn giao']]
  return <>
    <Panel title="Thị trường & Livestream" icon={CalendarDays}>
      <p className="section-note">Các yếu tố có thể làm nhu cầu thay đổi trong kỳ livestream.</p>
      <div className="form-grid"><label><span>Loại chiến dịch</span><div><select value={assumptions.campaignType} onChange={event=>updateAssumption('campaignType',event.target.value)}>{['Mega Sale','Livestream','Payday Sale','Seasonal & Festive','Time & Behavioral'].map(value=><option key={value}>{value}</option>)}</select><ChevronDown size={15}/></div></label><label><span>Ngày chiến dịch</span><div><input type="date" value={assumptions.eventDate} onChange={event=>updateAssumption('eventDate',event.target.value)}/><CalendarDays size={15}/></div></label><label><span>Thời gian</span><div className="inline-inputs"><input type="time" value={assumptions.startTime} onChange={event=>updateAssumption('startTime',event.target.value)}/><b>–</b><input type="time" value={assumptions.endTime} onChange={event=>updateAssumption('endTime',event.target.value)}/></div></label><label><span>Mức giảm giá dự kiến (%)</span><div><input type="number" min="0" max="100" {...numberField('discount')}/></div></label><label><span>Voucher</span><div><input type="number" min="0" {...numberField('voucher')}/></div></label><label><span>Traffic dự kiến</span><div><input type="number" min="0" {...numberField('traffic')}/></div></label><label><span>Conversion dự kiến (%)</span><div><input type="number" min="0" max="100" step="0.1" {...numberField('conversion')}/></div></label></div>
      <div className="check-row"><strong>Hỗ trợ từ sàn TMĐT</strong>{[['freeship','Freeship/trợ giá'],['banner','Banner trang chủ'],['flashSale','Flash Sale']].map(([key,label])=><button type="button" className={assumptions[key]?'checked':''} key={key} onClick={()=>updateAssumption(key,!assumptions[key])}><i>{assumptions[key]&&<Check size={13}/>}</i>{label}</button>)}</div>
    </Panel>
    <Panel title="Lịch sử bán hàng" icon={Target} action={data.source.uploaded&&<div className="panel-actions"><button className="soft-button" onClick={upload.rerun} disabled={upload.loading}><Sparkles size={15}/>Phân tích lại</button><button className="soft-button danger-button" onClick={resetData} disabled={upload.loading}><X size={15}/>Xóa dữ liệu</button></div>}>
      <p className="section-note">Dữ liệu lịch sử được dùng để tạo feature và kiểm tra chất lượng dự báo.</p>
      <div className="upload-grid">
        <label className={`dropzone ${upload.loading?'loading':''}`}><UploadCloud size={34}/><strong>{upload.loading?'Đang huấn luyện mô hình ML…':'Tải file Excel/CSV'}</strong><span>Đọc dữ liệu, tạo lag feature và kiểm định theo thời gian</span><input type="file" accept=".csv,.xlsx" onChange={event=>{handleUpload(event.target.files?.[0]);event.target.value=''}}/><b>Chọn file</b>{upload.error&&<em>{upload.error}</em>}{upload.mlWarning&&<small>{upload.mlWarning}</small>}</label>
        <div className={`file-preview ${data.source.uploaded?'':'empty-preview'}`}>{data.source.uploaded?<><div className="file-title"><FileSpreadsheet/><div><strong>{data.source.fileName}</strong><span>Đã phân tích · {data.source.sheetName}</span></div></div><div className="file-stats"><span>{nf.format(data.source.rows)} dòng</span><span>{nf.format(data.source.skus)} SKU</span><span>{data.source.months} tháng</span><span className={data.quality?.score<95?'negative':'positive'}>Chất lượng {data.quality?.score??100}%</span></div><strong>Kênh bán hàng</strong><div className="channels">{data.channels.slice(0,4).map(channel=><span key={channel.name}><i><Check/></i>{channel.name}</span>)}</div>{data.quality?.issues?.length>0&&<p className="quality-warning">{data.quality.issues.join(' · ')}</p>}</>:<><FileSpreadsheet size={30}/><strong>Chưa có file</strong><span>Tên file, số dòng, SKU và kênh bán sẽ xuất hiện sau khi upload.</span></>}</div>
        <div className={`campaigns ${data.source.uploaded?'':'empty-preview'}`}><strong>Campaign trước đây</strong>{data.source.uploaded?<table><thead><tr><th>Thời gian</th><th>Tổng đơn hàng</th></tr></thead><tbody>{(data.campaigns?.length?data.campaigns:data.months).slice(0,3).map(item=><tr key={item.date||item.month}><td>{item.date||item.month}</td><td>{nf.format(item.orders)} đơn</td></tr>)}</tbody></table>:<span>Chưa có dữ liệu campaign.</span>}</div>
      </div>
    </Panel>
    {data.source.uploaded&&<Panel title="Năng lực doanh nghiệp" icon={Gauge}>
      <div className="capability-grid expanded">
        <div><strong><Users/> Nhân sự theo công đoạn</strong><div className="mini-input-grid">{stageInputs.map(([key,label])=><label key={key}><span>{label}</span><b><input type="number" min="0" {...numberField(`${key}Staff`)}/> người</b></label>)}</div></div>
        <div><strong><Gauge/> Năng suất theo công đoạn</strong><div className="mini-input-grid">{stageInputs.map(([key,label])=><label key={key}><span>{label}</span><b><input type="number" min="1" {...numberField(`${key}Rate`)}/> đơn/người/giờ</b></label>)}</div></div>
        <div><strong><Box/> Đặc điểm đơn hàng</strong><div className="mini-input-grid"><label><span>Item TB/đơn</span><b><input type="number" min="0.1" step="0.1" {...numberField('itemsPerOrder')}/></b></label><label><span>Xử lý TB</span><b><input type="number" min="1" {...numberField('processingMinutes')}/> phút</b></label><label><span>Hiệu suất</span><b><input type="number" min="40" max="100" {...numberField('efficiency')}/>%</b></label></div></div>
        <div><strong><Warehouse/> Tồn kho & vật tư</strong><div className="mini-input-grid"><label><span>Available-to-promise</span><b><input type="number" min="0" {...numberField('availableToPromise')}/> SP</b></label><label><span>Túi / Hộp</span><b><input type="number" min="0" {...numberField('bags')}/> / <input type="number" min="0" {...numberField('cartons')}/></b></label><label><span>Băng keo / Phiếu</span><b><input type="number" min="0" {...numberField('tape')}/> / <input type="number" min="0" {...numberField('labels')}/></b></label></div></div>
        <div><strong><PackageCheck/> Đơn hàng & vận hành</strong><div className="mini-input-grid"><label><span>Đơn đang chờ</span><b><input type="number" min="0" {...numberField('backlog')}/></b></label><label><span>Staging capacity</span><b><input type="number" min="0" {...numberField('staging')}/></b></label><label><span>Cut-off</span><b><input type="time" value={assumptions.cutoffTime} onChange={event=>updateAssumption('cutoffTime',event.target.value)}/></b></label></div></div>
      </div>
    </Panel>}
  </>
}

function ForecastPage() {
  const {data,scenario}=useAppData()
  if(!data.source.uploaded)return <EmptyDataState title="Dự báo nhu cầu"/>
  const topCodes=scenario.topSkus.slice(0,3).map(item=>item.sku).join(', ')
  const peak=scenario.slots.reduce((best,item)=>item.orders>best.orders?item:best,scenario.slots[0]||{label:'n.a.',orders:0})
  return <>
    <div className="metrics four"><Metric icon={ShoppingCart} label="Tổng số đơn hàng dự kiến" value={nf.format(scenario.forecastOrders)} suffix="đơn" note={`P80: ${nf.format(scenario.interval.low)}–${nf.format(scenario.interval.high)} đơn`}/><Metric icon={Box} label="Số SKU trong dữ liệu" value={nf.format(data.source.skus)} suffix="SKU" note={`${nf.format(scenario.expectedUnits)} sản phẩm dự kiến`}/><Metric icon={Clock3} label="Khung giờ có nhu cầu cao nhất" value={peak.label} note={`${nf.format(peak.orders)} đơn dự kiến`}/><Metric icon={BarChart3} label="SKU có nhu cầu cao" value={topCodes||'n.a.'} note="Lịch sử × xu hướng 30 ngày"/></div>
    <div className="two-col main-split"><Panel title="Dự báo đơn hàng theo khung thời gian" icon={ShoppingCart} action={<span className="data-source-tag">Từ {nf.format(data.source.orders)} đơn lịch sử</span>}><div className="legend"><span><i className="dot blue"/>Số đơn dự kiến</span><span><i className="line blue"/>Phân bổ bằng mô hình thời gian</span></div><DemandChart values={scenario.slots.map(item=>item.orders)} labels={scenario.slots.map(item=>item.label)}/></Panel>
    <Panel title="SKU có nhu cầu cao" icon={Box} action={<button className="soft-button">Top 5<ChevronDown size={15}/></button>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Hạng</th><th>SKU</th><th>Tên sản phẩm</th><th>Dự kiến</th><th>Tỷ lệ</th><th>Trạng thái</th></tr></thead><tbody>{scenario.topSkus.map((p,i)=><tr key={p.sku}><td><span className={`rank rank-${i+1}`}>{i+1}</span></td><td><b>{p.sku}</b></td><td>{p.name}</td><td><b>{nf.format(p.forecastUnits)}</b></td><td>{(p.share*100).toFixed(1)}%</td><td><span className={`status ${i<2?'danger':i<4?'warn':'info'}`}>{i<2?'Ưu tiên cao':i<4?'Chuẩn bị sớm':'Theo dõi'}</span></td></tr>)}</tbody></table></div></Panel></div>
    {data.ml&&<Panel title="Kiểm định mô hình ML và Mega Sale" icon={Sparkles}><div className="ml-diagnostics"><article><span>Mô hình được chọn</span><strong>{data.ml.modelName}</strong><small>{data.ml.selectionReason||`${nf.format(data.ml.trainingPoints)} điểm huấn luyện`}</small></article><article><span>MAE walk-forward</span><strong>{data.ml.validation.mae.toFixed(2)} đơn/giờ</strong><small>{data.ml.candidates?.map(item=>`${item.name}: ${item.mae.toFixed(3)}`).join(' · ')||`Seasonal naive: ${data.ml.validation.seasonalNaiveMae.toFixed(2)}`}</small></article><article><span>Dự báo lai</span><strong>{nf.format(scenario.modelBaseline)} → {nf.format(scenario.forecastOrders)} đơn</strong><small>35% ML · 65% funnel · campaign {scenario.campaignFactor.toFixed(2)}×</small></article><article className="ai-insight"><span>{data.gemini?.headline||'Giải thích mô hình'}</span><strong>{data.gemini?.summary||'Bật Gemini ở backend để nhận phần diễn giải.'}</strong></article></div></Panel>}
    <Panel title="Dữ liệu bán hàng làm cơ sở dự báo" icon={BarChart3}><div className="product-strip">{scenario.topSkus.map(p=><article key={p.sku}><span className="product-letter">{p.sku.slice(0,3)}</span><div><strong>{p.name}</strong><b className="up"><TrendingUp/>{nf.format(p.units)} SP</b><small>{nf.format(p.orders)} đơn lịch sử · {money.format(p.revenue)}đ</small></div></article>)}</div></Panel>
  </>
}

const stages = [
  ['Xác nhận đơn',3200,3500],['In vận đơn',4800,4000],['Lấy hàng',3600,3800],['Đóng gói',5200,3700],['Bàn giao',1700,1900]
]
const bottlenecks = [stages[3], stages[1], stages[2], stages[0], stages[4]]

function CapacityBars({items=stages}) {
  const scale=Math.max(...items.flatMap(item=>item.slice(1)),1)/105
  return <div className="capacity-bars">{items.map(([name,need,cap])=><div className="stage" key={name}><div className="bar-pair"><i style={{height:`${need/scale}px`}}><b>{nf.format(need)}</b></i><i className="light" style={{height:`${cap/scale}px`}}><b>{nf.format(cap)}</b></i></div><span>{name}</span></div>)}</div>
}

function CapacityPage() {
  const {data,scenario,assumptions}=useAppData()
  if(!data.source.uploaded)return <EmptyDataState title="Phân tích năng lực"/>
  const volume=scenario.workload
  const liveStages=scenario.stages.map(stage=>[stage.name,stage.workload,stage.capacity])
  const liveBottlenecks=[...scenario.stages].sort((a,b)=>b.utilization-a.utilization)
  const delayed=scenario.delayedOrders
  return <>
    <div className="metrics five"><Metric icon={Box} label="Khối lượng cần xử lý" value={nf.format(volume)} suffix="đơn" note={`${nf.format(scenario.forecastOrders)} dự báo + ${nf.format(assumptions.backlog)} backlog`}/><Metric icon={Gauge} label="Năng lực bottleneck" value={nf.format(scenario.capacity)} suffix="đơn" note={`${scenario.availableHours.toFixed(1)} giờ đến cut-off`}/><Metric icon={CircleAlert} label="Chênh lệch công suất" value={delayed?`thiếu ${nf.format(delayed)}`:'Dư công suất'} suffix={delayed?'đơn':''} tone={delayed?'red':'blue'}/><Metric icon={Warehouse} label="Công đoạn nguy cơ nghẽn" value={scenario.bottleneck.name} tone={delayed?'red':'blue'} note={`Tải ${Math.round(scenario.bottleneck.utilization*100)}%`}/><Metric icon={Users} label="Nhu cầu nhân sự bổ sung" value={`+${scenario.extraStaff}`} suffix="nhân sự" note={`Tổng ${scenario.requiredStaff} người theo công đoạn`}/></div>
    <div className="two-col capacity-layout"><Panel title="Đánh giá khả năng xử lý đơn hàng" icon={Gauge}><p className="subheading">Khối lượng và năng lực tính từ nhân sự × năng suất × thời gian đến cut-off</p><CapacityBars items={liveStages}/><div className="slot-load-list">{scenario.staffBySlot.map(item=><span key={item.label} className={item.extra?'over':''}><b>{item.label}</b>{item.current}/{item.recommended} người<small>{item.overloadRate.toFixed(0)}% quá tải</small></span>)}</div></Panel>
    <Panel title="Điểm nghẽn theo công đoạn" icon={Target}><table className="data-table"><thead><tr><th>Công đoạn</th><th>Nhu cầu</th><th>Năng lực</th><th>Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>{liveBottlenecks.map(stage=><tr key={stage.key}><td><b>{stage.name}</b><small>{stage.staff} người × {stage.rate}/giờ</small></td><td>{nf.format(stage.workload)}</td><td>{nf.format(stage.capacity)}</td><td className={stage.shortage?'negative':'positive'}>{stage.shortage?`+${nf.format(stage.shortage)}`:nf.format(stage.capacity-stage.workload)}</td><td><span className={`status ${stage.status==='Vượt năng lực'?'danger':stage.status==='Cảnh báo'?'warn':'success'}`}>{stage.status}</span></td></tr>)}</tbody></table></Panel></div>
    <Panel title="Cảnh báo nguy cơ chậm bàn giao" icon={CircleAlert}><div className="risk-grid"><Metric icon={ShieldCheck} label="Mức độ rủi ro" value={scenario.risk} tone={delayed?'red':'blue'}/><Metric icon={FileSpreadsheet} label="Đơn có nguy cơ chậm" value={nf.format(delayed)} suffix="đơn" note={`${Math.round(delayed/Math.max(volume,1)*100)}% khối lượng`}/><Metric icon={Clock3} label="Khung giờ quá tải" value={scenario.overloadedSlot.label} note={`${scenario.overloadedSlot.overloadRate.toFixed(0)}% thiếu nhân lực`}/><Metric icon={Box} label="Công đoạn gây chậm" value={scenario.bottleneck.name} tone={delayed?'red':'blue'}/><Metric icon={Target} label="Khả năng đạt cut-off" value={`${scenario.cutoffReadiness}%`} tone={delayed?'red':'blue'}/></div><div className={`alert-box ${!delayed?'safe':''}`}><CircleAlert/><p>{delayed?`Bottleneck ${scenario.bottleneck.name.toLowerCase()} có thể làm chậm ${nf.format(delayed)} đơn. Bổ sung ${scenario.bottleneck.extraStaff} người tại công đoạn này hoặc điều chỉnh cut-off.`:`Các công đoạn đủ năng lực đến ${assumptions.cutoffTime}. Theo dõi tỷ lệ hủy ${(data.summary.cancelRate*100).toFixed(1)}% và hoàn hàng ${(data.summary.returnRate*100).toFixed(1)}%.`}</p></div></Panel>
  </>
}

function PlanPage() {
  const {data,scenario,assumptions,exportPlan}=useAppData()
  if(!data.source.uploaded)return <EmptyDataState title="Kế hoạch chuẩn bị"/>
  const planProducts = scenario.topSkus.map((item,index)=>[item.sku,item.name,item.forecastUnits,index<2?'Khu pick nhanh':index===2?'Gần bàn đóng gói':'Khu hàng thường',index<2?'Soạn trước và kiểm đếm tồn':index===2?'Đưa gần bàn đóng gói':'Theo dõi sau nhóm ưu tiên'])
  const allocation = scenario.staffBySlot.slice(-5).map(item=>[item.label,item.demand,item.workload])
  const staff = scenario.staffBySlot.slice(-5).map(item=>[item.label,item.current,item.recommended,`+${item.extra}`,item.extra?`Bổ sung cho ${scenario.bottleneck.name}`:'Duy trì xử lý'])
  const materialNeed=scenario.materials.reduce((sum,item)=>sum+item.need,0)
  const mats=scenario.materials.map(item=>[item.name,nf.format(item.need),nf.format(item.available),`${item.difference>0?'+':''}${nf.format(item.difference)}`,item.status])
  return <>
    <div className="page-actions"><span>Kế hoạch cập nhật theo dữ liệu và giả định hiện tại</span><button className="soft-button" onClick={exportPlan}><FileSpreadsheet size={15}/>Xuất kế hoạch CSV</button></div><div className="metrics five"><Metric icon={Box} label="SKU cần ưu tiên" value={scenario.topSkus.slice(0,3).map(item=>item.sku).join(', ')} note={`${scenario.productReadiness}% sẵn sàng hàng hóa`}/><Metric icon={Users} label="Nhân sự cần bổ sung" value={`+${scenario.extraStaff}`} suffix="nhân sự" tone={scenario.extraStaff?'red':'blue'} note={`${scenario.staffingReadiness}% sẵn sàng nhân sự`}/><Metric icon={PackageCheck} label="Vật tư cần chuẩn bị" value={nf.format(materialNeed)} suffix="đơn vị" note={`${scenario.materialReadiness}% sẵn sàng vật tư`}/><Metric icon={Clock3} label="Khung giờ chuẩn bị cao điểm" value={scenario.overloadedSlot.label} note={`${scenario.overloadedSlot.extra} người cần bổ sung`}/><Metric icon={Target} label="Tỷ lệ sẵn sàng kế hoạch" value={`${scenario.readiness}%`} note={`Hàng + người + vật tư + công suất`}/></div>
    <div className="two-col main-split plan-main"><Panel title="Đề xuất chuẩn bị hàng và xử lý đơn" icon={TrendingUp}><div className="table-wrap"><table className="data-table"><thead><tr><th>Hạng</th><th>SKU</th><th>Tên sản phẩm</th><th>Số lượng dự kiến</th><th>Khu vực chuẩn bị</th><th>Hành động đề xuất</th></tr></thead><tbody>{planProducts.map((p,i)=><tr key={p[0]}><td><span className={`rank rank-${i+1}`}>{i+1}</span></td><td><b>{p[0]}</b></td><td>{p[1]}</td><td><b>{nf.format(p[2])}</b></td><td>{p[3]}</td><td><span className={i<3?'action-ready':'action-later'}>{i<3?<Check/>:<ArrowRight/>}{p[4]}</span></td></tr>)}</tbody></table></div></Panel>
    <Panel title="Phân bổ khối lượng xử lý theo thời gian" icon={BarChart3}><div className="allocation-legend"><span><i/>Sản lượng dự kiến</span><span><i/>Khuyến nghị xử lý</span></div><div className="allocation-bars">{allocation.map(([time,a,b],i)=><div className={`allocation-stage ${i===3?'peak':''}`} key={time}><div><i style={{height:`${a/55}px`}}><b>{nf.format(a)}</b></i><i style={{height:`${b/55}px`}}><b>{nf.format(b)}</b></i></div><span>{time}</span></div>)}</div></Panel></div>
    <div className="two-col plan-bottom"><Panel title="Đề xuất chuẩn bị nhân sự" icon={Users}><div className="staff-prep"><div className="staff-chart">{staff.map(([time,current,recommended,extra])=><div key={time}><span className="staff-bars"><i style={{height:`${Math.min(current*5,105)}px`}}><b>{current}</b></i><i style={{height:`${Math.min(recommended*5,105)}px`}}><b>{recommended}</b></i><em style={{bottom:`${Math.min(recommended*5,105)+8}px`}}>{extra}</em></span><small>{time.split('–')[0]}</small></div>)}</div><div className="table-wrap"><table className="data-table"><thead><tr><th>Khung giờ</th><th>Hiện tại</th><th>Khuyến nghị</th><th>Cần bổ sung</th><th>Ghi chú</th></tr></thead><tbody>{staff.map(s=><tr key={s[0]}><td>{s[0]}</td><td>{s[1]}</td><td><b>{s[2]}</b></td><td className={s[3]==='+0'?'positive':'negative'}>{s[3]}</td><td>{s[4]}</td></tr>)}</tbody></table></div></div></Panel><Panel title="Đề xuất chuẩn bị vật tư đóng gói" icon={PackageCheck}><table className="data-table"><thead><tr><th>Vật tư</th><th>Nhu cầu</th><th>Hiện có</th><th>Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>{mats.map(m=><tr key={m[0]}><td><b>{m[0]}</b></td><td>{m[1]}</td><td>{m[2]}</td><td className={m[3].startsWith('-')?'negative':'positive'}>{m[3]}</td><td><span className={`status ${m[4]==='Thiếu hàng'?'danger':m[4]==='Cần bổ sung'?'warn':'success'}`}>{m[4]}</span></td></tr>)}</tbody></table><div className="readiness"><span><b>Tỷ lệ sẵn sàng vật tư đóng gói</b><strong>{scenario.materialReadiness}%</strong></span><i><b style={{width:`${scenario.materialReadiness}%`}}/></i></div></Panel></div>
    {data.planning&&<Panel title="Gemini đề xuất kế hoạch" icon={Sparkles}><div className="gemini-plan"><strong>{data.planning.headline}</strong><p>{data.planning.summary}</p>{data.planning.actions?.length>0&&<ol>{data.planning.actions.map(action=><li key={action}>{action}</li>)}</ol>}</div></Panel>}
  </>
}

function AboutPage() {
  const {setPage}=useAppData()
  const features = [
    ['/reference-icons/input-data.png','Nhập dữ liệu','Cung cấp thông tin phiên livestream, lịch sử đơn hàng, SKU và năng lực xử lý.','overview'],
    ['/reference-icons/demand-forecast.png','Dự báo nhu cầu','Dự kiến khối lượng đơn hàng, SKU nổi bật và khung giờ có nhu cầu cao.','forecast'],
    ['/reference-icons/capacity-analysis.png','Phân tích năng lực','Đánh giá khả năng xử lý, điểm nghẽn và nguy cơ quá tải.','capacity'],
    ['/reference-icons/preparation-plan.png','Kế hoạch chuẩn bị','Đề xuất chuẩn bị hàng, nhân sự, vật tư và phân bổ công việc.','plan'],
  ]
  const steps = [['/reference-icons/input-data.png','Nhập dữ liệu','Excel/CSV và thông tin phiên'],['/reference-icons/demand-forecast.png','Dự báo nhu cầu','ML, Mega Sale và xu hướng SKU'],['/reference-icons/capacity-analysis.png','Phân tích năng lực','Nhân sự, công suất và bottleneck'],['/reference-icons/preparation-plan.png','Kế hoạch chuẩn bị','Hàng hóa, vật tư và phân ca']]
  return <div className="landing about-landing">
    <section className="hero about-design-hero"><img src="/hero-logistics.png" alt="Nền tảng logistics hỗ trợ seller livestream"/><div className="hero-copy"><span>GIẢI PHÁP LOGISTICS THÔNG MINH CHO SELLER</span><h1>Dự báo chính xác.<br/>Chuẩn bị chủ động.<br/>Vận hành <em>hiệu quả.</em></h1><p>FLYING HIGH giúp seller dự báo nhu cầu, đánh giá năng lực xử lý và lập kế hoạch chuẩn bị đơn hàng cho từng phiên livestream.</p><div className="hero-actions"><button onClick={()=>setPage('overview')}>Bắt đầu khám phá <ArrowRight/></button><button className="ghost" onClick={()=>setPage('overview')}>Xem dashboard</button></div><ul><li><Search/>Dễ sử dụng</li><li><ShieldCheck/>Bảo mật dữ liệu</li><li><Users/>Đồng hành cùng seller</li></ul></div></section>

    <section className="platform-strip"><span>ĐƯỢC TIN DÙNG BỞI NHIỀU SELLER</span><div><b>TikTok Shop</b><b>Shopee</b><b>Lazada</b><b>Tiki</b><b>Sendo</b></div></section>

    <section className="problems"><div><span>BẠN CÓ ĐANG GẶP NHỮNG VẤN ĐỀ NÀY?</span><h2>Livestream bùng nổ,<br/>nhưng vận hành vẫn là thách thức.</h2></div>{[[Users,'Khó dự báo lượng đơn','Không biết sản phẩm nào sẽ bán chạy, thời điểm nào bùng nổ đơn.'],[Box,'Quá tải trong xử lý','Thiếu nhân sự, vật tư và không kịp chuẩn bị cho giờ cao điểm.'],[Clock3,'Nguy cơ chậm bàn giao','Đơn hàng tồn đọng, khách hàng chờ lâu và đánh giá giảm.'],[TrendingUp,'Chi phí tăng cao','Phát sinh chi phí làm thêm giờ và điều phối nguồn lực bị động.']].map(([Icon,title,text])=><article key={title}><Icon/><strong>{title}</strong><p>{text}</p></article>)}</section>

    <section className="impact-strip"><div><strong>Biến dữ liệu thành quyết định,<br/>biến thách thức thành tăng trưởng.</strong><span>Smarter Logistics, Higher Growth.</span></div>{[['95%','Dự báo chính xác'],['-30%','Thời gian chuẩn bị'],['-25%','Hiệu suất vận hành']].map(([value,label])=><article key={label}><b>{value}</b><small>{label}</small></article>)}</section>

    <section className="feature-section" id="about-features"><div className="section-title"><span>TÍNH NĂNG NỔI BẬT CỦA FLYING HIGH</span><h2>Tất cả những gì seller cần,<br/>trong <em>một nền tảng duy nhất.</em></h2><p>Kiểm soát toàn bộ phiên livestream từ khâu nhập dữ liệu đến kế hoạch chuẩn bị.</p></div><div className="feature-cards">{features.map(([icon,title,text,target])=><button key={title} onClick={()=>setPage(target)}><img className="reference-feature-icon" src={icon} alt=""/><strong>{title}</strong><p>{text}</p><span>Xem chi tiết <ArrowRight/></span></button>)}</div></section>

    <section className="process about-design-process"><div><span>QUY TRÌNH HOẠT ĐỘNG ĐƠN GIẢN</span><h2>Chỉ 4 bước để sẵn sàng<br/>cho phiên livestream.</h2><p>Từ dữ liệu đầu vào đến kế hoạch triển khai, FLYING HIGH giúp seller chuẩn bị nhanh chóng, chủ động và chính xác.</p></div><div className="process-steps">{steps.map(([icon,title,text],index)=><article key={title}><b>{index+1}</b><img className="reference-step-icon" src={icon} alt=""/><strong>{title}</strong><p>{text}</p></article>)}</div></section>

    <section className="value-section"><div className="value-copy"><span>GIÁ TRỊ DÀNH CHO SELLER</span><h2>Vì sao nên chọn<br/><em>FLYING HIGH?</em></h2><p>Không chỉ là công cụ, FLYING HIGH đồng hành cùng seller biến hàng tồn, nhân lực và vật tư thành một kế hoạch vận hành rõ ràng.</p><button onClick={()=>setPage('overview')}>Bắt đầu ngay <ArrowRight/></button></div><div className="value-cards">{[[Sparkles,'Ứng dụng AI tiện lợi'],[Database,'Giao diện trực quan'],[BarChart3,'Tối ưu vận hành'],[Users,'Đồng hành cùng seller']].map(([Icon,title])=><article key={title}><Icon/><strong>{title}</strong><p>Dữ liệu dễ hiểu, kết quả rõ ràng và có thể áp dụng ngay vào hoạt động chuẩn bị.</p></article>)}</div></section>

    <section className="partner-section"><div><span>ĐƯỢC TIN DÙNG BỞI NHIỀU SELLER</span><h2>Đồng hành cùng hàng nghìn thương hiệu trên các nền tảng</h2><p>Từ seller cá nhân đến doanh nghiệp, FLYING HIGH đã và đang hỗ trợ tối ưu vận hành cho nhiều lĩnh vực.</p><div className="partner-logos"><b>TikTok Shop</b><b>Shopee</b><b>Lazada</b><b>Tiki</b><b>Sendo</b></div></div><div className="partner-stats"><article><b>12.000+</b><span>mã HS được xử lý</span></article><article><b>3.500+</b><span>seller tin dùng</span></article><article><b>98%</b><span>độ chính xác trích xuất</span></article></div></section>

    <section className="benefit-section"><header><span>LỢI ÍCH VƯỢT TRỘI</span><h2>Tối ưu vận hành, mở rộng cơ hội</h2><p>Không chỉ là một công cụ, FLYING HIGH là trợ lý phân tích giúp seller vận hành hiệu quả và phát triển bền vững.</p></header><div>{[[Clock3,'Nhanh chóng','Rút ngắn thời gian xử lý dữ liệu và chuẩn bị kế hoạch.'],[Target,'Chính xác','Ứng dụng AI và dữ liệu lịch sử để dự báo sát thực tế.'],[TrendingUp,'Tiết kiệm chi phí','Giảm chi phí nhân sự, hạn chế rủi ro và phát sinh ngoài kế hoạch.'],[Plane,'Sẵn sàng mở rộng','Đồng hành cùng seller trong mọi giai đoạn phát triển.']].map(([Icon,title,text])=><article key={title}><Icon/><strong>{title}</strong><p>{text}</p></article>)}</div></section>

    <section className="testimonial-section"><header><span>CÂU CHUYỆN THÀNH CÔNG</span><h2>Seller nói gì về FLYING HIGH?</h2><p>Hàng nghìn seller đã cải thiện hiệu quả vận hành và tự tin hơn trong mỗi phiên livestream cùng FLYING HIGH.</p></header><div>{[['Nguyễn Thảo My','Seller thời trang','Từ khi dùng FLYING HIGH, mình dự báo được nhu cầu chính xác hơn, chuẩn bị hàng hóa dễ dàng và tự tin hơn rất nhiều cho mỗi phiên live.'],['Trần Minh Khang','Seller đồ gia dụng','Các cảnh báo về sức chứa kho và sản lượng giúp mình chủ động xử lý sớm, tránh tình trạng quá tải.'],['Lê Hoàng Anh','Seller mỹ phẩm','Giao diện dễ dùng, thông tin rõ ràng, giúp mình lên kế hoạch nhập hàng và chuẩn bị nhân sự nhanh chóng.']].map(([name,role,quote])=><article key={name}><div className="testimonial-avatar">{name.split(' ').at(-1)[0]}</div><span><strong>{name}</strong><small>{role}</small></span><b>★★★★★</b><p>“{quote}”</p></article>)}</div></section>

    <section className="faq-section" id="about-faq"><div><span>CÂU HỎI THƯỜNG GẶP</span><h2>Bạn còn thắc mắc?</h2><p>Thông tin để bạn hiểu rõ hơn cách hệ thống đọc dữ liệu, dự báo và lập kế hoạch.</p></div><div>{[['FLYING HIGH có phù hợp với seller nhỏ không?','Có. Hệ thống hoạt động từ file Excel/CSV và các giả định vận hành do seller cung cấp.'],['Dữ liệu có được lưu trữ lâu dài?','Hiện dữ liệu chỉ tồn tại trong phiên làm việc và được xóa khi tải lại trang.'],['Tôi có thể dùng thử trước khi đăng ký không?','Bạn có thể chạy local, tải file mẫu và kiểm tra toàn bộ luồng phân tích.'],['Hệ thống có hỗ trợ ngoài livestream không?','Có thể áp dụng cho Mega Sale, Payday Sale, chiến dịch theo mùa và các đợt bán hàng cao điểm.'],['Dữ liệu có cần đúng một mẫu không?','Tên cột được nhận diện linh hoạt, nhưng file cần có thông tin đơn hàng, thời gian, SKU, số lượng, doanh thu, xử lý và trạng thái.']].map(([question,answer])=><details key={question}><summary>{question}<ChevronDown/></summary><p>{answer}</p></details>)}</div></section>

    <section className="cta about-design-cta"><div><span>SẴN SÀNG CHO PHIÊN LIVESTREAM TIẾP THEO</span><h2>Bắt đầu tối ưu vận hành cùng FLYING HIGH ngay hôm nay.</h2><p>Trải nghiệm dự báo nhu cầu, phân tích năng lực và lập kế hoạch chuẩn bị trên dữ liệu của bạn.</p><button onClick={()=>setPage('overview')}>Bắt đầu miễn phí <ArrowRight/></button></div><Plane size={120}/></section>
  </div>
}

function DashboardApp() {
  const initial=location.hash.replace('#/','') || 'about'
  const [page,setPageState]=useState(routes.some(r=>r.id===initial && !r.disabled)?initial:'about')
  const [data,setData]=useState(DEFAULT_ANALYSIS)
  const [uploadState,setUploadState]=useState({ loading:false, error:'', mlWarning:'' })
  const [lastFile,setLastFile]=useState(null)
  const [assumptions,setAssumptions]=useState(()=>{try{return {...DEFAULT_ASSUMPTIONS,...JSON.parse(localStorage.getItem('flying-high-assumptions')||'{}')}}catch{return DEFAULT_ASSUMPTIONS}})
  const scenario=useMemo(()=>deriveScenario(data,assumptions),[data,assumptions])
  useEffect(()=>localStorage.setItem('flying-high-assumptions',JSON.stringify(assumptions)),[assumptions])
  const updateAssumption=(name,value)=>setAssumptions(current=>({...current,[name]:value}))
  const runForecast=async(file,analysis)=>{setUploadState({loading:true,error:'',mlWarning:''});try{const result=await runMlForecast(file,assumptions);setData({...analysis,ml:result.model,gemini:result.gemini,planning:result.planning});setUploadState({loading:false,error:'',mlWarning:''})}catch(error){setData(analysis);setUploadState({loading:false,error:'',mlWarning:`Đã đọc dữ liệu nhưng ML chưa chạy: ${error.message}`})}}
  const handleUpload=async(file)=>{if(!file)return;setLastFile(file);setUploadState({loading:true,error:'',mlWarning:''});try{const analysis=await analyzeUpload(file);setData(analysis);setAssumptions(current=>({...current,itemsPerOrder:Number(data.source.uploaded?current.itemsPerOrder:analysis.summary.avgItemsPerOrder.toFixed(2)),processingMinutes:Number(data.source.uploaded?current.processingMinutes:analysis.summary.avgProcessingMinutes.toFixed(1))}));await runForecast(file,analysis)}catch(error){setUploadState({loading:false,error:error.message||'Không thể đọc file.',mlWarning:''})}}
  const resetData=()=>{setData(DEFAULT_ANALYSIS);setLastFile(null);setUploadState({loading:false,error:'',mlWarning:''});setAssumptions(current=>({...current,itemsPerOrder:DEFAULT_ASSUMPTIONS.itemsPerOrder,processingMinutes:DEFAULT_ASSUMPTIONS.processingMinutes}))}
  const exportPlan=()=>{const rows=[['LOẠI','HẠNG MỤC','NHU CẦU','HIỆN CÓ','CHÊNH LỆCH/TRẠNG THÁI'],...scenario.topSkus.map(item=>['SKU',`${item.sku} - ${item.name}`,item.forecastUnits,'',item.changePercent+'% xu hướng']),...scenario.stages.map(item=>['CÔNG ĐOẠN',item.name,item.workload,item.capacity,item.status]),...scenario.materials.map(item=>['VẬT TƯ',item.name,item.need,item.available,item.difference])];const csv='\uFEFF'+rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`ke-hoach-${assumptions.eventDate}.csv`;link.style.display='none';document.body.appendChild(link);link.click();setTimeout(()=>{URL.revokeObjectURL(url);link.remove()},0)}
  const upload={...uploadState,canRerun:Boolean(lastFile),rerun:()=>lastFile&&runForecast(lastFile,data)}
  const setPage=(id)=>{setPageState(id); history.replaceState(null,'',`#/`+id); window.scrollTo(0,0)}
  const content={overview:<OverviewPage/>,forecast:<ForecastPage/>,capacity:<CapacityPage/>,plan:<PlanPage/>,about:<AboutPage/>}[page]
  return <DataContext.Provider value={{data,scenario,assumptions,updateAssumption,handleUpload,upload,resetData,exportPlan,setPage}}><AppShell page={page} setPage={setPage}>{content}</AppShell></DataContext.Provider>
}

function Landing({ enterApp }) {
  return <div className="landing">
    <header className="landing-nav"><Logo/><nav><a href="#home">Trang chủ</a><a href="#features">Tính năng</a><a href="#process">Quy trình</a><a href="#faq">FAQ</a></nav><div><button className="ghost">Đăng nhập</button><button onClick={enterApp}>Bắt đầu ngay</button></div></header>
    <main><section className="hero" id="home"><img src="/hero-logistics.png" alt="Nền tảng logistics hỗ trợ seller livestream"/><div className="hero-copy"><span>GIẢI PHÁP LOGISTICS THÔNG MINH CHO SELLER</span><h1>Dự báo chính xác.<br/>Chuẩn bị chủ động.<br/>Vận hành <em>hiệu quả</em>.</h1><p>FLYING HIGH giúp seller dự báo nhu cầu, đánh giá năng lực xử lý và lập kế hoạch chuẩn bị đơn hàng cho từng phiên livestream.</p><div className="hero-actions"><button onClick={enterApp}>Bắt đầu khám phá <ArrowRight/></button><button className="ghost" onClick={enterApp}>Xem dashboard</button></div><ul><li><Search/>Dễ sử dụng</li><li><ShieldCheck/>Bảo mật dữ liệu</li><li><Users/>Đồng hành cùng seller</li></ul></div></section>
    <section className="problems"><div><span>BẠN CÓ ĐANG GẶP NHỮNG VẤN ĐỀ NÀY?</span><h2>Livestream bùng nổ,<br/>nhưng vận hành vẫn là thách thức.</h2></div>{[[Users,'Khó dự báo lượng đơn'],[Box,'Quá tải trong xử lý'],[Clock3,'Nguy cơ chậm bàn giao'],[TrendingUp,'Chi phí tăng cao']].map(([Icon,t])=><article key={t}><Icon/><strong>{t}</strong><p>Thiếu dữ liệu và kế hoạch khiến đội vận hành khó phản ứng kịp thời.</p></article>)}</section>
    <section className="feature-section" id="features"><div className="section-title"><span>TÍNH NĂNG NỔI BẬT</span><h2>Tất cả những gì seller cần,<br/>trong <em>một nền tảng duy nhất.</em></h2><p>Kiểm soát toàn bộ phiên livestream từ khâu nhập dữ liệu đến kế hoạch chuẩn bị.</p></div><div className="feature-cards">{[[FileSpreadsheet,'Nhập dữ liệu','overview'],[BarChart3,'Dự báo nhu cầu','forecast'],[Gauge,'Phân tích năng lực','capacity'],[PackageCheck,'Kế hoạch chuẩn bị','plan']].map(([Icon,t,target],i)=><button key={t} onClick={()=>{location.hash=`#/${target}`;enterApp()}}><Icon/><strong>{t}</strong><p>{['Cung cấp thông tin phiên livestream, SKU và năng lực xử lý.','Dự kiến khối lượng đơn hàng, SKU nổi bật và khung giờ cao điểm.','Đánh giá khả năng xử lý, điểm nghẽn và nguy cơ quá tải.','Đề xuất chuẩn bị hàng, nhân sự, vật tư và phân bổ công việc.'][i]}</p><span>Xem chi tiết <ArrowRight/></span></button>)}</div></section>
    <section className="process" id="process"><div><span>QUY TRÌNH HOẠT ĐỘNG</span><h2>Chỉ 4 bước để sẵn sàng<br/>cho phiên livestream.</h2><p>Dữ liệu đầu vào được chuyển thành kế hoạch hành động rõ ràng.</p></div><div className="process-steps">{[[FileSpreadsheet,'Nhập dữ liệu'],[BarChart3,'Dự báo nhu cầu'],[Gauge,'Phân tích năng lực'],[PackageCheck,'Kế hoạch chuẩn bị']].map(([Icon,t],i)=><article key={t}><b>{i+1}</b><Icon/><strong>{t}</strong><p>{['Cung cấp dữ liệu cần thiết','Ước tính nhu cầu','Nhận diện điểm nghẽn','Đề xuất nguồn lực'][i]}</p></article>)}</div></section>
    <section className="cta"><div><span>SẴN SÀNG CHO PHIÊN LIVESTREAM TIẾP THEO</span><h2>Bắt đầu tối ưu vận hành cùng FLYING HIGH.</h2><p>Trải nghiệm dự báo nhu cầu, phân tích năng lực và lập kế hoạch trên dữ liệu minh họa.</p><button onClick={enterApp}>Xem dashboard <ArrowRight/></button></div><Plane size={120}/></section>
    </main><footer><Logo/><span>© 2026 FLYING HIGH. All rights reserved.</span></footer>
  </div>
}

function Root() {
  useEffect(()=>{if(!location.hash.startsWith('#/'))history.replaceState(null,'','#/about')},[])
  return <DashboardApp/>
}

const rootElement=document.getElementById('root')
rootElement.__flyingHighRoot ||= createRoot(rootElement)
rootElement.__flyingHighRoot.render(<Root />)
