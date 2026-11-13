import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getSession, request } from './api';
import { refreshQuotationNotifications } from './quotation-notifications';

type PackageRow = { id: string; code: string; label: string; durationMinutes: number | null; price: number; isFeatured: boolean; sortOrder: number; enabled: boolean };
type Storefront = { slug: string; categoryKey: string; publicName: string; kicker?: string; shortDescription: string; heroTitle?: string; heroAccent?: string; features: string[]; detail?: string; sortOrder: number; pricingConfig: unknown; schemaVersion: number; status: 'DRAFT' | 'PUBLISHED'; publishedAt?: string; updatedAt: string };
type ServiceConfig = { id: number; code: string; name: string; storefront: Storefront | null; packages: PackageRow[] };
type QuoteItem = { id: string; label: string; amount: number };
type QuoteDiscount = { code: string; name: string; type: 'PERCENT' | 'FIXED'; value: number; amount: number };
type QuoteSnapshot = { serviceId?: number; serviceName?: string; serviceSlug?: string; total?: number | null; subtotal?: number | null; discount?: QuoteDiscount; transport?: number; options?: number; currency?: string; priceStatus?: 'OFFICIAL' | 'REFERENCE' | 'CONTACT_ONLY'; priceMessage?: string; items?: QuoteItem[]; selection?: Record<string, unknown>; region?: { id?: string; name?: string } };
type QuoteRequest = { id: string; code: string; status: string; customerName: string; phone: string; email?: string; eventDate?: string; eventTime?: string; venue: string; notes?: string; quoteSnapshot: QuoteSnapshot; eventId?: string; createdAt: string };
type DiscountCodeRow = { id: string; code: string; name: string; type: 'PERCENT' | 'FIXED'; value: number; maxDiscount: number | null; minimumSubtotal: number; startsAt: string | null; endsAt: string | null; usageLimit: number | null; usageCount: number; enabled: boolean; createdAt: string; updatedAt: string };
type OfficialRegionId = 'danang' | 'hcm' | 'hanoi';
type OtherRegionMode = 'REFERENCE' | 'CONTACT_ONLY';
type RegionPolicy = { defaultRegionId: OfficialRegionId; otherMode: OtherRegionMode; referenceRegionId: OfficialRegionId; otherMessage: string };
type PricingConfig = Record<string, unknown> & { type?: string; regionPolicy?: RegionPolicy };

const vnd = (value?: number | null) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);
const normalizeDiscountCode = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
const statusColors: Record<string, string> = { NEW: 'blue', CONTACTED: 'gold', CONFIRMED: 'green', REJECTED: 'red', DRAFT: 'default', PUBLISHED: 'green' };
const quotationStatusOptions = [
  { value: 'NEW', label: 'Yêu cầu mới' },
  { value: 'CONTACTED', label: 'Đã liên hệ' },
  { value: 'CONFIRMED', label: 'Xác nhận & khóa lịch' },
  { value: 'REJECTED', label: 'Đã từ chối' },
];
const quotationStatusLabels = Object.fromEntries(quotationStatusOptions.map((item) => [item.value, item.label]));
const officialRegions: Array<{ id: OfficialRegionId; label: string }> = [{ id: 'danang', label: 'Đà Nẵng' }, { id: 'hcm', label: 'TP. Hồ Chí Minh' }, { id: 'hanoi', label: 'Hà Nội' }];
const referenceMessage = 'Giá trên mang tính tham khảo. Chi phí vận chuyển, công tác và tổng báo giá sẽ được xác nhận theo địa điểm tổ chức.';
const contactMessage = 'Khu vực này chưa có cấu hình giá. Vui lòng gửi thông tin sự kiện để T-RED xác nhận báo giá.';
const defaultRegionPolicy = (categoryKey: string): RegionPolicy => categoryKey === 'glambot'
  ? { defaultRegionId: 'danang', otherMode: 'CONTACT_ONLY', referenceRegionId: 'hcm', otherMessage: contactMessage }
  : { defaultRegionId: 'danang', otherMode: 'REFERENCE', referenceRegionId: 'danang', otherMessage: referenceMessage };
const defaultPricing: Record<string, unknown> = {
  photobooth: { type: 'photobooth', baseDurationHours: 4, basePrice: 0, additionalHourPrice: 0, supervisionPricePerHour: 0, transport: { basePrice: 400000, includedDistanceKm: 15, additionalPricePerKm: 20000, regionalBasePrices: { hcm: 7000000, hanoi: 7000000 } }, printing: { fixedPricePerPrint: 0, minimumPrints: 200, unlimitedPricePerHour: 0 }, guide: { pricePerPersonPerHour: 0, minimumHours: 2 }, aiPackages: [] },
  experience: { type: 'experience', transport: { basePrice: 0, includedDistanceKm: 0, additionalPricePerKm: 0 } },
  booth360: { type: 'booth360', minimumPackageHoursByRegion: { hcm: 4, hanoi: 4 }, transport: { basePrice: 400000, includedDistanceKm: 15, additionalPricePerKm: 20000, regionalBasePrices: { hcm: 7000000, hanoi: 7000000 } } },
  glambot: { type: 'glambot', otherRegion: { baseDurationHours: 4, basePrice: 0, additionalHourPrice: 0, maximumHours: 12 } },
};

function useServiceConfig(serviceId: number) {
  const [data, setData] = useState<ServiceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData((await request<ServiceConfig>(`/quotation/service-items/${serviceId}/storefront`)).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được cấu hình dịch vụ'); }
    finally { setLoading(false); }
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, load };
}

export function ServicePublicationPanel({ serviceId, onConfigure, onChanged }: { serviceId: number; onConfigure: () => void; onChanged?: () => void }) {
  const { message } = App.useApp();
  const config = useServiceConfig(serviceId);
  const isAdmin = getSession()?.user.role === 'ADMIN';
  const storefront = config.data?.storefront;
  const publish = async (value: boolean) => {
    try { await request(`/quotation/service-items/${serviceId}/storefront/${value ? 'publish' : 'unpublish'}`, { method: 'POST' }); message.success(value ? 'Đã xuất bản dịch vụ' : 'Đã chuyển dịch vụ về bản nháp'); await config.load(); onChanged?.(); }
    catch (reason) { message.error(reason instanceof Error ? reason.message : 'Không thể đổi trạng thái xuất bản'); }
  };
  if (config.loading) return <Card className="publication-card"><Spin size="small"/> Đang tải trạng thái xuất bản...</Card>;
  return <Card className="publication-card" title={<Space>Trạng thái nội dung <Tag color={storefront ? statusColors[storefront.status] : 'default'}>{storefront?.status || 'CHƯA CẤU HÌNH'}</Tag></Space>} extra={isAdmin && storefront ? <Space><Button disabled={storefront.status === 'DRAFT'} onClick={() => void publish(false)}>Về bản nháp</Button><Button type="primary" icon={<SendOutlined/>} disabled={storefront.status === 'PUBLISHED'} onClick={() => void publish(true)}>PUBLISHED</Button></Space> : null}>
    {config.error && <Alert type="error" showIcon message={config.error}/>} {storefront ? <div className="publication-summary"><div><span>Tên public</span><strong>{storefront.publicName}</strong></div><div><span>Đường dẫn</span><strong>/{storefront.slug}</strong></div><div><span>Cập nhật</span><strong>{new Date(storefront.updatedAt).toLocaleString('vi-VN')}</strong></div></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Dịch vụ chưa có nội dung và gói giá"/>}
    <Button style={{ marginTop: 16 }} onClick={onConfigure}>{storefront ? 'Mở nội dung & gói giá' : 'Bắt đầu cấu hình'}</Button>
  </Card>;
}

export function ServicePricingContent({ serviceId, serviceName, onChanged }: { serviceId: number; serviceName: string; onChanged?: () => void }) {
  const { message } = App.useApp();
  const config = useServiceConfig(serviceId);
  const [form] = Form.useForm();
  const [packageForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageRow | null>(null);
  const isAdmin = getSession()?.user.role === 'ADMIN';
  useEffect(() => {
    if (config.loading) return;
    const current = config.data?.storefront;
    if (current) {
      const pricingConfig = current.pricingConfig as PricingConfig;
      form.setFieldsValue({ ...current, ...(pricingConfig.regionPolicy || defaultRegionPolicy(current.categoryKey)), featuresText: current.features.join('\n'), pricingJson: JSON.stringify({ ...pricingConfig, regionPolicy: undefined }, null, 2) });
    } else {
      const categoryKey = 'photobooth';
      form.setFieldsValue({ categoryKey, slug: serviceName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), publicName: serviceName, shortDescription: serviceName, featuresText: '', sortOrder: 0, schemaVersion: 1, pricingJson: JSON.stringify(defaultPricing[categoryKey], null, 2), ...defaultRegionPolicy(categoryKey) });
    }
  }, [config.data, config.loading, form, serviceName]);
  const save = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const pricingConfig = JSON.parse(String(values.pricingJson)) as PricingConfig;
      pricingConfig.regionPolicy = { defaultRegionId: values.defaultRegionId as OfficialRegionId, otherMode: values.otherMode as OtherRegionMode, referenceRegionId: values.referenceRegionId as OfficialRegionId, otherMessage: String(values.otherMessage) };
      await request(`/quotation/service-items/${serviceId}/storefront`, { method: 'PUT', body: { ...values, pricingConfig, pricingJson: undefined, featuresText: undefined, defaultRegionId: undefined, otherMode: undefined, referenceRegionId: undefined, otherMessage: undefined, features: String(values.featuresText || '').split('\n').map(value => value.trim()).filter(Boolean) } });
      message.success('Đã lưu nội dung và cấu hình giá'); await config.load(); onChanged?.();
    } catch (reason) { message.error(reason instanceof SyntaxError ? 'Cấu hình giá nâng cao không phải JSON hợp lệ' : reason instanceof Error ? reason.message : 'Không thể lưu cấu hình'); }
    finally { setSaving(false); }
  };
  const openPackage = (item?: PackageRow) => { setEditingPackage(item || null); packageForm.setFieldsValue(item || { durationMinutes: 120, price: 0, sortOrder: config.data?.packages.length || 0, enabled: true, isFeatured: false }); setPackageOpen(true); };
  const savePackage = async (values: Record<string, unknown>) => { try { await request(`/quotation/service-items/${serviceId}/packages${editingPackage ? `/${editingPackage.id}` : ''}`, { method: editingPackage ? 'PATCH' : 'POST', body: values }); message.success('Đã lưu gói giá'); setPackageOpen(false); await config.load(); onChanged?.(); } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Không thể lưu gói giá'); } };
  if (config.loading) return <div className="modal-loading"><Spin/></div>;
  return <div className="pricing-content-layout">{config.error && <Alert type="error" showIcon message={config.error}/>}<Form form={form} layout="vertical" disabled={!isAdmin} onFinish={save} onValuesChange={(changed) => { if (changed.categoryKey) { const categoryKey = String(changed.categoryKey); form.setFieldsValue({ pricingJson: JSON.stringify(defaultPricing[categoryKey], null, 2), ...defaultRegionPolicy(categoryKey) }); } }}>
    <section className="service-tab-section"><div className="service-detail-heading"><div><h3>Nội dung hiển thị</h3><p>Thông tin khách hàng nhìn thấy khi chọn dịch vụ.</p></div></div><div className="form-pair"><Form.Item name="categoryKey" label="Nhóm hiển thị" rules={[{ required: true }]}><Select options={[{ value: 'photobooth', label: 'Photobooth' }, { value: 'experience', label: 'Experience Booth' }, { value: 'booth360', label: 'Booth 360' }, { value: 'glambot', label: 'Glambot' }]}/></Form.Item><Form.Item name="slug" label="Slug" rules={[{ required: true }, { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Chỉ dùng chữ thường, số và dấu gạch ngang' }]}><Input/></Form.Item></div><div className="form-pair"><Form.Item name="publicName" label="Tên public" rules={[{ required: true }]}><Input/></Form.Item><Form.Item name="kicker" label="Kicker"><Input/></Form.Item></div><Form.Item name="shortDescription" label="Mô tả ngắn" rules={[{ required: true }]}><Input.TextArea rows={2}/></Form.Item><div className="form-pair"><Form.Item name="heroTitle" label="Hero title"><Input/></Form.Item><Form.Item name="heroAccent" label="Hero accent"><Input/></Form.Item></div><Form.Item name="featuresText" label="Điểm nổi bật (mỗi dòng một mục)"><Input.TextArea rows={4}/></Form.Item><Form.Item name="detail" label="Chi tiết"><Input.TextArea rows={3}/></Form.Item><div className="form-pair"><Form.Item name="sortOrder" label="Thứ tự"><InputNumber min={0} style={{ width: '100%' }}/></Form.Item><Form.Item name="schemaVersion" label="Schema version"><InputNumber min={1} style={{ width: '100%' }}/></Form.Item></div></section>
    <Card className="region-policy-card" title="Khu vực áp dụng giá" size="small"><Typography.Paragraph type="secondary">Ba khu vực có giá chính thức. Khu vực khác có thể dùng giá tham khảo hoặc yêu cầu liên hệ.</Typography.Paragraph><div className="official-region-grid">{officialRegions.map(region => <div className="official-region" key={region.id}><span>{region.label}</span><Tag color="green">Giá chính thức</Tag></div>)}</div><div className="form-pair region-policy-fields"><Form.Item name="defaultRegionId" label="Khu vực mặc định" rules={[{ required: true }]}><Select options={officialRegions.map(region => ({ value: region.id, label: region.label }))}/></Form.Item><Form.Item name="otherMode" label="Khu vực khác" rules={[{ required: true }]}><Radio.Group optionType="button" buttonStyle="solid" options={[{ value: 'REFERENCE', label: 'Giá tham khảo' }, { value: 'CONTACT_ONLY', label: 'Chỉ liên hệ' }]}/></Form.Item></div><Form.Item noStyle shouldUpdate={(before, after) => before.otherMode !== after.otherMode}>{({ getFieldValue }) => getFieldValue('otherMode') === 'REFERENCE' ? <Form.Item name="referenceRegionId" label="Lấy giá tham khảo từ" rules={[{ required: true }]}><Select options={officialRegions.map(region => ({ value: region.id, label: region.label }))}/></Form.Item> : null}</Form.Item><Form.Item name="otherMessage" label="Thông báo cho khu vực khác" rules={[{ required: true }, { max: 500 }]}><Input.TextArea rows={3} showCount maxLength={500}/></Form.Item></Card>
    <Form.Item name="pricingJson" label="Cấu hình giá nâng cao (JSON)" extra="Chính sách khu vực được ghép tự động khi lưu." rules={[{ required: true }]}><Input.TextArea rows={14} style={{ fontFamily: 'monospace' }}/></Form.Item>{isAdmin && <Button type="primary" htmlType="submit" icon={<SaveOutlined/>} loading={saving}>Lưu nội dung & giá</Button>}
  </Form>
  <section className="service-tab-section package-section"><div className="service-detail-heading"><div><h3>Gói giá</h3><p>Các lựa chọn thời lượng và giá bán của dịch vụ.</p></div>{isAdmin && <Button type="primary" icon={<PlusOutlined/>} onClick={() => openPackage()}>Thêm gói</Button>}</div><Table rowKey="id" dataSource={config.data?.packages || []} pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có gói giá"/> }} columns={[{ title: 'Code', dataIndex: 'code' }, { title: 'Tên gói', dataIndex: 'label' }, { title: 'Thời lượng', dataIndex: 'durationMinutes', render: value => value ? `${value} phút` : '—' }, { title: 'Giá', dataIndex: 'price', render: vnd }, { title: 'Trạng thái', render: (_, row) => <Space>{row.isFeatured && <Tag color="red">Nổi bật</Tag>}<Tag color={row.enabled ? 'green' : 'default'}>{row.enabled ? 'Đang bán' : 'Tạm ẩn'}</Tag></Space> }, { title: '', render: (_, row) => isAdmin && <Space><Button type="text" icon={<EditOutlined/>} onClick={() => openPackage(row)}/><Popconfirm title="Xóa gói này?" onConfirm={async () => { await request(`/quotation/service-items/${serviceId}/packages/${row.id}`, { method: 'DELETE' }); await config.load(); onChanged?.(); }}><Button type="text" danger icon={<DeleteOutlined/>}/></Popconfirm></Space> }]}/></section>
  <Modal title={editingPackage ? 'Sửa gói giá' : 'Thêm gói giá'} open={packageOpen} onCancel={() => setPackageOpen(false)} onOk={() => packageForm.submit()} destroyOnHidden><Form form={packageForm} layout="vertical" onFinish={savePackage}><div className="form-pair"><Form.Item name="code" label="Code" rules={[{ required: true }, { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ }]}><Input disabled={!!editingPackage}/></Form.Item><Form.Item name="label" label="Tên gói" rules={[{ required: true }]}><Input/></Form.Item></div><div className="form-pair"><Form.Item name="durationMinutes" label="Thời lượng (phút)"><InputNumber min={1} style={{ width: '100%' }}/></Form.Item><Form.Item name="price" label="Giá bán" rules={[{ required: true }]}><InputNumber min={0} step={100000} style={{ width: '100%' }}/></Form.Item></div><div className="form-pair"><Form.Item name="sortOrder" label="Thứ tự"><InputNumber min={0} style={{ width: '100%' }}/></Form.Item><Space><Form.Item name="isFeatured" valuePropName="checked"><Checkbox>Nổi bật</Checkbox></Form.Item><Form.Item name="enabled" valuePropName="checked"><Checkbox>Đang bán</Checkbox></Form.Item></Space></div></Form></Modal>
  </div>;
}

export function DiscountCodesPanel() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<DiscountCodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCodeRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const isAdmin = getSession()?.user.role === 'ADMIN';
  const load = useCallback(async () => { setLoading(true); try { setRows((await request<DiscountCodeRow[]>('/quotation/discount-codes')).data); } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Không tải được mã giảm giá'); } finally { setLoading(false); } }, [message]);
  useEffect(() => { void load(); }, [load]);
  const edit = (row?: DiscountCodeRow) => {
    setEditing(row || null);
    form.setFieldsValue(row ? { ...row, validity: row.startsAt || row.endsAt ? [row.startsAt ? dayjs(row.startsAt) : null, row.endsAt ? dayjs(row.endsAt) : null] : undefined } : { type: 'PERCENT', value: 10, minimumSubtotal: 0, enabled: true });
    setOpen(true);
  };
  const save = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const validity = values.validity as [Dayjs | null, Dayjs | null] | undefined;
      const body = { ...values, validity: undefined, startsAt: validity?.[0]?.toISOString() || null, endsAt: validity?.[1]?.toISOString() || null, maxDiscount: values.maxDiscount || null, usageLimit: values.usageLimit || null };
      await request(`/quotation/discount-codes${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body });
      message.success(editing ? 'Đã cập nhật mã giảm giá' : 'Đã tạo mã giảm giá'); setOpen(false); form.resetFields(); await load();
    } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Không thể lưu mã giảm giá'); }
    finally { setSaving(false); }
  };
  const toggle = async (row: DiscountCodeRow) => { try { await request(`/quotation/discount-codes/${row.id}`, { method: 'PATCH', body: { enabled: !row.enabled } }); message.success(row.enabled ? 'Đã tạm dừng mã' : 'Đã kích hoạt mã'); await load(); } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Không thể đổi trạng thái'); } };
  return <>
    <Card className="discount-admin-card" title={`Mã giảm giá (${rows.length})`} extra={<Space><Button icon={<ReloadOutlined/>} onClick={() => void load()}>Làm mới</Button>{isAdmin && <Button type="primary" icon={<PlusOutlined/>} onClick={() => edit()}>Tạo mã</Button>}</Space>}>
      <Table rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 1040 }} pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có mã giảm giá"/> }} columns={[
        { title: 'Mã', dataIndex: 'code', width: 150, render: (value: string) => <Tag color="red">{value}</Tag> },
        { title: 'Tên chương trình', dataIndex: 'name', width: 190 },
        { title: 'Mức giảm', width: 145, render: (_: unknown, row: DiscountCodeRow) => <strong>{row.type === 'PERCENT' ? `${row.value}%` : vnd(row.value)}</strong> },
        { title: 'Đơn tối thiểu', dataIndex: 'minimumSubtotal', width: 145, render: vnd },
        { title: 'Thời gian', width: 210, render: (_: unknown, row: DiscountCodeRow) => row.startsAt || row.endsAt ? `${row.startsAt ? dayjs(row.startsAt).format('DD/MM/YYYY') : 'Bây giờ'} — ${row.endsAt ? dayjs(row.endsAt).format('DD/MM/YYYY') : 'Không giới hạn'}` : 'Không giới hạn' },
        { title: 'Lượt dùng', width: 120, render: (_: unknown, row: DiscountCodeRow) => `${row.usageCount}${row.usageLimit ? ` / ${row.usageLimit}` : ''}` },
        { title: 'Trạng thái', width: 125, render: (_: unknown, row: DiscountCodeRow) => <Tag color={row.enabled ? 'green' : 'default'}>{row.enabled ? 'Đang bật' : 'Tạm dừng'}</Tag> },
        { title: '', fixed: 'right' as const, width: 150, render: (_: unknown, row: DiscountCodeRow) => isAdmin && <Space size={4}><Button type="text" icon={<EditOutlined/>} onClick={() => edit(row)}>Sửa</Button><Popconfirm title={row.enabled ? 'Tạm dừng mã này?' : 'Kích hoạt mã này?'} onConfirm={() => void toggle(row)}><Button type="text">{row.enabled ? 'Tắt' : 'Bật'}</Button></Popconfirm></Space> },
      ]}/>
    </Card>
    <Modal title={editing ? `Sửa mã ${editing.code}` : 'Tạo mã giảm giá'} open={open} onCancel={() => { setOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="Lưu mã" cancelText="Hủy" confirmLoading={saving} width={720} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save}>
        <div className="form-pair"><Form.Item name="code" label="Mã giảm giá" normalize={(value) => normalizeDiscountCode(String(value || ''))} extra="Tự động viết hoa, bỏ dấu và khoảng trắng." rules={[{ required: true }, { pattern: /^[A-Z0-9_-]+$/, message: 'Chỉ dùng chữ, số, _ hoặc -' }]}><Input disabled={!!editing} maxLength={40} style={{ textTransform: 'uppercase' }}/></Form.Item><Form.Item name="name" label="Tên chương trình" rules={[{ required: true }]}><Input maxLength={120}/></Form.Item></div>
        <div className="form-pair"><Form.Item name="type" label="Loại giảm" rules={[{ required: true }]}><Select options={[{ value: 'PERCENT', label: 'Giảm theo phần trăm' }, { value: 'FIXED', label: 'Giảm số tiền trực tiếp' }]}/></Form.Item><Form.Item noStyle shouldUpdate={(before, after) => before.type !== after.type}>{({ getFieldValue }) => <Form.Item name="value" label={getFieldValue('type') === 'PERCENT' ? 'Phần trăm giảm' : 'Số tiền giảm'} rules={[{ required: true }]}><InputNumber min={1} max={getFieldValue('type') === 'PERCENT' ? 100 : undefined} step={getFieldValue('type') === 'PERCENT' ? 1 : 100000} addonAfter={getFieldValue('type') === 'PERCENT' ? '%' : 'đ'} style={{ width: '100%' }}/></Form.Item>}</Form.Item></div>
        <div className="form-pair"><Form.Item name="minimumSubtotal" label="Tổng tối thiểu"><InputNumber min={0} step={100000} addonAfter="đ" style={{ width: '100%' }}/></Form.Item><Form.Item name="maxDiscount" label="Giảm tối đa (không bắt buộc)"><InputNumber min={0} step={100000} addonAfter="đ" style={{ width: '100%' }}/></Form.Item></div>
        <div className="form-pair"><Form.Item name="validity" label="Thời gian áp dụng"><DatePicker.RangePicker showTime style={{ width: '100%' }}/></Form.Item><Form.Item name="usageLimit" label="Giới hạn lượt dùng"><InputNumber min={1} style={{ width: '100%' }} placeholder="Không giới hạn"/></Form.Item></div>
        <Form.Item name="enabled" valuePropName="checked"><Checkbox>Kích hoạt ngay</Checkbox></Form.Item>
      </Form>
    </Modal>
  </>;
}

export function QuotationRequestsPanel() {
  const { message } = App.useApp();
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestDetail, setRequestDetail] = useState<QuoteRequest | null>(null);
  const [scheduleRequest, setScheduleRequest] = useState<QuoteRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [scheduleForm] = Form.useForm<{ period: [Dayjs, Dayjs] }>();
  const isAdmin = getSession()?.user.role === 'ADMIN';
  const load = useCallback(async () => { setLoading(true); try { setRequests((await request<QuoteRequest[]>('/quotation/requests?page=1&pageSize=100')).data); refreshQuotationNotifications(); } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Không tải được yêu cầu báo giá'); } finally { setLoading(false); } }, [message]);
  useEffect(() => { void load(); }, [load]);
  const updateStatus = async (item: QuoteRequest, status: string) => { try { await request(`/quotation/requests/${item.id}/status`, { method: 'PATCH', body: { status } }); message.success('Đã cập nhật trạng thái'); await load(); } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Không thể cập nhật'); } };
  const openSchedule = (item: QuoteRequest) => {
    const date = item.eventDate ? dayjs(item.eventDate).format('YYYY-MM-DD') : dayjs().add(1, 'day').format('YYYY-MM-DD');
    const start = dayjs(`${date}T${item.eventTime || '09:00'}`);
    const hours = Number(item.quoteSnapshot.selection?.hours) || 2;
    scheduleForm.setFieldsValue({ period: [start, start.add(hours, 'hour')] });
    setScheduleRequest(item);
  };
  const confirmSchedule = async ({ period }: { period: [Dayjs, Dayjs] }) => {
    if (!scheduleRequest) return;
    setConfirming(true);
    try {
      await request(`/quotation/requests/${scheduleRequest.id}/confirm`, { method: 'POST', body: { startAt: period[0].toISOString(), endAt: period[1].toISOString() } });
      message.success(`Đã chốt lịch cho yêu cầu ${scheduleRequest.code}`);
      setScheduleRequest(null); setRequestDetail(null); scheduleForm.resetFields(); await load();
    } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Không thể chốt lịch'); }
    finally { setConfirming(false); }
  };
  const priceTag = (status?: QuoteSnapshot['priceStatus']) => status === 'REFERENCE' ? <Tag color="blue">Giá tham khảo</Tag> : status === 'CONTACT_ONLY' ? <Tag color="orange">Cần xác nhận giá</Tag> : <Tag color="green">Giá chính thức</Tag>;
  const selectionItems = (snapshot: QuoteSnapshot) => {
    const selection = snapshot.selection || {};
    const labels: Record<string, string> = { packageCode: 'Gói dịch vụ', hours: 'Thời lượng', distanceKm: 'Quãng đường', printQuantity: 'Số ảnh in', guideCount: 'Nhân sự hướng dẫn', guideHours: 'Giờ hướng dẫn', regionName: 'Khu vực' };
    return Object.entries(selection).filter(([key, value]) => labels[key] && value !== undefined && value !== null && value !== '').map(([key, value]) => ({ key, label: labels[key], children: key === 'hours' || key === 'guideHours' ? `${value} giờ` : key === 'distanceKm' ? `${value} km` : String(value) }));
  };
  const statusSelect = (row: QuoteRequest, mobile = false) => <Select aria-label={`Trạng thái yêu cầu ${row.code}`} value={row.status} disabled={!!row.eventId} className={mobile ? 'quotation-mobile-status' : undefined} style={mobile ? undefined : { width: 175 }} options={quotationStatusOptions.map(option => ({ ...option, disabled: option.value === 'CONFIRMED' && row.status !== 'CONTACTED' && !row.eventId }))} onChange={value => { if (value === 'CONFIRMED' && !row.eventId) openSchedule(row); else void updateStatus(row, value); }}/>;
  return <>
    <Card className="quotation-requests-card" title={`Yêu cầu báo giá (${requests.length})`} extra={<Button icon={<ReloadOutlined/>} onClick={() => void load()}>Làm mới</Button>}>
      <div className="quotation-desktop-table"><Table rowKey="id" loading={loading} dataSource={requests} tableLayout="fixed" scroll={{ x: 1180 }} columns={[{ title: 'Mã', dataIndex: 'code', width: 90 }, { title: 'Khách hàng', width: 160, render: (_, row) => <><strong>{row.customerName}</strong><br/><Typography.Text type="secondary">{row.phone}</Typography.Text></> }, { title: 'Dịch vụ', width: 120, ellipsis: true, render: (_, row) => row.quoteSnapshot?.serviceName || '—' }, { title: 'Địa điểm', dataIndex: 'venue', width: 250, ellipsis: true }, { title: 'Loại giá', width: 135, render: (_, row) => priceTag(row.quoteSnapshot?.priceStatus) }, { title: 'Tổng dự kiến', width: 150, render: (_, row) => row.quoteSnapshot?.total == null ? <Typography.Text type="warning">Liên hệ báo giá</Typography.Text> : vnd(row.quoteSnapshot.total) }, { title: 'Trạng thái', width: 175, render: (_, row) => statusSelect(row) }, { title: '', fixed: 'right', width: 60, render: (_, row) => <Button type="text" aria-label={`Review yêu cầu ${row.code}`} icon={<EyeOutlined/>} onClick={() => setRequestDetail(row)}/> }]}/></div>
      <div className="quotation-mobile-list" aria-label="Danh sách yêu cầu báo giá">{loading ? <div className="quotation-mobile-loading"><Spin/><span>Đang tải yêu cầu…</span></div> : requests.length ? requests.map(row => <article className="quotation-mobile-card" key={row.id}><div className="quotation-mobile-card-main"><div className="quotation-mobile-card-head"><strong>{row.code}</strong>{priceTag(row.quoteSnapshot?.priceStatus)}</div><h3>{row.customerName}</h3><a href={`tel:${row.phone}`}>{row.phone}</a><dl><div><dt>Dịch vụ</dt><dd>{row.quoteSnapshot?.serviceName || '—'}</dd></div><div><dt>Địa điểm</dt><dd>{row.venue}</dd></div><div><dt>Tổng dự kiến</dt><dd>{row.quoteSnapshot?.total == null ? 'Liên hệ báo giá' : vnd(row.quoteSnapshot.total)}</dd></div></dl></div><div className="quotation-mobile-card-actions">{statusSelect(row, true)}<Button icon={<EyeOutlined/>} onClick={() => setRequestDetail(row)}>Review</Button></div></article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có yêu cầu báo giá"/>}</div>
    </Card>
    <Modal className="quotation-review-modal" width={900} title={null} open={!!requestDetail} onCancel={() => setRequestDetail(null)} footer={requestDetail ? <div className="quotation-review-actions"><Button onClick={() => setRequestDetail(null)}>Đóng</Button>{isAdmin && !requestDetail.eventId && requestDetail.status === 'CONTACTED' && <Button type="primary" icon={<CalendarOutlined/>} onClick={() => openSchedule(requestDetail)}>Xác nhận & khóa lịch</Button>}{requestDetail.eventId && <Button disabled icon={<CheckCircleOutlined/>}>Đã khóa lịch</Button>}</div> : null}>
      {requestDetail && <div className="quotation-review">
        <header className="quotation-review-header"><div><span>YÊU CẦU BÁO GIÁ</span><h2>{requestDetail.code}</h2><Typography.Text type="secondary">Gửi lúc {dayjs(requestDetail.createdAt).format('DD/MM/YYYY HH:mm')}</Typography.Text></div><Space wrap>{priceTag(requestDetail.quoteSnapshot.priceStatus)}<Tag color={statusColors[requestDetail.status]}>{quotationStatusLabels[requestDetail.status] || requestDetail.status}</Tag></Space></header>
        <section className="quotation-review-section"><h3>Khách hàng</h3><Descriptions column={{ xs: 1, sm: 2 }} items={[{ key: 'name', label: 'Họ tên', children: <strong>{requestDetail.customerName}</strong> }, { key: 'phone', label: 'Điện thoại', children: <Typography.Link href={`tel:${requestDetail.phone}`}>{requestDetail.phone}</Typography.Link> }, { key: 'email', label: 'Email', children: requestDetail.email ? <Typography.Link href={`mailto:${requestDetail.email}`}>{requestDetail.email}</Typography.Link> : '—' }]}/></section>
        <section className="quotation-review-section"><h3>Thông tin sự kiện</h3><Descriptions column={{ xs: 1, sm: 2 }} items={[{ key: 'service', label: 'Dịch vụ', children: <strong>{requestDetail.quoteSnapshot.serviceName || '—'}</strong> }, { key: 'date', label: 'Ngày dự kiến', children: requestDetail.eventDate ? dayjs(requestDetail.eventDate).format('DD/MM/YYYY') : 'Chưa xác định' }, { key: 'time', label: 'Giờ dự kiến', children: requestDetail.eventTime || 'Chưa xác định' }, { key: 'venue', label: 'Địa điểm', span: 2, children: requestDetail.venue }, ...selectionItems(requestDetail.quoteSnapshot)]}/></section>
        <section className="quotation-review-section quotation-price-section"><div className="quotation-section-title"><h3>Chi tiết báo giá</h3>{priceTag(requestDetail.quoteSnapshot.priceStatus)}</div><div className="quotation-items-table"><Table size="small" rowKey="id" pagination={false} tableLayout="fixed" dataSource={requestDetail.quoteSnapshot.items || []} locale={{ emptyText: requestDetail.quoteSnapshot.priceStatus === 'CONTACT_ONLY' ? 'Báo giá sẽ được xác nhận khi liên hệ khách hàng' : 'Chưa có hạng mục' }} columns={[{ title: 'Hạng mục', dataIndex: 'label' }, { title: 'Thành tiền', dataIndex: 'amount', width: 180, align: 'right', render: vnd }]}/></div><div className="quotation-items-mobile">{requestDetail.quoteSnapshot.items?.length ? requestDetail.quoteSnapshot.items.map(item => <div key={item.id}><span>{item.label}</span><strong>{vnd(item.amount)}</strong></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={requestDetail.quoteSnapshot.priceStatus === 'CONTACT_ONLY' ? 'Báo giá sẽ được xác nhận khi liên hệ' : 'Chưa có hạng mục'}/>}</div>{requestDetail.quoteSnapshot.discount && <div className="quotation-discount-row"><span><Tag color="green">{requestDetail.quoteSnapshot.discount.code}</Tag>{requestDetail.quoteSnapshot.discount.name}</span><strong>-{vnd(requestDetail.quoteSnapshot.discount.amount)}</strong></div>}<div className="quotation-total"><span>Tổng dự kiến{requestDetail.quoteSnapshot.discount && <small>Tạm tính trước ưu đãi: {vnd(requestDetail.quoteSnapshot.subtotal)}</small>}<small>{requestDetail.quoteSnapshot.priceMessage || 'Chưa bao gồm các chi phí phát sinh được hai bên xác nhận.'}</small></span><strong>{requestDetail.quoteSnapshot.total == null ? 'Liên hệ báo giá' : vnd(requestDetail.quoteSnapshot.total)}</strong></div></section>
        {requestDetail.notes && <section className="quotation-review-section"><h3>Ghi chú của khách hàng</h3><p className="quotation-customer-note">{requestDetail.notes}</p></section>}
        {requestDetail.eventId && <Alert type="success" showIcon message="Yêu cầu đã được chốt lịch" description="Sự kiện đã được tạo trong hệ thống và sẵn sàng để phân công nhân sự."/>}
      </div>}
    </Modal>
    <Modal className="quotation-schedule-modal" title={`Xác nhận & khóa lịch — ${scheduleRequest?.code || ''}`} open={!!scheduleRequest} onCancel={() => { setScheduleRequest(null); scheduleForm.resetFields(); }} onOk={() => scheduleForm.submit()} okText="Xác nhận & khóa lịch" cancelText="Hủy" confirmLoading={confirming} destroyOnHidden>
      <Alert type="info" showIcon message="Sự kiện sẽ được tạo ở trạng thái Đã duyệt" description="Sau khi chốt, yêu cầu báo giá chuyển sang Đã xác nhận và không thể tạo lịch lần hai."/>
      <Form form={scheduleForm} layout="vertical" onFinish={confirmSchedule} className="quotation-schedule-form"><Form.Item name="period" label="Thời gian diễn ra" rules={[{ required: true, message: 'Chọn thời gian bắt đầu và kết thúc' }]}><DatePicker.RangePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" minuteStep={15} style={{ width: '100%' }}/></Form.Item><Descriptions size="small" column={1} items={[{ key: 'customer', label: 'Khách hàng', children: scheduleRequest?.customerName }, { key: 'service', label: 'Dịch vụ', children: scheduleRequest?.quoteSnapshot.serviceName }, { key: 'venue', label: 'Địa điểm', children: scheduleRequest?.venue }]}/></Form>
    </Modal>
  </>;
}
