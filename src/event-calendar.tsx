import { useEffect, useState } from 'react';
import { App, Button, Calendar, Card, DatePicker, Form, Input, Modal, Space, Spin } from 'antd';
import { PictureOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { request, query } from './api';
import { extractImageEvents, type ImageSuggestion } from './image-events';

type EventRow = { id: string; name: string; startAt: string; endAt: string; timeConfirmed: boolean; assignments?: { status: string }[] };
type Draft = ImageSuggestion & { id: string };
function warning(e: EventRow) {
  const days = dayjs(e.startAt).startOf('day').diff(dayjs().startOf('day'), 'day');
  const assigned = e.assignments ?? [];
  if (days >= 0 && days <= 5 && !assigned.some(a => a.status === 'CONFIRMED' || a.status === 'COMPLETED')) return { color: 'event-red', label: 'Sắp diễn ra, chưa có người xác nhận' };
  if (!assigned.length) return { color: 'event-orange', label: 'Chưa có người' };
  if (!e.timeConfirmed) return { color: 'event-yellow', label: 'Chưa xác định giờ' };
  return { color: '', label: 'Đã có người và giờ' };
}

export function EventCalendar({ revision }: { revision: number }) {
  const [month, setMonth] = useState(dayjs());
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<EventRow>();
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const rangeStart = mode === 'year' ? month.startOf('year') : month.startOf('month');
        const rangeEnd = mode === 'year' ? month.endOf('year') : month.endOf('month');
        const rows: EventRow[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await request<EventRow[]>(`/events${query({ page, pageSize: 100, startFrom: rangeStart.toISOString(), startTo: rangeEnd.toISOString() })}`);
          rows.push(...res.data); totalPages = res.meta?.totalPages ?? 1; page++;
        } while (page <= totalPages);
        if (active) setEvents(rows.filter(e => dayjs(e.endAt).isAfter(rangeStart) && dayjs(e.startAt).isBefore(rangeEnd)));
      } catch (e) { if (active) { setEvents([]); setError(e instanceof Error ? e.message : 'Không tải được lịch'); } }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [month.format(mode === 'year' ? 'YYYY' : 'YYYY-MM'), mode, revision]);
  return <section className="panel event-calendar" style={{ marginBottom: 24 }}>
    <div className="panel-head"><div><h2>Lịch sự kiện</h2><p>Vàng: chưa có giờ · Cam: chưa có người · Đỏ: gần đến ngày, chưa có người xác nhận</p></div>{loading && <Spin size="small"/>}</div>
    {error && <div className="error-notice">{error}</div>}
    <Calendar value={month} mode={mode} onPanelChange={(value, nextMode) => { setMonth(value); setMode(nextMode); }} onSelect={value => { if (!value.isSame(month, mode === 'year' ? 'year' : 'month')) setMonth(value); }} cellRender={(day, info) => {
      if (info.type === 'month') { const count = events.filter(event => dayjs(event.startAt).isBefore(day.endOf('month')) && dayjs(event.endAt).isAfter(day.startOf('month'))).length; return <div className="year-event-count">{count ? <><strong>{count}</strong><span>sự kiện</span></> : <span>0 sự kiện</span>}</div>; }
      if (info.type !== 'date') return info.originNode;
      return <div className="month-events">{events.filter(event => dayjs(event.startAt).isBefore(day.endOf('day')) && dayjs(event.endAt).isAfter(day.startOf('day'))).map(event => <button type="button" title={`${event.name} — ${warning(event).label}`} className={`month-event ${warning(event).color} ${dayjs(event.endAt).isBefore(dayjs(), 'day') ? 'event-past' : ''}`} key={event.id} onClick={ev => { ev.stopPropagation(); setSelected(event); }}>{event.name}</button>)}</div>;
    }}/>
    <Modal title={selected?.name} open={!!selected} onCancel={() => setSelected(undefined)} footer={null}>{selected && <p>{selected.timeConfirmed ? `${dayjs(selected.startAt).format('DD/MM/YYYY HH:mm')} — ${dayjs(selected.endAt).format('DD/MM/YYYY HH:mm')}` : `${dayjs(selected.startAt).format('DD/MM/YYYY')} · Chưa xác định giờ`}</p>}</Modal>
  </section>;
}

function DraftForm({ draft, onSaved, onRemove }: { draft: Draft; onSaved: () => void; onRemove: () => void }) {
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const { message } = App.useApp();
  const date = draft.date ? dayjs(draft.date) : undefined;
  return <Card size="small" style={{ marginBottom: 12 }} extra={<Button type="text" danger onClick={onRemove}>Bỏ</Button>}>
    <Form form={form} layout="vertical" initialValues={{ name: draft.name, startDate: date }} onFinish={async v => {
      const start: Dayjs = v.startDate.startOf('day');
      const end: Dayjs = start.add(1, 'day');
      setBusy(true);
      try { await request('/events', { method: 'POST', body: { name: v.name.trim(), startAt: start.toISOString(), endAt: end.toISOString(), timeConfirmed: false, ...(v.location?.trim() ? { location: v.location.trim() } : {}) } }); message.success('Đã tạo sự kiện'); onSaved(); }
      catch (e) { message.error(e instanceof Error ? e.message : 'Không tạo được sự kiện'); }
      finally { setBusy(false); }
    }}>
      <Form.Item name="name" label="Tên sự kiện — kiểm tra phần chữ có thể bị cắt" rules={[{ required: true, whitespace: true, max: 200 }]}><Input/></Form.Item>
      <Space wrap align="start">
        <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY"/></Form.Item>
      </Space>
      <Form.Item name="location" label="Địa điểm (không bắt buộc)"><Input/></Form.Item>
      <Button type="primary" loading={busy} onClick={() => form.submit()}>Xác nhận tạo sự kiện</Button>
    </Form>
  </Card>;
}

export function ImageEventImport({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [raw, setRaw] = useState('');
  const { message } = App.useApp();
  const addDrafts = (items: ImageSuggestion[]) => setDrafts(items.map(item => ({ ...item, id: crypto.randomUUID() })));
  const readFile = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { message.error('Chọn ảnh có dung lượng tối đa 10 MB.'); return; }
    setBusy(true); setDrafts([]); setRaw('');
    let worker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | undefined;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('vie+eng');
      const result = await worker.recognize(file);
      setRaw(result.data.text); const items = extractImageEvents(result.data.text); addDrafts(items);
      if (!items.length) message.warning('Chưa nhận diện được sự kiện. Bạn có thể thêm thủ công bên dưới.');
    } catch { message.error('Không đọc được ảnh. Kiểm tra kết nối mạng để tải bộ nhận diện hoặc thêm thủ công.'); }
    finally { await worker?.terminate(); setBusy(false); }
  };
  return <><Button icon={<PictureOutlined/>} onClick={() => setOpen(true)}>Tạo từ ảnh</Button><Modal title="Tạo sự kiện từ ảnh" open={open} onCancel={() => setOpen(false)} footer={null} width={850} destroyOnHidden>
    <p>Chọn ảnh lịch. Hệ thống gợi ý nội dung; bạn kiểm tra tên và ngày trước khi xác nhận từng sự kiện. Giờ có thể bổ sung sau.</p>
    <p className="muted">Ảnh được xử lý trong trình duyệt. Lần đầu cần mạng để tải bộ nhận diện chữ.</p>
    <input type="file" accept="image/*" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void readFile(file); e.target.value = ''; }}/>
    {busy && <p><Spin size="small"/> Đang nhận diện ảnh, vui lòng chờ…</p>}
    {raw && <details style={{ margin: '16px 0' }}><summary>Văn bản đọc được từ ảnh</summary><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>{raw}</pre></details>}
    <div style={{ margin: '16px 0' }}><Button icon={<PlusOutlined/>} onClick={() => setDrafts(prev => [...prev, { id: crypto.randomUUID(), name: '' }])}>Thêm sự kiện thủ công</Button></div>
    {drafts.map(d => <DraftForm key={d.id} draft={d} onRemove={() => setDrafts(prev => prev.filter(x => x.id !== d.id))} onSaved={() => { setDrafts(prev => prev.filter(x => x.id !== d.id)); onCreated(); }}/>) }
  </Modal></>;
}
