import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tabs,
  Tooltip,
  Upload,
} from "antd";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  InboxOutlined,
  KeyOutlined,
  LinkOutlined,
  ArrowLeftOutlined,
  FileImageOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { getSession, logout, query, request } from "./api";
import { EventCalendar } from "./event-calendar";
import { Office25DScene, Outdoor25DScene, type OfficeEventGroup, type OfficeMember, type OfficeRoom } from "./office-25d";
import { permissionGroups } from "./permissions";

type Row = Record<string, any>;
const date = (v?: string) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—");
const statuses: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  PENDING: "Chờ duyệt",
  INACTIVE: "Ngừng hoạt động",
  LOCKED: "Đã khóa",
  SUSPENDED: "Tạm ngưng",
  DRAFT: "Bản nháp",
  APPROVED: "Đã duyệt",
  IN_PROGRESS: "Đang diễn ra",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  REJECTED: "Từ chối",
  LARK: "Lark",
  MANUAL: "Thủ công",
  ADMIN: "Admin",
  MANAGER: "Quản lý",
  EMPLOYEE: "Nhân viên",
  DAILY: "Hàng ngày",
  EVENT: "Sự kiện",
};
const colors: Record<string, string> = {
  ACTIVE: "success",
  APPROVED: "success",
  COMPLETED: "success",
  PENDING: "warning",
  IN_PROGRESS: "processing",
  LOCKED: "error",
  CANCELLED: "error",
  REJECTED: "error",
};
const status = (v?: string) =>
  v ? (
    <Tag color={colors[v] || "default"} className="status-tag">
      {statuses[v] || v}
    </Tag>
  ) : (
    "—"
  );
function useData<T>(path: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<any>();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await request<T>(path);
      setData(r.data);
      setMeta(r.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, loading, error, meta, load };
}

type OfficeEmployee = OfficeMember;
type OfficeDepartment = { id: string; name: string; description?: string | null; employees: OfficeEmployee[] };
type OfficeOverview = { today: string; departments: OfficeDepartment[] };
type OfficePresence = "WORKING" | "EVENT" | "OFFLINE";
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
const officePresence = (member: OfficeEmployee): OfficePresence => member.attendance?.type === "EVENT" ? "EVENT" : member.attendance && !member.attendance.checkOutAt ? "WORKING" : "OFFLINE";
const officePresenceLabel: Record<OfficePresence, string> = { WORKING: "Đang làm việc", EVENT: "Đi sự kiện", OFFLINE: "Chưa check-in" };
const officePresenceColor: Record<OfficePresence, string> = { WORKING: "success", EVENT: "warning", OFFLINE: "default" };
const elapsedWorkTime = (checkInAt?: string) => { if (!checkInAt) return "—"; const minutes = Math.max(0, dayjs().diff(dayjs(checkInAt), "minute")); return `${Math.floor(minutes / 60)}g ${minutes % 60}p`; };

export function OfficePage() {
  const office = useData<OfficeOverview>('/employees/office/overview', { today: '', departments: [] });
  const [selected, setSelected] = useState<{ member: OfficeMember; department: OfficeRoom }>();
  const [officeView, setOfficeView] = useState<"OFFICE" | "OUTDOOR" | "LIST">("OFFICE");
  const [officeSearch, setOfficeSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>();
  const [presence, setPresence] = useState<OfficePresence | "ALL">("ALL");
  const departments = useMemo(() => {
    const assignedEmployeeIds = new Set<string>();
    return office.data.departments.map((department) => ({ ...department, employees: department.employees.filter((employee) => {
      if (assignedEmployeeIds.has(employee.id)) return false;
      assignedEmployeeIds.add(employee.id);
      return true;
    }) }));
  }, [office.data.departments]);
  const allMembers = useMemo(() => departments.flatMap((department) => department.employees.map((member) => ({ member, department }))), [departments]);
  const matchesFilters = useCallback((member: OfficeMember, department: OfficeRoom) => (!departmentId || department.id === departmentId) && (!officeSearch.trim() || member.displayName.toLocaleLowerCase("vi").includes(officeSearch.trim().toLocaleLowerCase("vi"))), [departmentId, officeSearch]);
  const visibleMembers = useMemo(() => allMembers.filter(({ member, department }) => matchesFilters(member, department) && (presence === "ALL" || officePresence(member) === presence)), [allMembers, matchesFilters, presence]);
  const officeDepartments = useMemo(() => departments.filter((department) => !departmentId || department.id === departmentId).map((department) => ({ ...department, employees: department.employees.filter((member) => matchesFilters(member, department) && officePresence(member) !== "EVENT" && (presence === "ALL" || officePresence(member) === presence)) })), [departments, departmentId, matchesFilters, presence]);
  const eventGroups = useMemo<OfficeEventGroup[]>(() => {
    const groups = new Map<string, OfficeEventGroup>();
    for (const { member, department } of allMembers) {
      if (!matchesFilters(member, department) || officePresence(member) !== "EVENT") continue;
      const event = member.attendance?.event;
      const id = event?.id ?? "event-unknown";
      const group = groups.get(id) ?? { id, name: event?.name ?? "Sự kiện đang diễn ra", location: event?.location, members: [] };
      group.members.push({ member, room: department }); groups.set(id, group);
    }
    return [...groups.values()];
  }, [allMembers, matchesFilters]);
  const activeCount = allMembers.filter(({ member }) => officePresence(member) === "WORKING").length;
  const eventCount = allMembers.filter(({ member }) => officePresence(member) === "EVENT").length;
  const uniqueCount = departments.reduce((total, department) => total + department.employees.length, 0);
  const selectMember = useCallback((member: OfficeMember, department: OfficeRoom) => setSelected({ member, department }), []);
  const changePresence = useCallback((value: OfficePresence | "ALL") => { setPresence(value); if (value === "EVENT") setOfficeView("OUTDOOR"); else if (value !== "ALL") setOfficeView("OFFICE"); }, []);
  return <>
    <Heading eyebrow="KHÔNG GIAN LÀM VIỆC" title="Văn phòng TRED" subtitle="Theo dõi vị trí phòng ban và trạng thái làm việc hôm nay." extra={<Button icon={<ReloadOutlined/>} onClick={() => void office.load()} loading={office.loading}>Làm mới</Button>}/>
    {office.error ? <Card className="office-error">Không thể tải văn phòng: {office.error}</Card> : <Card className="office-card" bordered={false}>
      <div className="office-topline"><div><span className="office-logo">T</span><div><strong>TRED OFFICE</strong><small>Cập nhật trạng thái làm việc hôm nay</small></div></div><Segmented value={officeView} onChange={(value) => setOfficeView(value as "OFFICE" | "OUTDOOR" | "LIST")} options={[{ value: "OFFICE", label: "Văn phòng" }, { value: "OUTDOOR", label: "Ngoài trời" }, { value: "LIST", label: "Danh sách" }]}/></div>
      <div className="office-kpis"><button onClick={() => changePresence("WORKING")}><span className="office-kpi-dot working"/><small>Đang làm việc</small><strong>{activeCount}</strong></button><button onClick={() => changePresence("EVENT")}><span className="office-kpi-dot event"/><small>Đi sự kiện</small><strong>{eventCount}</strong></button><button onClick={() => { setPresence("ALL"); setOfficeView("OFFICE"); }}><span className="office-kpi-dot total"/><small>Tổng nhân sự</small><strong>{uniqueCount}</strong></button></div>
      <div className="office-toolbar"><Input allowClear value={officeSearch} onChange={(event) => setOfficeSearch(event.target.value)} placeholder="Tìm tên nhân viên..."/><Select allowClear value={departmentId} onChange={setDepartmentId} placeholder="Tất cả phòng ban" options={departments.map((department) => ({ value: department.id, label: department.name }))}/><Select value={presence} onChange={changePresence} options={[{ value: "ALL", label: "Tất cả trạng thái" }, ...Object.entries(officePresenceLabel).map(([value, label]) => ({ value, label }))]}/></div>
      {officeView !== "LIST" ? <div className="office-three-wrap">{officeView === "OUTDOOR" ? <Outdoor25DScene events={eventGroups} onSelect={selectMember}/> : <Office25DScene departments={officeDepartments} onSelect={selectMember}/>} {selected && <aside className="office-member-card"><button aria-label="Đóng" onClick={() => setSelected(undefined)}>×</button><span className="office-member-avatar">{initials(selected.member.displayName)}</span><strong>{selected.member.displayName}</strong><small>{selected.member.employeeType.name} · {selected.department.name}</small><Tag color={officePresenceColor[officePresence(selected.member)]}>{officePresenceLabel[officePresence(selected.member)]}</Tag>{selected.member.attendance && <dl><div><dt>Check-in</dt><dd>{dayjs(selected.member.attendance.checkInAt).format("HH:mm")}</dd></div><div><dt>Thời gian</dt><dd>{elapsedWorkTime(selected.member.attendance.checkInAt)}</dd></div></dl>}{selected.member.attendance?.event && <p><strong>{selected.member.attendance.event.name}</strong>{selected.member.attendance.event.location && <small>⌖ {selected.member.attendance.event.location}</small>}</p>}</aside>}<div className="office-three-hint">Bấm nhân vật để xem chi tiết</div></div> : <div className="office-member-grid">{visibleMembers.map(({ member, department }) => <button key={member.id} className="office-member-tile" onClick={() => selectMember(member, department)}><Avatar src={member.avatarUrl}>{initials(member.displayName)}</Avatar><span><strong>{member.displayName}</strong><small>{member.employeeType.name} · {department.name}</small></span><Tag color={officePresenceColor[officePresence(member)]}>{officePresenceLabel[officePresence(member)]}</Tag><time>{member.attendance ? `${dayjs(member.attendance.checkInAt).format("HH:mm")} · ${elapsedWorkTime(member.attendance.checkInAt)}` : "Chưa có lượt làm việc"}</time></button>)}{!office.loading && !visibleMembers.length && <Empty description="Không có nhân viên phù hợp bộ lọc"/>}</div>}
      <Modal title="Chi tiết nhân sự" open={officeView === "LIST" && Boolean(selected)} onCancel={() => setSelected(undefined)} footer={<Button type="primary" onClick={() => setSelected(undefined)}>Đóng</Button>} destroyOnHidden>{selected && <div className="office-list-detail"><Avatar size={58} src={selected.member.avatarUrl}>{initials(selected.member.displayName)}</Avatar><div><h3>{selected.member.displayName}</h3><p>{selected.member.employeeType.name} · {selected.department.name}</p><Tag color={officePresenceColor[officePresence(selected.member)]}>{officePresenceLabel[officePresence(selected.member)]}</Tag></div>{selected.member.attendance && <dl><div><dt>Giờ check-in</dt><dd>{dayjs(selected.member.attendance.checkInAt).format("HH:mm")}</dd></div><div><dt>Thời gian làm việc</dt><dd>{elapsedWorkTime(selected.member.attendance.checkInAt)}</dd></div>{selected.member.attendance.event && <div><dt>Sự kiện</dt><dd>{selected.member.attendance.event.name}</dd></div>}</dl>}</div>}</Modal>
      <div className="office-legend"><span><i className="legend-working"/> Đang làm việc</span><span><i className="legend-event"/> Đi sự kiện</span><span><i className="legend-away"/> Chưa check-in</span><span><i className="legend-empty"/> Ghế trống</span><em>Mỗi nhân viên chỉ hiển thị tại một phòng ban chính.</em></div>
    </Card>}
  </>;
}
function Heading({
  eyebrow = "TỔNG QUAN",
  title,
  subtitle,
  extra,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          {eyebrow} <span>✳</span>
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="heading-actions">{extra}</div>
    </div>
  );
}
function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <div className="error-notice">Không thể tải dữ liệu: {error}</div>
  ) : null;
}
function Initial({ name }: { name?: string }) {
  return (
    <Avatar
      size={38}
      style={{ background: "#e5eee0", color: "#506c45", fontWeight: 700 }}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </Avatar>
  );
}
function Person({ name, sub }: { name?: string; sub?: string }) {
  return (
    <div className="person">
      <Initial name={name} />
      <div>
        <strong>{name || "—"}</strong>
        <small>{sub || "—"}</small>
      </div>
    </div>
  );
}
function Panel({
  title,
  description,
  children,
  extra,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
const empty = (
  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />
);
const tablePageSizeOptions = ["10", "20", "30"];
function GridTable({
  data,
  loading,
  columns,
  meta,
  onPage,
}: {
  data: Row[];
  loading: boolean;
  columns: any[];
  meta?: any;
  onPage?: (page: number, pageSize: number) => void;
}) {
  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={data}
      loading={loading}
      scroll={{ x: 680 }}
      locale={{ emptyText: empty }}
      pagination={
        meta
          ? {
              current: meta.page,
              pageSize: meta.pageSize,
              total: meta.total,
              showSizeChanger: true,
              pageSizeOptions: tablePageSizeOptions,
              onChange: onPage,
              hideOnSinglePage: true,
            }
          : { defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: tablePageSizeOptions, hideOnSinglePage: true }
      }
    />
  );
}
function useAction() {
  const { message } = App.useApp();
  return async (fn: () => Promise<any>, success = "Đã cập nhật thành công") => {
    try {
      await fn();
      message.success(success);
      return true;
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Có lỗi xảy ra");
      return false;
    }
  };
}

export function Dashboard() {
  const users = useData<Row[]>("/users?pageSize=5", []);
  const pending = useData<Row[]>("/users?status=PENDING&pageSize=1", []);
  const employees = useData<Row[]>("/employees?pageSize=1", []);
  const events = useData<Row[]>("/events?pageSize=5&sort=asc", []);
  const att = useData<Row[]>("/attendance?pageSize=1", []);
  const stats = [
    {
      label: "TÀI KHOẢN",
      value: users.meta?.total,
      icon: <UserOutlined />,
      color: "sage",
      note: "Tài khoản trong hệ thống",
    },
    {
      label: "NHÂN SỰ",
      value: employees.meta?.total,
      icon: <TeamOutlined />,
      color: "cream",
      note: "Hồ sơ nhân sự",
    },
    {
      label: "SỰ KIỆN",
      value: events.meta?.total,
      icon: <CalendarOutlined />,
      color: "blue",
      note: "Sự kiện trong hệ thống",
    },
    {
      label: "CHỜ DUYỆT",
      value: pending.meta?.total,
      icon: <UserAddOutlined />,
      color: "peach",
      note: "Tài khoản đăng ký mới",
    },
  ];
  return (
    <>
      <Heading
        eyebrow="TRED CREW / BẢNG ĐIỀU KHIỂN"
        title={`Xin chào, ${getSession()?.user.fullName?.split(" ").slice(-1)[0] || "Admin"} 👋`}
        subtitle="Đây là những gì đang diễn ra với đội ngũ của bạn."
        extra={
          <Link to="/events">
            <Button type="primary" icon={<PlusOutlined />}>
              Quản lý sự kiện
            </Button>
          </Link>
        }
      />
      <div className="welcome-banner">
        <div className="welcome-text">
          <span className="banner-kicker">CÙNG NHAU, MỌI VIỆC TỐT HƠN</span>
          <h2>
            Một đội ngũ.
            <br />
            <em>Vô vàn khoảnh khắc.</em>
          </h2>
          <p>
            Quản lý con người và sự kiện thật gọn gàng, để tập trung vào điều
            quan trọng nhất.
          </p>
          <Link to="/employees" className="banner-link">
            Khám phá đội ngũ <ArrowRightOutlined />
          </Link>
        </div>
        <div className="banner-art">
          <div className="banner-orbit orbit-one" />
          <div className="banner-orbit orbit-two" />
          <div className="banner-flower">✳</div>
          <div className="banner-chip">
            <span>✦</span>
            <div>
              <strong>Better together</strong>
              <small>TRED CREW COMMUNITY</small>
            </div>
          </div>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">NHÌN NHANH</span>
          <h2>Hoạt động của bạn</h2>
        </div>
        <span>
          DỮ LIỆU TRỰC TIẾP <i className="live-dot" />
        </span>
      </div>
      <div className="stat-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <div className={"stat-icon " + s.color}>{s.icon}</div>
            </div>
            <strong>{s.value ?? (i === 0 && users.loading ? "…" : "—")}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Sự kiện"
          description="Danh sách sự kiện trong hệ thống"
          extra={
            <Link className="text-link" to="/events">
              Xem tất cả <ArrowRightOutlined />
            </Link>
          }
        >
          <ErrorNotice error={events.error} />
          <div className="dashboard-list">
            {events.data.length ? (
              events.data.map((e: Row) => (
                <div className="event-line" key={e.id}>
                  <div className="date-box">
                    <strong>{dayjs(e.startAt).format("DD")}</strong>
                    <span>TH {dayjs(e.startAt).format("MM")}</span>
                  </div>
                  <div className="event-line-info">
                    <strong>{e.name}</strong>
                    <small>
                      {date(e.startAt)} · {e.location || "Chưa có địa điểm"}
                    </small>
                  </div>
                  {status(e.status)}
                </div>
              ))
            ) : (
              <div className="empty-inline">
                {events.loading ? (
                  <Spin />
                ) : (
                  <>
                    <CalendarOutlined />
                    <strong>Chưa có sự kiện nào</strong>
                    <span>Tạo sự kiện hoặc đồng bộ từ Lark để bắt đầu.</span>
                    <Link to="/lark">
                      Kết nối Lark <ArrowRightOutlined />
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </Panel>
        <Panel title="Cần chú ý" description="Những việc bạn có thể làm ngay">
          <div className="quick-list">
            <Link to="/users">
              <span className="quick-icon peach">
                <UserAddOutlined />
              </span>
              <span>
                <strong>Duyệt tài khoản</strong>
                <small>{pending.meta?.total ?? "—"} tài khoản đang chờ</small>
              </span>
              <ArrowRightOutlined />
            </Link>
            <Link to="/attendance">
              <span className="quick-icon blue">
                <ClockCircleOutlined />
              </span>
              <span>
                <strong>Xem chấm công</strong>
                <small>{att.meta?.total ?? "—"} lượt đã ghi nhận</small>
              </span>
              <ArrowRightOutlined />
            </Link>
            <Link to="/lark">
              <span className="quick-icon sage">
                <LinkOutlined />
              </span>
              <span>
                <strong>Kết nối Lark</strong>
                <small>Đồng bộ lịch sự kiện</small>
              </span>
              <ArrowRightOutlined />
            </Link>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function UsersPage() {
  const isAdmin = getSession()?.user.role === "ADMIN";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [resetting, setResetting] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const data = useData<Row[]>(
    `/users${query({ page, pageSize, search, status: filter })}`,
    [],
  );
  const act = useAction();
  const show = (r?: Row) => {
    setEditing(r || null);
    form.resetFields();
    if (r) form.setFieldsValue(r);
    setOpen(true);
  };
  const openReset = (r: Row) => {
    passwordForm.resetFields();
    setResetting(r);
  };
  const columns = [
    {
      title: "TÀI KHOẢN",
      render: (_: any, r: Row) => <Person name={r.fullName} sub={r.email} />,
    },
    {
      title: "TÊN ĐĂNG NHẬP",
      dataIndex: "username",
      render: (v: string) => v || "—",
    },
    { title: "VAI TRÒ", dataIndex: "role", render: status },
    { title: "QUYỀN XEM", dataIndex: "permissions", render: (value: string[], row: Row) => row.role === "ADMIN" ? <Tag color="green">Toàn quyền</Tag> : <span>{value?.length || 0} tab</span> },
    { title: "TRẠNG THÁI", dataIndex: "status", render: status },
    { title: "NGÀY TẠO", dataIndex: "createdAt", render: date },
    {
      title: "",
      render: (_: any, r: Row) => isAdmin ? (
        <Space>
          {r.status === "PENDING" && (
            <Button
              size="small"
              type="primary"
              onClick={() =>
                void act(async () => {
                  await request(`/users/${r.id}/approve`, { method: "POST" });
                  await data.load();
                }, "Đã duyệt tài khoản")
              }
            >
              Duyệt
            </Button>
          )}
          <Tooltip title="Chỉnh sửa">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => show(r)}
            />
          </Tooltip>
          <Tooltip title="Đặt lại mật khẩu">
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => openReset(r)}
            />
          </Tooltip>
          {r.status !== "PENDING" && (
            <Select
              size="small"
              style={{ width: 135 }}
              value={r.status}
              options={["ACTIVE", "INACTIVE", "LOCKED"].map((v) => ({
                value: v,
                label: statuses[v],
              }))}
              onChange={(v) =>
                void act(async () => {
                  await request(`/users/${r.id}/status`, {
                    method: "PATCH",
                    body: { status: v },
                  });
                  await data.load();
                })
              }
            />
          )}
        </Space>
      ) : null,
    },
  ];
  return (
    <>
      <Heading
        eyebrow="QUẢN LÝ / TÀI KHOẢN"
        title="Tài khoản"
        subtitle="Quản lý quyền truy cập và duyệt thành viên mới."
        extra={isAdmin ?
          <Button type="primary" icon={<PlusOutlined />} onClick={() => show()}>
            Thêm tài khoản
          </Button>
        : undefined}
      />
      <Panel
        title="Danh sách tài khoản"
        description={`${data.meta?.total ?? "—"} tài khoản trong hệ thống`}
      >
        <div className="table-tools">
          <Input.Search
            allowClear
            placeholder="Tìm theo tên, email..."
            onSearch={(v) => {
              setPage(1);
              setSearch(v);
            }}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="Tất cả trạng thái"
            style={{ width: 180 }}
            value={filter}
            onChange={(v) => {
              setPage(1);
              setFilter(v);
            }}
            options={["PENDING", "ACTIVE", "INACTIVE", "LOCKED"].map((v) => ({
              value: v,
              label: statuses[v],
            }))}
          />
        </div>
        <ErrorNotice error={data.error} />
        <GridTable
          data={data.data}
          loading={data.loading}
          columns={columns}
          meta={data.meta}
          onPage={(nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }}
        />
      </Panel>
      <Modal
        title={editing ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: "EMPLOYEE", permissions: [] }}
          onFinish={async (v) => {
            if (
              await act(async () => {
                await request(editing ? `/users/${editing.id}` : "/users", {
                  method: editing ? "PATCH" : "POST",
                  body: v,
                });
                await data.load();
              })
            )
              setOpen(false);
          }}
        >
          <Form.Item
            label="Họ và tên"
            name="fullName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Số điện thoại" name="phone">
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[{ required: true, min: 8 }]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item label="Vai trò" name="role" rules={[{ required: true }]}>
            <Select
              options={["ADMIN", "MANAGER", "EMPLOYEE"].map((v) => ({
                value: v,
                label: statuses[v],
              }))}
            />
          </Form.Item>
          <Form.Item label="Quyền xem trên trang quản lý" name="permissions">
            <Checkbox.Group style={{ width: "100%" }}>
              <div className="permission-groups">
                {permissionGroups.map((group) => <div className="permission-group" key={group.label}><strong>{group.label}</strong>{group.options.map((option) => <Checkbox key={option.value} value={option.value}>{option.label}</Checkbox>)}</div>)}
              </div>
            </Checkbox.Group>
          </Form.Item>
          <p className="modal-description">Tài khoản Admin luôn có toàn quyền. Các tài khoản khác chỉ thấy những tab được chọn.</p>
        </Form>
      </Modal>
      <Modal
        title={`Đặt lại mật khẩu${resetting ? `: ${resetting.fullName}` : ""}`}
        open={!!resetting}
        onCancel={() => setResetting(null)}
        onOk={() => passwordForm.submit()}
        okText="Đặt lại mật khẩu"
        cancelText="Hủy"
      >
        <p className="modal-description">
          Tất cả phiên đăng nhập hiện tại của người dùng này sẽ bị đăng xuất.
        </p>
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={async (v) => {
            if (
              await act(async () => {
                await request(`/users/${resetting!.id}/reset-password`, {
                  method: "POST",
                  body: { password: v.password },
                });
              }, "Đã đặt lại mật khẩu và đăng xuất mọi phiên")
            )
              setResetting(null);
          }}
        >
          <Form.Item
            label="Mật khẩu mới"
            name="password"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu mới" },
              { min: 8, message: "Mật khẩu cần tối thiểu 8 ký tự" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Nhập lại mật khẩu"
            name="confirmation"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Vui lòng nhập lại mật khẩu" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("password") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error("Mật khẩu nhập lại không khớp"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [typeForm] = Form.useForm();
  const [departmentForm] = Form.useForm();
  const selectedDepartmentIds = Form.useWatch("departmentIds", form) || [];
  const data = useData<Row[]>(
    `/employees${query({ page, pageSize, search })}`,
    [],
  );
  const types = useData<Row[]>("/employee-types", []);
  const departments = useData<Row[]>("/departments", []);
  const users = useData<Row[]>("/users?pageSize=100&status=ACTIVE", []);
  const act = useAction();
  const show = (r?: Row) => {
    setEditing(r || null);
    form.resetFields();
    if (r) form.setFieldsValue({ ...r, phone: r.user?.phone, departmentIds: r.departments?.map((item: Row) => item.department.id), primaryDepartmentId: r.primaryDepartmentId });
    setOpen(true);
  };
  const columns = [
    {
      title: "NHÂN SỰ",
      render: (_: any, r: Row) => (
        <Person name={r.displayName} sub={r.user?.email} />
      ),
    },
    {
      title: "LOẠI NHÂN SỰ",
      render: (_: any, r: Row) => r.employeeType?.name || "—",
    },
    {
      title: "SỐ ĐIỆN THOẠI",
      render: (_: any, r: Row) => r.user?.phone || "—",
    },
    { title: "PHÒNG BAN", render: (_: any, r: Row) => r.departments?.map((item: Row) => item.department.name).join(", ") || "—" },
    { title: "EXP", dataIndex: "totalExp", render: (v: number) => v ?? 0 },
    { title: "TRẠNG THÁI", dataIndex: "status", render: status },
    {
      title: "",
      render: (_: any, r: Row) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => show(r)}
          />
          <Select
            size="small"
            style={{ width: 145 }}
            value={r.status}
            options={["ACTIVE", "INACTIVE", "SUSPENDED"].map((v) => ({
              value: v,
              label: statuses[v],
            }))}
            onChange={(v) =>
              void act(async () => {
                await request(`/employees/${r.id}/status`, {
                  method: "PATCH",
                  body: { status: v },
                });
                await data.load();
              })
            }
          />
        </Space>
      ),
    },
  ];
  return (
    <>
      <Heading
        eyebrow="QUẢN LÝ / NHÂN SỰ"
        title="Nhân sự"
        subtitle="Tất cả thành viên của đội ngũ ở một nơi."
        extra={
          <Space>
            <Button onClick={() => setTypeOpen(true)}>Loại nhân sự</Button>
            <Button onClick={() => setDepartmentOpen(true)}>Phòng ban</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => show()}
            >
              Thêm nhân sự
            </Button>
          </Space>
        }
      />
      <Panel
        title="Danh sách nhân sự"
        description={`${data.meta?.total ?? "—"} hồ sơ nhân sự`}
      >
        <div className="table-tools">
          <Input.Search
            allowClear
            placeholder="Tìm nhân sự..."
            onSearch={(v) => {
              setPage(1);
              setSearch(v);
            }}
            style={{ width: 280 }}
          />
        </div>
        <ErrorNotice error={data.error} />
        <GridTable
          data={data.data}
          loading={data.loading}
          columns={columns}
          meta={data.meta}
          onPage={(nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }}
        />
      </Panel>
      <Modal
        title={editing ? "Chỉnh sửa nhân sự" : "Thêm nhân sự"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (v) => {
            if (
              await act(async () => {
                if (editing) {
                  const { phone, citizenId, bankName, bankAccountNumber, ...employment } = v;
                  await request(`/employees/${editing.id}`, { method: "PATCH", body: employment });
                  await request(`/employees/${editing.id}/personal-info`, { method: "PATCH", body: { phone, citizenId, bankName, bankAccountNumber } });
                } else await request("/employees", { method: "POST", body: v });
                await data.load();
              })
            )
              setOpen(false);
          }}
        >
          {!editing && (
            <>
              <Form.Item
                label="Tài khoản"
                name="userId"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn tài khoản đã duyệt"
                  options={users.data.map((u) => ({
                    value: u.id,
                    label: `${u.fullName} · ${u.email}`,
                  }))}
                />
              </Form.Item>
            </>
          )}
          <Tabs items={[
            { key: "employment", label: "Chức vụ & phòng ban", children: <><Form.Item label="Tên hiển thị" name="displayName" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="Loại nhân sự" name="employeeTypeId" rules={[{ required: true }]}><Select placeholder="Chọn loại nhân sự" options={types.data.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))} /></Form.Item><Form.Item label="Phòng ban" name="departmentIds"><Select mode="multiple" placeholder="Chọn các phòng ban" options={departments.data.filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.name }))} onChange={(ids) => { const primaryId = form.getFieldValue("primaryDepartmentId"); if (primaryId && !ids.includes(primaryId)) form.setFieldValue("primaryDepartmentId", undefined); }}/></Form.Item><Form.Item label="Phòng ban hiển thị chính" name="primaryDepartmentId" tooltip="Nhân viên sẽ xuất hiện tại phòng này trong Văn phòng ảo"><Select allowClear placeholder="Chọn phòng hiển thị" options={departments.data.filter((department) => department.isActive && selectedDepartmentIds.includes(department.id)).map((department) => ({ value: department.id, label: department.name }))}/></Form.Item></> },
            ...(editing ? [{ key: "personal", label: "Thông tin cá nhân", children: <><p className="modal-description">Những thông tin còn trống sẽ được nhân sự tự cập nhật trên ứng dụng cá nhân.</p><Form.Item label="Số điện thoại" name="phone"><Input type="tel" autoComplete="tel" /></Form.Item><Form.Item label="CCCD" name="citizenId"><Input /></Form.Item><Form.Item label="Ngân hàng" name="bankName"><Input /></Form.Item><Form.Item label="Số tài khoản" name="bankAccountNumber"><Input inputMode="numeric" /></Form.Item></> }] : []),
          ]} />
        </Form>
      </Modal>
      <Modal
        title="Loại nhân sự"
        open={typeOpen}
        onCancel={() => setTypeOpen(false)}
        footer={null}
      >
        <div className="type-list">
          {types.data.map((t) => (
            <div key={t.id}>
              <span>
                {t.name}
              </span>
              <Select size="small" value={t.isActive ? "ACTIVE" : "INACTIVE"} options={["ACTIVE", "INACTIVE"].map((value) => ({ value, label: statuses[value] }))} onChange={(value) => void act(async () => { await request(`/employee-types/${t.id}`, { method: "PATCH", body: { isActive: value === "ACTIVE" } }); await types.load(); })} />
            </div>
          ))}
        </div>
        <Form
          form={typeForm}
          layout="vertical"
          onFinish={async (v) => {
            if (
              await act(async () => {
                await request("/employee-types", { method: "POST", body: v });
                await types.load();
              })
            )
              typeForm.resetFields();
          }}
        >
          <Form.Item name="name" label="Tên loại" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button htmlType="submit" type="primary" icon={<PlusOutlined />}>
            Thêm loại
          </Button>
        </Form>
      </Modal>
      <Modal title="Phòng ban" open={departmentOpen} onCancel={() => setDepartmentOpen(false)} footer={null}>
        <div className="type-list">{departments.data.map((department) => <div key={department.id}><span>{department.name}</span><Select size="small" value={department.isActive ? "ACTIVE" : "INACTIVE"} options={["ACTIVE", "INACTIVE"].map((value) => ({ value, label: statuses[value] }))} onChange={(value) => void act(async () => { await request(`/departments/${department.id}`, { method: "PATCH", body: { isActive: value === "ACTIVE" } }); await departments.load(); })} /></div>)}</div>
        <Form form={departmentForm} layout="vertical" onFinish={async (v) => { if (await act(async () => { await request("/departments", { method: "POST", body: v }); await departments.load(); })) departmentForm.resetFields(); }}>
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          <Button htmlType="submit" type="primary" icon={<PlusOutlined />}>Thêm phòng ban</Button>
        </Form>
      </Modal>
    </>
  );
}

type ServiceImage = { id: string; fileName?: string; mimeType: string; isThumbnail: boolean; createdAt: string };
type ServiceHistory = { id: string; content: string; createdAt: string; createdBy: { id: string; fullName: string } };
type ServiceMachineUsage = { allocatedRevenue: number; laborCost: number; transportCost: number; consumableCost: number; repairCost: number; outsourcedCost: number; otherCost: number; usageMinutes: number; createdAt: string; order: { performedAt: string; event?: { id: string; code?: string; name: string } } };
type ServiceMachine = { id: string; code: string; name: string; status: "READY" | "IN_USE" | "MAINTENANCE" | "RETIRED"; purchaseCost: number; startedAt?: string; note?: string; equipment?: { id: number; name: string; qrCode: string }; usageCount: number; revenue: number; cost: number; profit: number; usageMinutes: number; recentUsages: ServiceMachineUsage[] };
type ServiceFinance = { usageCount: number; revenue: number; cost: number; profit: number; usageMinutes: number };
type ServiceItem = { id: number; code: string; name: string; note?: string; purchasePrice: number; createdAt: string; updatedAt: string; catalogGroup: { id: string; code: string; shortName?: string; name: string }; images: ServiceImage[]; machines: ServiceMachine[]; finance: ServiceFinance; _count: { images: number; history: number } };
type ServiceDetail = ServiceItem & { history: ServiceHistory[] };
const vnd = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

function VndInput({ value, onChange, disabled }: { value?: number; onChange?: (value: number) => void; disabled?: boolean }) {
  return <Input disabled={disabled} inputMode="numeric" value={value == null ? "" : new Intl.NumberFormat("vi-VN").format(value)} suffix="₫" onChange={(event) => { const digits = event.target.value.replace(/\D/g, ""); onChange?.(digits ? Math.min(Number(digits), 2_000_000_000) : 0); }}/>
}

function ServiceThumbnail({ serviceId, image }: { serviceId: number; image?: ServiceImage }) {
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(image));
  useEffect(() => { if (!image) { setSource(null); setLoading(false); return; } let active = true; let objectUrl = ""; setLoading(true); void request<Blob>(`/service-items/${serviceId}/images/${image.id}`, { raw: true }).then((response) => { if (!active) return; objectUrl = URL.createObjectURL(response.data); setSource(objectUrl); }).catch(() => setSource(null)).finally(() => { if (active) setLoading(false); }); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [serviceId, image]);
  return <div className="service-thumbnail">{source ? <img src={source} alt={image?.fileName || "Thumbnail dịch vụ"}/> : loading ? <Spin size="small"/> : <span className="no-camera-icon" title="Chưa có ảnh"><CameraOutlined/></span>}</div>;
}

function ServiceImageCard({ serviceId, image, canDelete, onDelete, onThumbnail }: { serviceId: number; image: ServiceImage; canDelete: boolean; onDelete: () => void; onThumbnail: () => void }) {
  const [source, setSource] = useState("");
  useEffect(() => { let active = true; let objectUrl = ""; void request<Blob>(`/service-items/${serviceId}/images/${image.id}`, { raw: true }).then((response) => { if (!active) return; objectUrl = URL.createObjectURL(response.data); setSource(objectUrl); }).catch(() => setSource("")); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [serviceId, image.id]);
  return <figure className={`service-image-card ${image.isThumbnail ? "thumbnail-selected" : ""}`}>{source ? <img src={source} alt={image.fileName || "Ảnh dịch vụ"}/> : <div><FileImageOutlined/></div>}<figcaption><span><strong>{image.fileName || "Ảnh dịch vụ"}</strong><small>Tải lên: {date(image.createdAt)}</small></span>{canDelete && <Space size={2}>{image.isThumbnail ? <Tag color="success">Thumbnail</Tag> : <Button type="link" size="small" onClick={onThumbnail}>Đặt thumbnail</Button>}<Popconfirm title="Xóa ảnh này?" okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={onDelete}><Button type="text" danger icon={<DeleteOutlined/>}/></Popconfirm></Space>}</figcaption></figure>;
}

const machineStatusLabel: Record<ServiceMachine["status"], string> = { READY: "Sẵn sàng", IN_USE: "Đang sử dụng", MAINTENANCE: "Bảo trì", RETIRED: "Ngừng sử dụng" };
const machineStatusColor: Record<ServiceMachine["status"], string> = { READY: "success", IN_USE: "processing", MAINTENANCE: "warning", RETIRED: "default" };

function ServiceFinanceSection({ service, onChanged }: { service: ServiceDetail; onChanged: () => Promise<void> }) {
  const [machineOpen, setMachineOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<ServiceMachine | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [machineForm] = Form.useForm();
  const [usageForm] = Form.useForm();
  const { message } = App.useApp();
  const role = getSession()?.user.role;
  const equipment = useData<Row[]>("/equipment-items?page=1&pageSize=100", []);
  const events = useData<Row[]>("/events?page=1&pageSize=100", []);
  const openCreateMachine = () => { setEditingMachine(null); machineForm.resetFields(); machineForm.setFieldsValue({ purchaseCost: 0, status: "READY" }); setMachineOpen(true); };
  const openEditMachine = (machine: ServiceMachine) => { setEditingMachine(machine); machineForm.setFieldsValue({ name: machine.name, equipmentId: machine.equipment?.id, purchaseCost: machine.purchaseCost, startedAt: machine.startedAt ? dayjs(machine.startedAt) : null, status: machine.status, note: machine.note }); setMachineOpen(true); };
  const submitMachine = async (values: Row) => { setSaving(true); try { const body = { ...values, ...(editingMachine ? { equipmentId: values.equipmentId ?? null, startedAt: values.startedAt?.format("YYYY-MM-DD") ?? null } : { startedAt: values.startedAt?.format("YYYY-MM-DD") }) }; await request(`/service-items/${service.id}/machines${editingMachine ? `/${editingMachine.id}` : ""}`, { method: editingMachine ? "PATCH" : "POST", body }); message.success(editingMachine ? "Đã cập nhật máy dịch vụ" : "Đã thêm máy dịch vụ"); setMachineOpen(false); setEditingMachine(null); machineForm.resetFields(); await onChanged(); } catch (error) { message.error(error instanceof Error ? error.message : editingMachine ? "Không thể cập nhật máy" : "Không thể thêm máy"); } finally { setSaving(false); } };
  const deleteMachine = async (machine: ServiceMachine) => { try { await request(`/service-items/${service.id}/machines/${machine.id}`, { method: "DELETE" }); message.success("Đã xoá máy dịch vụ"); await onChanged(); } catch (error) { message.error(error instanceof Error ? error.message : "Không thể xoá máy"); } };
  const submitUsage = async (values: Row) => { setSaving(true); try { await request(`/service-items/${service.id}/usages`, { method: "POST", body: { ...values, performedAt: values.performedAt.toISOString() } }); message.success("Đã ghi nhận doanh thu và chi phí"); setUsageOpen(false); usageForm.resetFields(); await onChanged(); } catch (error) { message.error(error instanceof Error ? error.message : "Không thể ghi nhận lượt sử dụng"); } finally { setSaving(false); } };
  const columns = [
    { title: "MÁY", dataIndex: "name", render: (value: string, row: ServiceMachine) => <div><strong>{value}</strong><div className="subline">{row.code}</div></div> },
    { title: "TRẠNG THÁI", dataIndex: "status", width: 125, render: (value: ServiceMachine["status"]) => <Tag color={machineStatusColor[value]}>{machineStatusLabel[value]}</Tag> },
    { title: "LƯỢT DÙNG", dataIndex: "usageCount", width: 95, align: "right" as const },
    { title: "DOANH THU", dataIndex: "revenue", width: 135, align: "right" as const, render: vnd },
    { title: "CHI PHÍ", dataIndex: "cost", width: 125, align: "right" as const, render: vnd },
    { title: "LỢI NHUẬN", dataIndex: "profit", width: 140, align: "right" as const, render: (value: number) => <strong className={value >= 0 ? "profit-positive" : "profit-negative"}>{vnd(value)}</strong> },
    ...(role === "ADMIN" ? [{ title: "THAO TÁC", key: "actions", width: 100, align: "center" as const, render: (_: unknown, machine: ServiceMachine) => <Space size={0}><Tooltip title="Sửa máy"><Button type="text" icon={<EditOutlined/>} onClick={() => openEditMachine(machine)}/></Tooltip><Popconfirm title={`Xoá ${machine.name}?`} description={machine.usageCount ? `Máy có ${machine.usageCount} lượt dùng. Dữ liệu doanh thu và chi phí liên quan cũng sẽ bị xoá.` : "Máy sẽ bị xoá khỏi dịch vụ."} okText="Xoá máy" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => deleteMachine(machine)}><Tooltip title="Xoá máy"><Button type="text" danger icon={<DeleteOutlined/>}/></Tooltip></Popconfirm></Space> }] : []),
  ];
  return <section className="service-detail-section service-finance-section"><div className="service-detail-heading"><div><h3>Máy & hiệu quả tài chính</h3><p>Theo dõi lượt sử dụng, doanh thu, chi phí trực tiếp và lợi nhuận của từng máy.</p></div><Space>{role === "ADMIN" && <Button onClick={openCreateMachine}>Thêm máy</Button>}{(role === "ADMIN" || role === "MANAGER") && service.machines.length > 0 && <Button type="primary" onClick={() => { usageForm.setFieldsValue({ performedAt: dayjs(), revenue: service.purchasePrice, usageMinutes: 240 }); setUsageOpen(true); }}>Ghi nhận sử dụng</Button>}</Space></div><div className="finance-summary"><article><span>Tổng lượt sử dụng</span><strong>{service.finance.usageCount}</strong></article><article><span>Doanh thu</span><strong>{vnd(service.finance.revenue)}</strong></article><article><span>Chi phí trực tiếp</span><strong>{vnd(service.finance.cost)}</strong></article><article className="profit-card"><span>Lợi nhuận</span><strong>{vnd(service.finance.profit)}</strong></article></div><Table size="small" rowKey="id" columns={columns} dataSource={service.machines} pagination={false} scroll={{ x: 920 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa khai báo máy cho dịch vụ"/> }}/><Modal title={editingMachine ? `Sửa máy ${editingMachine.code}` : "Thêm máy cho dịch vụ"} open={machineOpen} onCancel={() => { setMachineOpen(false); setEditingMachine(null); machineForm.resetFields(); }} onOk={() => machineForm.submit()} confirmLoading={saving} okText={editingMachine ? "Lưu thay đổi" : "Thêm máy"} cancelText="Hủy" destroyOnHidden><Form form={machineForm} layout="vertical" onFinish={submitMachine}><Form.Item name="name" label="Tên máy" rules={[{ required: true }]}><Input placeholder="Ví dụ: Iconic 03"/></Form.Item><Form.Item name="equipmentId" label="Liên kết thiết bị trong kho"><Select allowClear loading={equipment.loading} showSearch optionFilterProp="label" options={equipment.data.map((item) => ({ value: item.id, label: `${item.name}${item.model ? ` — ${item.model}` : ""}` }))}/></Form.Item><div className="form-pair"><Form.Item name="purchaseCost" label="Giá mua máy"><VndInput/></Form.Item><Form.Item name="startedAt" label="Ngày bắt đầu sử dụng"><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY"/></Form.Item></div><Form.Item name="status" label="Trạng thái"><Select options={Object.entries(machineStatusLabel).map(([value, label]) => ({ value, label }))}/></Form.Item><Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2}/></Form.Item></Form></Modal><Modal title="Ghi nhận máy đã thực hiện dịch vụ" open={usageOpen} onCancel={() => setUsageOpen(false)} onOk={() => usageForm.submit()} confirmLoading={saving} okText="Lưu ghi nhận" cancelText="Hủy" width={720} destroyOnHidden><Form form={usageForm} layout="vertical" onFinish={submitUsage}><div className="form-pair"><Form.Item name="machineId" label="Máy thực hiện" rules={[{ required: true }]}><Select options={service.machines.map((machine) => ({ value: machine.id, label: `${machine.code} — ${machine.name}` }))}/></Form.Item><Form.Item name="eventId" label="Sự kiện (không bắt buộc)"><Select allowClear loading={events.loading} showSearch optionFilterProp="label" options={events.data.map((event) => ({ value: event.id, label: `${event.code || "Sự kiện"} — ${event.name}` }))}/></Form.Item></div><div className="form-pair"><Form.Item name="performedAt" label="Thời gian thực hiện" rules={[{ required: true }]}><DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm"/></Form.Item><Form.Item name="usageMinutes" label="Thời lượng sử dụng (phút)"><InputNumber min={0} style={{ width: "100%" }}/></Form.Item></div><Form.Item name="revenue" label="Doanh thu phân bổ cho máy" rules={[{ required: true }]}><VndInput/></Form.Item><div className="finance-cost-grid"><Form.Item name="laborCost" label="Nhân sự"><VndInput/></Form.Item><Form.Item name="transportCost" label="Vận chuyển"><VndInput/></Form.Item><Form.Item name="consumableCost" label="Vật tư tiêu hao"><VndInput/></Form.Item><Form.Item name="repairCost" label="Sửa chữa"><VndInput/></Form.Item><Form.Item name="outsourcedCost" label="Thuê ngoài"><VndInput/></Form.Item><Form.Item name="otherCost" label="Chi phí khác"><VndInput/></Form.Item></div><Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2}/></Form.Item></Form></Modal></section>;
}

function ServiceDetailModal({ id, groups, onClose, onChanged }: { id: number; groups: CatalogGroup[]; onClose: () => void; onChanged: () => void }) {
  const detail = useData<ServiceDetail | null>(`/service-items/${id}`, null);
  const [form] = Form.useForm();
  const [history, setHistory] = useState("");
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  const isAdmin = getSession()?.user.role === "ADMIN";
  useEffect(() => { if (detail.data) form.setFieldsValue({ name: detail.data.name, catalogGroupId: detail.data.catalogGroup.id, note: detail.data.note, purchasePrice: detail.data.purchasePrice }); }, [detail.data, form]);
  const upload = async (file: File) => { try { await request(`/service-items/${id}/images`, { method: "POST", body: { fileName: file.name, dataUrl: await fileAsDataUrl(file) } }); message.success("Đã tải ảnh và lưu thời gian upload"); await detail.load(); onChanged(); } catch (error) { message.error(error instanceof Error ? error.message : "Không thể tải ảnh"); } };
  return <Modal width={1080} title={detail.data ? `${detail.data.code} — ${detail.data.name}` : "Chi tiết dịch vụ"} open onCancel={onClose} footer={null} destroyOnHidden><ErrorNotice error={detail.error}/>{detail.loading || !detail.data ? <div className="modal-loading"><Spin/></div> : <div className="service-detail"><Form form={form} layout="vertical" disabled={!isAdmin} onFinish={async (values) => { setSaving(true); try { await request(`/service-items/${id}`, { method: "PATCH", body: values }); message.success("Đã cập nhật dịch vụ"); await detail.load(); onChanged(); } catch (error) { message.error(error instanceof Error ? error.message : "Không thể cập nhật"); } finally { setSaving(false); } }}><div className="form-pair"><Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true }]}><Input/></Form.Item><Form.Item name="catalogGroupId" label="Loại / nhóm dịch vụ" rules={[{ required: true }]}><Select options={groups.map((group) => ({ value: group.id, label: `${group.code} — ${group.name}` }))}/></Form.Item></div><div className="form-pair"><Form.Item name="purchasePrice" label="Giá nhập (VND)" rules={[{ required: true }]}><VndInput/></Form.Item><Form.Item label="Ngày cập nhật"><Input value={date(detail.data.updatedAt)} disabled/></Form.Item></div><Form.Item name="note" label="Ghi chú"><Input.TextArea rows={3}/></Form.Item>{isAdmin && <Button type="primary" htmlType="submit" icon={<SaveOutlined/>} loading={saving}>Lưu thay đổi</Button>}</Form><ServiceFinanceSection service={detail.data} onChanged={async () => { await detail.load(); onChanged(); }}/><section className="service-detail-section"><div className="service-detail-heading"><div><h3>Ảnh dịch vụ</h3><p>Mỗi ảnh hiển thị ngày và giờ upload. Chọn một ảnh để làm thumbnail ngoài danh sách.</p></div><Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={(file) => { if (file.size > 20_000_000) { message.error("Ảnh không được vượt quá 20 MB"); return Upload.LIST_IGNORE; } void upload(file); return false; }}><Button icon={<UploadOutlined/>}>Tải ảnh lên</Button></Upload></div>{detail.data.images.length ? <div className="service-image-grid">{detail.data.images.map((image) => <ServiceImageCard key={image.id} serviceId={id} image={image} canDelete={isAdmin} onThumbnail={async () => { await request(`/service-items/${id}/images/${image.id}/thumbnail`, { method: "PATCH" }); await detail.load(); onChanged(); message.success("Đã chọn ảnh thumbnail"); }} onDelete={async () => { await request(`/service-items/${id}/images/${image.id}`, { method: "DELETE" }); await detail.load(); onChanged(); }}/>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có ảnh dịch vụ"/>}</section><section className="service-detail-section"><div className="service-detail-heading"><div><h3>Lịch sử & tình trạng</h3><p>Nhân viên ghi nhận hư hỏng khi đi show hoặc trong quá trình vận chuyển.</p></div></div><div className="service-history-form"><Input.TextArea value={history} onChange={(event) => setHistory(event.target.value)} rows={2} maxLength={2000} placeholder="Ví dụ: Đi show bị hư chân đế, trầy khi vận chuyển..."/><Button type="primary" disabled={!history.trim()} onClick={async () => { try { await request(`/service-items/${id}/history`, { method: "POST", body: { content: history } }); setHistory(""); await detail.load(); onChanged(); message.success("Đã thêm lịch sử"); } catch (error) { message.error(error instanceof Error ? error.message : "Không thể thêm lịch sử"); } }}>Thêm lịch sử</Button></div>{detail.data.history.length ? <div className="service-history-list">{detail.data.history.map((entry) => <article key={entry.id}><span className="history-dot"/><div><strong>{entry.createdBy.fullName}</strong><time>{date(entry.createdAt)}</time><p>{entry.content}</p></div></article>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lịch sử"/>}</section></div>}</Modal>;
}

export function ServicesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number>();
  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  const isAdmin = getSession()?.user.role === "ADMIN";
  const groups = useData<CatalogGroup[]>("/catalog/groups/service", []);
  const services = useData<ServiceItem[]>(`/service-items${query({ page, pageSize, search, groupId })}`, []);
  const removeSelected = () => modal.confirm({ title: selectedIds.length === 1 ? "Xóa dịch vụ đã chọn?" : `Xóa ${selectedIds.length} dịch vụ đã chọn?`, content: "Dữ liệu máy và hiệu quả tài chính của dịch vụ sẽ bị xóa. Thiết bị gốc trong kho vẫn được giữ nguyên.", okText: "Xóa dịch vụ", cancelText: "Hủy", okButtonProps: { danger: true }, onOk: async () => { setDeleting(true); try { const result = await request<{ deleted: number }>("/service-items/bulk", { method: "DELETE", body: { ids: selectedIds } }); message.success(`Đã xóa ${result.data.deleted} dịch vụ, thiết bị trong kho không bị ảnh hưởng`); setSelectedIds([]); await services.load(); } catch (error) { message.error(error instanceof Error ? error.message : "Không thể xóa dịch vụ"); throw error; } finally { setDeleting(false); } } });
  const columns = [
    { title: "ẢNH", dataIndex: "images", width: 110, render: (images: ServiceImage[], row: ServiceItem) => <ServiceThumbnail serviceId={row.id} image={images[0]}/> },
    { title: "MÃ DỊCH VỤ", dataIndex: "code", width: 130, render: (value: string) => <Tag>{value}</Tag> },
    { title: "TÊN DỊCH VỤ", dataIndex: "name", width: 240, render: (value: string, row: ServiceItem) => <button className="service-name-link" onClick={() => setDetailId(row.id)}>{value}</button> },
    { title: "LOẠI / NHÓM", dataIndex: "catalogGroup", width: 180, render: (group: ServiceItem["catalogGroup"]) => <div><strong>{group.name}</strong><div className="subline">{group.code}</div></div> },
    { title: "MÁY", dataIndex: "machines", width: 90, align: "right" as const, render: (machines: ServiceMachine[]) => machines.length },
    { title: "LƯỢT DÙNG", dataIndex: "finance", width: 110, align: "right" as const, render: (finance: ServiceFinance) => finance.usageCount },
    { title: "DOANH THU", dataIndex: "finance", width: 150, align: "right" as const, render: (finance: ServiceFinance) => vnd(finance.revenue) },
    { title: "LỢI NHUẬN", dataIndex: "finance", width: 150, align: "right" as const, render: (finance: ServiceFinance) => <strong className={finance.profit >= 0 ? "profit-positive" : "profit-negative"}>{vnd(finance.profit)}</strong> },
    { title: "GHI CHÚ", dataIndex: "note", width: 300, render: (value?: string) => value || "—" },
    { title: "GIÁ NHẬP", dataIndex: "purchasePrice", width: 150, render: vnd },
    { title: "NGÀY CẬP NHẬT", dataIndex: "updatedAt", width: 165, render: date },
    { title: "", key: "actions", fixed: "right" as const, width: 110, render: (_: unknown, row: ServiceItem) => <Button size="small" onClick={() => setDetailId(row.id)}>Chi tiết</Button> },
  ];
  return <>
    <Heading eyebrow="THIẾT BỊ & VẬT TƯ / DỊCH VỤ" title="Danh sách dịch vụ" subtitle="Quản lý thông tin, hình ảnh, giá nhập và lịch sử dịch vụ." extra={isAdmin ? <Button type="primary" icon={<PlusOutlined/>} onClick={() => { form.resetFields(); setFiles([]); setCreateOpen(true); }}>Tạo dịch vụ</Button> : undefined}/>
    <ErrorNotice error={services.error || groups.error}/><Panel title="Dịch vụ" description={`${services.meta?.total ?? 0} dịch vụ trong hệ thống`}><div className="equipment-filters"><Input.Search allowClear placeholder="Tìm mã, tên hoặc ghi chú..." onSearch={(value) => { setSearch(value); setPage(1); setSelectedIds([]); }} style={{ width: 320 }}/><Select allowClear placeholder="Lọc theo nhóm dịch vụ" value={groupId} onChange={(value) => { setGroupId(value); setPage(1); setSelectedIds([]); }} style={{ width: 250 }} options={groups.data.map((group) => ({ value: group.id, label: `${group.code} — ${group.name}` }))}/><Button icon={<ReloadOutlined/>} loading={services.loading} onClick={() => void services.load()}>Làm mới</Button>{isAdmin && <Button danger icon={<DeleteOutlined/>} disabled={!selectedIds.length} loading={deleting} onClick={removeSelected}>Xóa{selectedIds.length ? ` (${selectedIds.length})` : ""}</Button>}</div><Table rowKey="id" loading={services.loading} columns={columns} dataSource={services.data} rowSelection={isAdmin ? { selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys.map(Number)), getCheckboxProps: () => ({ disabled: deleting }) } : undefined} scroll={{ x: 1800 }} pagination={{ current: services.meta?.page, pageSize: services.meta?.pageSize || pageSize, total: services.meta?.total, showSizeChanger: true, pageSizeOptions: tablePageSizeOptions, hideOnSinglePage: true, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); setSelectedIds([]); } }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dịch vụ"/> }}/></Panel>
    <Modal title="Tạo dịch vụ" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Tạo dịch vụ" cancelText="Hủy" confirmLoading={creating} destroyOnHidden><Form form={form} layout="vertical" initialValues={{ purchasePrice: 0 }} onFinish={async (values) => { setCreating(true); try { const created = await request<ServiceDetail>("/service-items", { method: "POST", body: values }); for (const file of files) await request(`/service-items/${created.data.id}/images`, { method: "POST", body: { fileName: file.name, dataUrl: await fileAsDataUrl(file) } }); message.success(`Đã tạo ${created.data.code}`); setCreateOpen(false); await services.load(); setDetailId(created.data.id); } catch (error) { message.error(error instanceof Error ? error.message : "Không thể tạo dịch vụ"); } finally { setCreating(false); } }}><Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true, message: "Vui lòng nhập tên dịch vụ" }]}><Input placeholder="Ví dụ: Chụp ảnh sự kiện cơ bản"/></Form.Item><Form.Item name="catalogGroupId" label="Loại / nhóm dịch vụ" rules={[{ required: true, message: "Vui lòng chọn nhóm dịch vụ" }]}><Select options={groups.data.map((group) => ({ value: group.id, label: `${group.code} — ${group.name}` }))}/></Form.Item><Form.Item name="purchasePrice" label="Giá nhập (VND)" rules={[{ required: true }]}><VndInput/></Form.Item><Form.Item name="note" label="Ghi chú"><Input.TextArea rows={3} maxLength={2000}/></Form.Item><Form.Item label="Ảnh dịch vụ"><Upload multiple accept="image/jpeg,image/png,image/webp" beforeUpload={(file) => { if (file.size > 20_000_000) { message.error(`${file.name} vượt quá 20 MB`); return Upload.LIST_IGNORE; } setFiles((current) => [...current, file]); return false; }} onRemove={(file) => setFiles((current) => current.filter((item) => item.name !== file.name || item.lastModified !== file.lastModified))}><Button icon={<UploadOutlined/>}>Chọn ảnh</Button></Upload><div className="subline">JPEG, PNG hoặc WebP · tối đa 20 MB/ảnh. Ảnh đầu tiên được chọn làm thumbnail; có thể đổi trong trang chi tiết.</div></Form.Item></Form></Modal>
    {detailId && (
      <ServiceDetailModal id={detailId} groups={groups.data} onClose={() => setDetailId(undefined)} onChanged={() => void services.load()}/>
    )}
  </>;
}

export function CalendarPage() {
  return (
    <>
      <Heading
        eyebrow="QUẢN LÝ / LỊCH"
        title="Lịch"
        subtitle="Theo dõi sự kiện theo tháng."
      />
      <EventCalendar revision={0} />
    </>
  );
}

export function EventsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"week" | "month" | "choose">("week");
  const [chosenMonth, setChosenMonth] = useState(dayjs());
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [details, setDetails] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const dateRange = useMemo(() => {
    if (period === "week") {
      const today = dayjs().startOf("day");
      const start = today.subtract((today.day() + 6) % 7, "day");
      return { startFrom: start.toISOString(), startTo: start.add(6, "day").endOf("day").toISOString(), label: "trong tuần này" };
    }
    const month = period === "month" ? dayjs() : chosenMonth;
    return { startFrom: month.startOf("month").toISOString(), startTo: month.endOf("month").toISOString(), label: `trong ${month.format("MM/YYYY")}` };
  }, [period, chosenMonth]);
  const data = useData<Row[]>(
    `/events${query({ page, pageSize, search, startFrom: dateRange.startFrom, startTo: dateRange.startTo })}`,
    [],
  );
  const employees = useData<Row[]>("/employees?pageSize=100", []);
  const types = useData<Row[]>("/employee-types", []);
  const assign = useData<Row[]>(
    details ? `/events/${details.id}/assignments` : "/events?pageSize=1",
    [],
  );
  const act = useAction();
  const clearSelection = () => setSelectedIds([]);
  const remove = (ids: string[]) =>
    void act(
      async () => {
        await request(ids.length === 1 ? `/events/${ids[0]}` : "/events/bulk", {
          method: "DELETE",
          ...(ids.length > 1 ? { body: { ids } } : {}),
        });
        clearSelection();
        if (details && ids.includes(details.id)) setDetails(null);
        await data.load();
      },
      ids.length === 1 ? "Đã xoá sự kiện" : "Đã xoá các sự kiện đã chọn",
    );
  const show = (r?: Row) => {
    setEditing(r || null);
    form.resetFields();
    if (r)
      form.setFieldsValue({
        ...r,
        startAt: dayjs(r.startAt),
        endAt: dayjs(r.endAt),
      });
    else form.setFieldsValue({ timeConfirmed: true });
    setOpen(true);
  };
  const columns = [
    {
      title: "SỰ KIỆN",
      render: (_: any, r: Row) => (
        <div>
          <strong>{r.name}</strong>
          <div className="subline">
            {r.code || r.location || "Chưa có địa điểm"}
          </div>
        </div>
      ),
    },
    {
      title: "BẮT ĐẦU",
      dataIndex: "startAt",
      render: (v: string, r: Row) =>
        r.timeConfirmed
          ? date(v)
          : `${dayjs(v).format("DD/MM/YYYY")} · Chưa có giờ`,
    },
    {
      title: "KẾT THÚC",
      dataIndex: "endAt",
      render: (v: string, r: Row) =>
        r.timeConfirmed ? date(v) : "Chưa có giờ",
    },
    { title: "NGUỒN", dataIndex: "source", render: status },
    { title: "TRẠNG THÁI", dataIndex: "status", render: status },
    {
      title: "",
      render: (_: any, r: Row) => (
        <Space>
          <Button size="small" onClick={() => setDetails(r)}>
            Chi tiết
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => show(r)}
          />
          <Popconfirm
            title="Xoá sự kiện này?"
            description="Dữ liệu sẽ bị ẩn khỏi hệ thống và có thể xem lại trong nhật ký."
            okText="Xoá"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove([r.id])}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];
  return (
    <>
      <Heading
        eyebrow="QUẢN LÝ / SỰ KIỆN"
        title="Sự kiện"
        subtitle="Theo dõi danh sách và sắp xếp đội ngũ cho từng sự kiện."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => show()}>
            Tạo sự kiện
          </Button>
        }
      />
      <Panel
        title="Danh sách sự kiện"
        description={`${data.meta?.total ?? "—"} sự kiện ${dateRange.label}`}
      >
        <div className="table-tools">
          <Segmented
            value={period}
            options={[{ label: "Tuần này", value: "week" }, { label: "Tháng này", value: "month" }, { label: "Chọn tháng", value: "choose" }]}
            onChange={(value) => { setPage(1); clearSelection(); setPeriod(value as "week" | "month" | "choose"); }}
          />
          {period === "choose" && <DatePicker picker="month" value={chosenMonth} format="MM/YYYY" allowClear={false} onChange={(value) => { if (value) { setPage(1); clearSelection(); setChosenMonth(value); } }} />}
          <Input.Search
            allowClear
            placeholder="Tìm sự kiện..."
            onSearch={(v) => {
              setPage(1);
              setSearch(v);
              clearSelection();
            }}
            style={{ width: 280 }}
          />
          {selectedIds.length > 0 && (
            <Popconfirm
              title={`Xoá ${selectedIds.length} sự kiện đã chọn?`}
              description="Các sự kiện sẽ bị xoá mềm và không còn hiện trong lịch."
              okText="Xoá tất cả"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(selectedIds.map(String))}
            >
              <Button danger icon={<DeleteOutlined />}>
                Xoá đã chọn ({selectedIds.length})
              </Button>
            </Popconfirm>
          )}
        </div>
        <ErrorNotice error={data.error} />
        <Table
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: setSelectedIds,
          }}
          columns={columns}
          dataSource={data.data}
          loading={data.loading}
          scroll={{ x: 760 }}
          locale={{ emptyText: empty }}
          pagination={
            data.meta
              ? {
                  current: data.meta.page,
                  pageSize: data.meta.pageSize,
                  total: data.meta.total,
                  showSizeChanger: true,
                  pageSizeOptions: tablePageSizeOptions,
                  onChange: (next, nextPageSize) => {
                    clearSelection();
                    setPage(next);
                    setPageSize(nextPageSize);
                  },
                  hideOnSinglePage: true,
                }
              : false
          }
        />
      </Panel>
      <Modal
        title={editing ? "Chỉnh sửa sự kiện" : "Tạo sự kiện"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (v) => {
            const body = {
              ...v,
              startAt: v.startAt?.toISOString(),
              endAt: v.endAt?.toISOString(),
            };
            if (
              await act(async () => {
                await request(editing ? `/events/${editing.id}` : "/events", {
                  method: editing ? "PATCH" : "POST",
                  body,
                });
                await data.load();
              })
            )
              setOpen(false);
          }}
        >
          <Form.Item
            label="Tên sự kiện"
            name="name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item label="Mã sự kiện (không bắt buộc)" name="code">
              <Input />
            </Form.Item>
          )}
          <div className="form-pair">
            <Form.Item
              label="Bắt đầu"
              name="startAt"
              rules={[{ required: true }]}
            >
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="Kết thúc"
              name="endAt"
              rules={[{ required: true }]}
            >
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="timeConfirmed" valuePropName="checked">
            <Checkbox>Đã xác nhận giờ bắt đầu và kết thúc</Checkbox>
          </Form.Item>
          <Form.Item label="Địa điểm" name="location">
            <Input />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Trạng thái" name="status">
            <Select
              allowClear
              options={[
                "DRAFT",
                "APPROVED",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
              ].map((v) => ({ value: v, label: statuses[v] }))}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={details?.name}
        open={!!details}
        onCancel={() => setDetails(null)}
        footer={null}
        width={650}
      >
        <p className="modal-description">
          {details?.timeConfirmed
            ? `${date(details.startAt)} — ${date(details.endAt)}`
            : `${dayjs(details?.startAt).format("DD/MM/YYYY")} · Chưa xác định giờ`}
        </p>
        <h3>Nhân sự được phân công</h3>
        <ErrorNotice error={assign.error} />
        {assign.data.length && details ? (
          <div className="type-list">
            {assign.data.map((a) => (
              <div key={a.id}>
                <span>
                  {a.employee?.displayName}{" "}
                  <small>
                    {a.employeeType?.name} ·{" "}
                    {a.status === "CONFIRMED"
                      ? "Đã nhận việc"
                      : a.status === "CANCELLED"
                        ? "Đã hủy"
                        : "Chưa xác nhận"}
                  </small>
                </span>
                <Popconfirm
                  title="Hủy phân công này?"
                  onConfirm={() =>
                    void act(async () => {
                      await request(
                        `/events/${details.id}/assignments/${a.id}`,
                        { method: "DELETE" },
                      );
                      await assign.load();
                    })
                  }
                >
                  <Button size="small" danger>
                    Hủy
                  </Button>
                </Popconfirm>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Chưa có nhân sự được phân công.</p>
        )}
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={async (v) => {
            if (
              await act(async () => {
                await request(`/events/${details!.id}/assignments`, {
                  method: "POST",
                  body: {
                    employeeId: v.employeeId,
                    employeeTypeId: v.employeeTypeId,
                    status: v.confirmed ? "CONFIRMED" : "ASSIGNED",
                  },
                });
                await assign.load();
              })
            )
              assignForm.resetFields();
          }}
        >
          <div className="form-pair">
            <Form.Item
              name="employeeId"
              label="Nhân sự"
              rules={[{ required: true }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={employees.data.map((e) => ({
                  value: e.id,
                  label: e.displayName,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="employeeTypeId"
              label="Vai trò"
              rules={[{ required: true }]}
            >
              <Select
                options={types.data
                  .filter((t) => t.isActive)
                  .map((t) => ({ value: t.id, label: t.name }))}
              />
            </Form.Item>
          </div>
          <Form.Item name="confirmed" valuePropName="checked">
            <Checkbox>Nhân sự đã xác nhận nhận việc</Checkbox>
          </Form.Item>
          <Button htmlType="submit" type="primary" icon={<PlusOutlined />}>
            Phân công
          </Button>
        </Form>
      </Modal>
    </>
  );
}

export function AttendancePage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const data = useData<Row[]>(`/attendance?page=${page}&pageSize=${pageSize}`, []);
  const employees = useData<Row[]>("/employees?pageSize=100", []);
  const [photo, setPhoto] = useState<string>();
  const act = useAction();
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );
  const view = async (id: string, phase: string) => {
    await act(async () => {
      const r = await request<Blob>(`/attendance/${id}/photos/${phase}`, {
        raw: true,
      });
      setPhoto(URL.createObjectURL(r.data));
    }, "Đã tải ảnh");
  };
  const columns = [
    {
      title: "NHÂN SỰ",
      render: (_: any, r: Row) =>
        employees.data.find((x) => x.id === r.employeeId)?.displayName ||
        r.employeeId,
    },
    { title: "LOẠI", dataIndex: "type", render: status },
    { title: "CHECK-IN", dataIndex: "checkInAt", render: date },
    { title: "CHECK-OUT", dataIndex: "checkOutAt", render: date },
    {
      title: "VỊ TRÍ",
      render: (_: any, r: Row) => (
        <div>
          <div>
            Check-in:{" "}
            {r.checkInLatitude != null && r.checkInLongitude != null
              ? `${r.checkInLatitude.toFixed(5)}, ${r.checkInLongitude.toFixed(5)}`
              : "Không có vị trí"}
          </div>
          {r.checkOutAt && (
            <div>
              Check-out:{" "}
              {r.checkOutLatitude != null && r.checkOutLongitude != null
                ? `${r.checkOutLatitude.toFixed(5)}, ${r.checkOutLongitude.toFixed(5)}`
                : "Không có vị trí"}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "EXP",
      render: (_: any, r: Row) =>
        r.expTransaction ? `+${r.expTransaction.amount}` : "0",
    },
    {
      title: "ẢNH",
      render: (_: any, r: Row) => (
        <Space>
          <Button size="small" onClick={() => view(r.id, "check-in")}>
            Check-in
          </Button>
          {r.checkOutAt && (
            <Button size="small" onClick={() => view(r.id, "check-out")}>
              Check-out
            </Button>
          )}
        </Space>
      ),
    },
  ];
  return (
    <>
      <Heading
        eyebrow="QUẢN LÝ / CHẤM CÔNG"
        title="Chấm công"
        subtitle="Theo dõi lượt check-in, check-out và bằng chứng hình ảnh."
      />
      <Panel
        title="Lịch sử chấm công"
        description={`${data.meta?.total ?? "—"} lượt đã ghi nhận`}
      >
        <ErrorNotice error={data.error} />
        <GridTable
          data={data.data}
          loading={data.loading}
          columns={columns}
          meta={data.meta}
          onPage={(nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }}
        />
      </Panel>
      <Modal
        title="Ảnh chấm công"
        open={!!photo}
        onCancel={() => setPhoto(undefined)}
        footer={null}
      >
        {photo && (
          <img
            src={photo}
            alt="Ảnh chấm công"
            style={{ width: "100%", borderRadius: 10 }}
          />
        )}
      </Modal>
    </>
  );
}

export function PointsPage() {
  const employees = useData<Row[]>("/employees?pageSize=100", []);
  const config = useData<Row>("/attendance/exp-config", {});
  const [id, setId] = useState("");
  const points = useData<Row[]>(
    id
      ? `/employees/${id}/point-transactions?pageSize=100`
      : "/employees?pageSize=1",
    [],
  );
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [expForm] = Form.useForm();
  const act = useAction();
  useEffect(() => {
    expForm.setFieldsValue(config.data);
  }, [config.data, expForm]);
  const columns = [
    {
      title: "ĐIỂM",
      dataIndex: "points",
      render: (v: number) => (
        <strong>
          {v > 0 ? "+" : ""}
          {v}
        </strong>
      ),
    },
    { title: "LÝ DO", dataIndex: "reason" },
    { title: "TRẠNG THÁI", dataIndex: "status", render: status },
    { title: "NGÀY TẠO", dataIndex: "createdAt", render: date },
    {
      title: "",
      render: (_: any, r: Row) =>
        r.status === "PENDING" ? (
          <Space>
            <Button
              size="small"
              type="primary"
              onClick={() =>
                void act(async () => {
                  await request(`/point-transactions/${r.id}/approve`, {
                    method: "POST",
                  });
                  await points.load();
                })
              }
            >
              Duyệt
            </Button>
            <Button
              size="small"
              onClick={() =>
                Modal.confirm({
                  title: "Từ chối đề xuất",
                  content: (
                    <Input.TextArea
                      id="reject-reason"
                      placeholder="Nhập lý do"
                    />
                  ),
                  onOk: async () => {
                    const value = (
                      document.getElementById(
                        "reject-reason",
                      ) as HTMLTextAreaElement
                    )?.value;
                    if (!value?.trim()) throw new Error("Vui lòng nhập lý do");
                    await act(async () => {
                      await request(`/point-transactions/${r.id}/reject`, {
                        method: "POST",
                        body: { rejectedReason: value },
                      });
                      await points.load();
                    });
                  },
                })
              }
            >
              Từ chối
            </Button>
          </Space>
        ) : null,
    },
  ];
  return (
    <>
      <Heading
        eyebrow="QUẢN LÝ / ĐIỂM"
        title="Điểm & EXP"
        subtitle="Theo dõi điểm nhân sự và cấu hình EXP chấm công."
      />
      <div className="points-layout">
        <Panel
          title="Quy tắc EXP"
          description="Điểm được cộng khi hoàn tất check-out."
        >
          <ErrorNotice error={config.error} />
          <Form
            form={expForm}
            layout="vertical"
            onFinish={(v) =>
              void act(async () => {
                await request("/attendance/exp-config", {
                  method: "PATCH",
                  body: v,
                });
                await config.load();
              })
            }
          >
            <Form.Item
              name="dailyExp"
              label="Check-in hàng ngày"
              rules={[{ required: true }]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: "100%" }}
                addonAfter="EXP / ngày"
              />
            </Form.Item>
            <Form.Item
              name="eventExp"
              label="Check-in sự kiện"
              rules={[{ required: true }]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: "100%" }}
                addonAfter="EXP / sự kiện"
              />
            </Form.Item>
            <Button htmlType="submit" type="primary">
              Lưu cài đặt
            </Button>
          </Form>
        </Panel>
        <Panel
          title="Lịch sử điểm"
          description="Chọn một nhân sự để xem và duyệt điểm."
          extra={
            <Button
              disabled={!id}
              icon={<PlusOutlined />}
              onClick={() => setOpen(true)}
            >
              Đề xuất điểm
            </Button>
          }
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn nhân sự"
            style={{ width: "100%", maxWidth: 340, marginBottom: 20 }}
            value={id || undefined}
            onChange={setId}
            options={employees.data.map((e) => ({
              value: e.id,
              label: `${e.displayName} · ${e.user?.email || ""}`,
            }))}
          />
          {id ? (
            <>
              <ErrorNotice error={points.error} />
              <GridTable
                data={points.data}
                loading={points.loading}
                columns={columns}
              />
            </>
          ) : (
            <div className="empty-inline">
              <SafetyCertificateOutlined />
              <strong>Chọn nhân sự để bắt đầu</strong>
            </div>
          )}
        </Panel>
      </div>
      <Modal
        title="Đề xuất điểm"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Gửi đề xuất"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (v) => {
            if (
              await act(async () => {
                await request(`/employees/${id}/point-transactions`, {
                  method: "POST",
                  body: v,
                });
                await points.load();
              })
            ) {
              setOpen(false);
              form.resetFields();
            }
          }}
        >
          <Form.Item
            name="points"
            label="Số điểm (+ hoặc −)"
            rules={[{ required: true }]}
          >
            <InputNumber precision={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Row>();
  const data = useData<Row[]>(`/audit-logs?page=${page}&pageSize=${pageSize}`, []);
  const columns = [
    { title: "THỜI GIAN", dataIndex: "createdAt", render: date },
    { title: "HÀNH ĐỘNG", dataIndex: "action" },
    { title: "ĐỐI TƯỢNG", dataIndex: "entityType" },
    {
      title: "NGƯỜI THỰC HIỆN",
      render: (_: any, r: Row) => r.actorUserId || "Hệ thống",
    },
    {
      title: "",
      render: (_: any, r: Row) => (
        <Button size="small" onClick={() => setSelected(r)}>
          Chi tiết
        </Button>
      ),
    },
  ];
  return (
    <>
      <Heading
        eyebrow="HỆ THỐNG / NHẬT KÝ"
        title="Nhật ký hoạt động"
        subtitle="Theo dõi các thay đổi đã được ghi nhận trong hệ thống."
      />
      <Panel
        title="Hoạt động gần đây"
        description={`${data.meta?.total ?? "—"} bản ghi`}
      >
        <ErrorNotice error={data.error} />
        <GridTable
          data={data.data}
          loading={data.loading}
          columns={columns}
          meta={data.meta}
          onPage={(nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }}
        />
      </Panel>
      <Modal
        title="Chi tiết hoạt động"
        open={!!selected}
        onCancel={() => setSelected(undefined)}
        footer={null}
      >
        <pre className="result-box">{JSON.stringify(selected, null, 2)}</pre>
      </Modal>
    </>
  );
}

export function LarkPage() {
  const info = useData<Row>("/events/sync/lark/status", {});
  const [calendars, setCalendars] = useState<Row[]>([]);
  const [chosen, setChosen] = useState<string>();
  const [busy, setBusy] = useState("");
  const act = useAction();
  const connect = async () => {
    const popup = window.open("about:blank", "_blank");
    setBusy("connect");
    const ok = await act(async () => {
      const { data } = await request<Row>("/events/lark/connect", {
        method: "POST",
      });
      if (popup) popup.location.href = data.authorizationUrl;
      else window.location.href = data.authorizationUrl;
    }, "Mở trang cấp quyền Lark");
    if (!ok) popup?.close();
    setBusy("");
  };
  const loadCalendars = async () => {
    setBusy("list");
    await act(async () => {
      const { data } = await request<Row[]>("/events/lark/calendars");
      setCalendars(data);
    }, "Đã tải danh sách lịch");
    setBusy("");
  };
  const save = async () => {
    if (!chosen) return;
    setBusy("save");
    await act(async () => {
      await request("/events/lark/calendar", {
        method: "PUT",
        body: { calendarId: chosen },
      });
      await info.load();
    }, "Đã chọn lịch");
    setBusy("");
  };
  const sync = async () => {
    setBusy("sync");
    await act(async () => {
      const { data } = await request<Row>("/events/sync/lark", {
        method: "POST",
      });
      await info.load();
      Modal.success({
        title: "Đồng bộ hoàn tất",
        content: `Tạo mới: ${data.created} · Cập nhật: ${data.updated} · Hủy: ${data.cancelled} · Lỗi: ${data.failed}`,
      });
    }, "Đã đồng bộ lịch");
    setBusy("");
  };
  return (
    <>
      <Heading
        eyebrow="HỆ THỐNG / TÍCH HỢP"
        title="Kết nối Lark"
        subtitle="Kết nối một lần và đồng bộ sự kiện khi bạn cần."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void info.load()}>
            Làm mới trạng thái
          </Button>
        }
      />
      <ErrorNotice error={info.error} />
      <div className="lark-grid">
        <Panel
          title="Trạng thái kết nối"
          description="Quản lý lịch được dùng để đồng bộ sự kiện."
        >
          <div className="lark-status">
            <div className="lark-logo">L</div>
            <div>
              <strong>Lark Calendar</strong>
              <p>
                {info.loading
                  ? "Đang kiểm tra..."
                  : info.data.connected
                    ? "Tài khoản Lark đã kết nối"
                    : "Chưa kết nối tài khoản Lark"}
              </p>
            </div>
            {status(info.data.connected ? "ACTIVE" : "INACTIVE")}
          </div>
          <div className="detail-list">
            <div>
              <span>Lịch đã chọn</span>
              <strong>{info.data.calendarName || "Chưa chọn lịch"}</strong>
            </div>
            <div>
              <span>Đồng bộ gần nhất</span>
              <strong>{date(info.data.state?.lastSuccessfulAt)}</strong>
            </div>
            <div>
              <span>Đồng bộ tự động</span>
              <strong>
                {info.data.automaticSyncEnabled ? "Đang bật" : "Đang tắt"}
              </strong>
            </div>
          </div>
          {info.data.state?.lastError && (
            <div className="error-notice">
              Lần đồng bộ trước: {info.data.state.lastError}
            </div>
          )}
          <div className="lark-actions">
            <Button
              type="primary"
              icon={<CloudSyncOutlined />}
              disabled={!info.data.configured}
              loading={busy === "sync"}
              onClick={() => void sync()}
            >
              Đồng bộ sự kiện
            </Button>
            <Link to="/events">
              <Button>Xem sự kiện</Button>
            </Link>
          </div>
        </Panel>
        <Panel
          title="Thiết lập kết nối"
          description="Thực hiện các bước sau để chọn đúng lịch."
        >
          <div className="steps">
            <div>
              <span>01</span>
              <section>
                <strong>Cấp quyền Lark</strong>
                <p>
                  Mở Lark và đăng nhập tài khoản có quyền xem lịch của đội ngũ.
                </p>
                <Button
                  icon={<LinkOutlined />}
                  loading={busy === "connect"}
                  onClick={() => void connect()}
                >
                  {info.data.connected ? "Kết nối lại" : "Kết nối Lark"}
                </Button>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <strong>Chọn lịch cần lấy</strong>
                <p>Sau khi cấp quyền, tải danh sách và chọn lịch mong muốn.</p>
                <Space wrap>
                  <Button
                    disabled={!info.data.connected}
                    loading={busy === "list"}
                    onClick={() => void loadCalendars()}
                  >
                    Tải danh sách lịch
                  </Button>
                  <Select
                    placeholder="Chọn lịch"
                    style={{ minWidth: 210 }}
                    value={chosen}
                    onChange={setChosen}
                    options={calendars.map((c) => ({
                      value: c.calendarId,
                      label: c.name || c.calendarId,
                    }))}
                  />
                  <Button
                    disabled={!chosen}
                    loading={busy === "save"}
                    onClick={() => void save()}
                  >
                    Lưu lịch
                  </Button>
                </Space>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <strong>Đồng bộ bất cứ lúc nào</strong>
                <p>Sử dụng nút “Đồng bộ sự kiện” để đưa lịch vào hệ thống.</p>
              </section>
            </div>
          </div>
          <p className="muted">
            Lark cần được cấu hình callback và quyền đọc lịch trước khi kết nối.
          </p>
        </Panel>
      </div>
    </>
  );
}

export function SettingsPage() {
  const [form] = Form.useForm();
  const act = useAction();
  return (
    <>
      <Heading
        eyebrow="HỆ THỐNG / CÀI ĐẶT"
        title="Cài đặt"
        subtitle="Quản lý thông tin đăng nhập của bạn."
      />
      <div className="settings-width">
        <Panel
          title="Đổi mật khẩu"
          description="Bạn sẽ được đăng xuất sau khi đổi mật khẩu thành công."
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={(v) =>
              void act(async () => {
                await request("/auth/change-password", {
                  method: "POST",
                  body: v,
                });
                await logout();
              }, "Đã đổi mật khẩu. Vui lòng đăng nhập lại.")
            }
          >
            <Form.Item
              name="currentPassword"
              label="Mật khẩu hiện tại"
              rules={[{ required: true }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="Mật khẩu mới"
              rules={[{ required: true, min: 8 }]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Đổi mật khẩu
            </Button>
          </Form>
        </Panel>
      </div>
    </>
  );
}

type EquipmentImportRow = { name: string; model?: string; group: string; quantity?: number; serialNumber?: string; condition?: string; accessoryNotes?: string; managementStatus?: string; storageLocation?: string; custodian?: string; inventoryDate?: string; normalizedNote?: string };
type EquipmentItem = Omit<EquipmentImportRow, "group"> & { id: number; qrCode: string; depreciationMonths?: number; catalogGroup: { id: string; code: string; shortName?: string; name: string }; createdAt: string; updatedAt: string };
type EquipmentImportResult = { created: number; failed: number; total: number; errors: { row: number; message: string }[] };
const equipmentHeaders = ["Tên thiết bị", "Loại / Model", "Nhóm thiết bị", "Số lượng", "Mã tài sản / Serial", "Tình trạng", "Phụ kiện/ghi chú", "Trạng thái quản lý", "Vị trí lưu trữ", "Người phụ trách", "Ngày kiểm kê", "Ghi chú chuẩn hóa"];
const equipmentFields: (keyof EquipmentImportRow)[] = ["name", "model", "group", "quantity", "serialNumber", "condition", "accessoryNotes", "managementStatus", "storageLocation", "custodian", "inventoryDate", "normalizedNote"];
const textValue = (value: unknown) => value == null ? "" : String(value).trim();
const csvRows = (text: string) => { const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; for (let i = 0; i < text.length; i++) { const char = text[i]; if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { row.push(cell); cell = ""; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ""; } else cell += char; } row.push(cell); if (row.some((value) => value.trim())) rows.push(row); return rows; };
const mapEquipmentRows = (rows: string[][]) => {
  if (!rows.length) throw new Error("File không có dữ liệu");
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const indexes = equipmentHeaders.map((header) => headers.indexOf(header.toLowerCase()));
  const missing = equipmentHeaders.filter((_, index) => indexes[index] < 0);
  if (missing.length) throw new Error(`Thiếu cột: ${missing.join(", ")}`);
  return rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row) => {
    const item = {} as Record<string, unknown>;
    equipmentFields.forEach((field, index) => { const value = textValue(row[indexes[index]]); if (field === "quantity") item[field] = value ? Number(value) : 1; else if (value) item[field] = value; });
    return item as EquipmentImportRow;
  });
};

export function EquipmentListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<string>();
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<EquipmentImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<EquipmentImportResult>();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const { message, modal } = App.useApp();
  const path = `/equipment-items${query({ page, pageSize, search, groupId })}`;
  const equipment = useData<EquipmentItem[]>(path, []);
  const groups = useData<CatalogGroup[]>("/catalog/groups/equipment", []);
  const parseFile = async (file: File) => {
    try {
      let rows: string[][];
      if (file.name.toLowerCase().endsWith(".csv")) rows = csvRows(await file.text());
      else {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error("File Excel không có sheet dữ liệu");
        rows = [];
        sheet.eachRow({ includeEmpty: false }, (sheetRow) => { const values = equipmentHeaders.map((_, index) => { const cell = sheetRow.getCell(index + 1); if (index === 10 && cell.value instanceof Date) return cell.value.toISOString().slice(0, 10); return cell.text; }); rows.push(values); });
      }
      const mapped = mapEquipmentRows(rows);
      if (mapped.length > 1000) throw new Error("Mỗi lần chỉ được import tối đa 1.000 dòng");
      const invalid = mapped.findIndex((row) => !row.name || !row.group || !Number.isInteger(row.quantity) || Number(row.quantity) < 1);
      if (invalid >= 0) throw new Error(`Dòng ${invalid + 2} thiếu tên, nhóm hoặc số lượng không hợp lệ`);
      setFileName(file.name); setImportRows(mapped); setResult(undefined);
    } catch (error) { setFileName(""); setImportRows([]); message.error(error instanceof Error ? error.message : "Không thể đọc file"); }
  };
  const downloadTemplate = async () => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Danh sách thiết bị", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRow(equipmentHeaders);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF244D6B" } }; sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true }; sheet.getRow(1).height = 32;
    [26, 18, 20, 10, 22, 28, 28, 20, 20, 20, 16, 28].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.getColumn(4).numFmt = "0"; sheet.getColumn(11).numFmt = "yyyy-mm-dd"; sheet.autoFilter = { from: "A1", to: "L1" };
    const guide = workbook.addWorksheet("Hướng dẫn"); guide.addRows([["Hướng dẫn import thiết bị"], ["Tên thiết bị và Nhóm thiết bị là bắt buộc."], ["Nhóm thiết bị nhận tên viết tắt (LIGHT, CAMERA...) hoặc tên đầy đủ."], ["Ngày kiểm kê dùng định dạng yyyy-mm-dd."], ["Mỗi dòng hợp lệ sẽ tạo một thiết bị với ID tự tăng trong hệ thống."]]); guide.getColumn(1).width = 85; guide.getRow(1).font = { bold: true, size: 14 };
    const buffer = await workbook.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const link = document.createElement("a"); link.href = url; link.download = "mau-import-thiet-bi.xlsx"; link.click(); URL.revokeObjectURL(url);
  };
  const runImport = async () => { setImporting(true); try { const response = await request<EquipmentImportResult>("/equipment-items/import", { method: "POST", body: { rows: importRows } }); setResult(response.data); message.success(`Đã thêm ${response.data.created} thiết bị`); await equipment.load(); } catch (error) { message.error(error instanceof Error ? error.message : "Import thất bại"); } finally { setImporting(false); } };
  const removeSelected = () => {
    const count = selectedIds.length;
    if (!count) return;
    modal.confirm({
      title: count === 1 ? "Xóa thiết bị đã chọn?" : `Xóa ${count} thiết bị đã chọn?`,
      content: "Dữ liệu thiết bị và mã QR tương ứng sẽ bị xóa khỏi hệ thống.",
      okText: "Xóa",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeleting(true);
        try {
          const response = await request<{ deleted: number; requested: number }>("/equipment-items", { method: "DELETE", body: { ids: selectedIds } });
          setSelectedIds([]);
          message.success(`Đã xóa ${response.data.deleted} thiết bị`);
          await equipment.load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Không thể xóa thiết bị");
          throw error;
        } finally {
          setDeleting(false);
        }
      },
    });
  };
  const columns = [
    { title: "Tên thiết bị", dataIndex: "name", width: 190, render: (value: string, row: EquipmentItem) => <Link className="equipment-name-link" to={`/equipment/${row.id}`}>{value}</Link> },
    { title: "Loại / Model", dataIndex: "model", width: 150, render: (value?: string) => value || "—" },
    { title: "Nhóm thiết bị", dataIndex: "catalogGroup", width: 160, render: (group: EquipmentItem["catalogGroup"]) => <div><Tag>{group.shortName || group.code}</Tag><div className="subline">{group.name}</div></div> },
    { title: "SL", dataIndex: "quantity", width: 65 }, { title: "Mã tài sản / Serial", dataIndex: "serialNumber", width: 170, render: (value?: string) => value || "—" },
    { title: "Tình trạng", dataIndex: "condition", width: 220, render: (value?: string) => value || "—" }, { title: "Phụ kiện / ghi chú", dataIndex: "accessoryNotes", width: 200, render: (value?: string) => value || "—" },
    { title: "Trạng thái quản lý", dataIndex: "managementStatus", width: 160, render: (value?: string) => value ? <Tag>{value}</Tag> : "—" }, { title: "Vị trí lưu trữ", dataIndex: "storageLocation", width: 160, render: (value?: string) => value || "—" },
    { title: "Người phụ trách", dataIndex: "custodian", width: 160, render: (value?: string) => value || "—" }, { title: "Ngày kiểm kê", dataIndex: "inventoryDate", width: 125, render: (value?: string) => value ? dayjs(value).format("DD/MM/YYYY") : "—" },
    { title: "Ghi chú chuẩn hóa", dataIndex: "normalizedNote", width: 220, render: (value?: string) => value || "—" },
    { title: "Thao tác", key: "actions", fixed: "right" as const, width: 130, render: (_: unknown, row: EquipmentItem) => <Link to={`/equipment/${row.id}`}><Button icon={<EditOutlined/>} aria-label={`Quản lý thiết bị ${row.name}`}>Quản lý</Button></Link> },
  ];
  return <>
    <Heading eyebrow="THIẾT BỊ / DANH SÁCH" title="Danh sách thiết bị" subtitle="Theo dõi thiết bị, tình trạng, vị trí lưu trữ và lịch kiểm kê." extra={<Space wrap><Button icon={<DownloadOutlined/>} onClick={() => void downloadTemplate()}>Tải file mẫu</Button><Button type="primary" icon={<UploadOutlined/>} onClick={() => { setImportOpen(true); setImportRows([]); setFileName(""); setResult(undefined); }}>Import thiết bị</Button></Space>}/>
    <ErrorNotice error={equipment.error}/><Panel title="Thiết bị" description={`${equipment.meta?.total ?? 0} thiết bị trong hệ thống`}><div className="equipment-filters"><Input.Search allowClear placeholder="Quét mã QR hoặc tìm tên, model, serial..." onSearch={(value) => { setSearch(value); setPage(1); setSelectedIds([]); }} style={{ width: 360 }}/><Select allowClear placeholder="Lọc theo nhóm thiết bị" value={groupId} onChange={(value) => { setGroupId(value); setPage(1); setSelectedIds([]); }} style={{ width: 240 }} options={groups.data.map((group) => ({ value: group.id, label: `${group.shortName || group.code} — ${group.name}` }))}/><Button icon={<ReloadOutlined/>} onClick={() => void equipment.load()} loading={equipment.loading}>Làm mới</Button><Button danger icon={<DeleteOutlined/>} disabled={!selectedIds.length} loading={deleting} onClick={removeSelected}>Xóa{selectedIds.length ? ` (${selectedIds.length})` : ""}</Button></div><Table rowKey="id" loading={equipment.loading} columns={columns} dataSource={equipment.data} rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys.map(Number)), getCheckboxProps: () => ({ disabled: deleting }) }} scroll={{ x: 1930 }} pagination={{ current: equipment.meta?.page, pageSize: equipment.meta?.pageSize || pageSize, total: equipment.meta?.total, showSizeChanger: true, pageSizeOptions: tablePageSizeOptions, hideOnSinglePage: true, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); setSelectedIds([]); } }} locale={{ emptyText: empty }}/></Panel>
    <Modal width={1000} title="Import danh sách thiết bị" open={importOpen} onCancel={() => setImportOpen(false)} footer={result ? <Button type="primary" onClick={() => setImportOpen(false)}>Đóng</Button> : [<Button key="cancel" onClick={() => setImportOpen(false)}>Hủy</Button>, <Button key="import" type="primary" disabled={!importRows.length} loading={importing} onClick={() => void runImport()}>Import {importRows.length || ""} dòng</Button>]} destroyOnHidden>
      <Upload.Dragger accept=".xlsx,.csv" maxCount={1} showUploadList={false} beforeUpload={(file) => { void parseFile(file); return false; }}><p className="ant-upload-drag-icon"><InboxOutlined/></p><p className="ant-upload-text">Chọn hoặc kéo file Excel/CSV vào đây</p><p className="ant-upload-hint">Dùng file mẫu để đảm bảo đúng 12 cột. Tối đa 1.000 dòng/lần.</p></Upload.Dragger>
      {fileName && <div className="import-file-summary"><strong>{fileName}</strong><span>{importRows.length} dòng hợp lệ để gửi</span></div>}
      {!!importRows.length && !result && <Table size="small" rowKey={(_, index) => String(index)} pagination={false} scroll={{ x: 800, y: 280 }} dataSource={importRows.slice(0, 8)} columns={[{ title: "Tên thiết bị", dataIndex: "name", width: 180 }, { title: "Model", dataIndex: "model", width: 130 }, { title: "Nhóm", dataIndex: "group", width: 130 }, { title: "SL", dataIndex: "quantity", width: 60 }, { title: "Tình trạng", dataIndex: "condition", width: 200 }]}/>}
      {result && <div className="import-result"><strong>Kết quả import</strong><div><Tag color="success">Thêm mới: {result.created}</Tag><Tag color={result.failed ? "error" : "default"}>Lỗi: {result.failed}</Tag></div>{result.errors.map((error) => <p key={error.row}>Dòng {error.row}: {error.message}</p>)}</div>}
    </Modal>
  </>;
}

export function MaterialListPage() {
  const groups = useData<CatalogGroup[]>("/catalog/groups/material", []);
  const [groupId, setGroupId] = useState<string>();
  const [search, setSearch] = useState("");
  const columns = [
    { title: "Tên vật tư", dataIndex: "name", width: 220 },
    { title: "Nhóm vật tư", dataIndex: "group", width: 190 },
    { title: "Đơn vị tính", dataIndex: "unit", width: 130 },
    { title: "Số lượng tồn", dataIndex: "quantity", width: 130 },
    { title: "Vị trí lưu trữ", dataIndex: "storageLocation", width: 180 },
    { title: "Ghi chú", dataIndex: "note", width: 260 },
    { title: "Thao tác", key: "actions", fixed: "right" as const, width: 120 },
  ];
  return <>
    <Heading eyebrow="THIẾT BỊ & VẬT TƯ / DANH SÁCH" title="Danh sách vật tư" subtitle="Theo dõi vật tư tiêu hao, số lượng tồn và vị trí lưu trữ."/>
    <ErrorNotice error={groups.error}/>
    <Panel title="Vật tư" description="0 vật tư trong hệ thống">
      <div className="equipment-filters"><Input.Search allowClear placeholder="Tìm tên vật tư..." value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 320 }}/><Select allowClear placeholder="Lọc theo nhóm vật tư" value={groupId} onChange={setGroupId} style={{ width: 250 }} options={groups.data.map((group) => ({ value: group.id, label: `${group.code} — ${group.name}` }))}/><Button icon={<ReloadOutlined/>} onClick={() => void groups.load()} loading={groups.loading}>Làm mới</Button></div>
      <Table rowKey="id" loading={groups.loading} columns={columns} dataSource={[]} scroll={{ x: 1150 }} pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: tablePageSizeOptions, hideOnSinglePage: true }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu vật tư"/> }}/>
    </Panel>
  </>;
}

type EquipmentPhoto = { id: string; fileName?: string; mimeType: string; createdAt: string };
type EquipmentNote = { id: string; content: string; createdAt: string; createdBy: { id: string; fullName: string } };
type EquipmentDetail = EquipmentItem & { images: EquipmentPhoto[]; notes: EquipmentNote[] };

function EquipmentPhotoCard({ equipmentId, photo, onDelete }: { equipmentId: number; photo: EquipmentPhoto; onDelete: () => void }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void request<Blob>(`/equipment-items/${equipmentId}/images/${photo.id}`, { raw: true }).then((response) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data);
      setSource(objectUrl);
    }).catch(() => setSource(""));
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [equipmentId, photo.id]);
  return <figure className="equipment-photo-card">
    {source ? <img src={source} alt={photo.fileName || "Ảnh thiết bị"}/> : <div className="equipment-photo-loading"><FileImageOutlined/></div>}
    <figcaption><span title={photo.fileName}><strong>{photo.fileName || "Ảnh thiết bị"}</strong><small>Tải lên: {date(photo.createdAt)}</small></span><Popconfirm title="Xóa ảnh này?" okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={onDelete}><Button type="text" danger aria-label="Xóa ảnh" icon={<DeleteOutlined/>}/></Popconfirm></figcaption>
  </figure>;
}

const fileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Không thể đọc ảnh")); reader.readAsDataURL(file); });

export function EquipmentDetailPage() {
  const params = useParams();
  const equipmentId = Number(params.id);
  const equipment = useData<EquipmentDetail | null>(`/equipment-items/${equipmentId}`, null);
  const groups = useData<CatalogGroup[]>("/catalog/groups/equipment", []);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const { message } = App.useApp();
  useEffect(() => {
    const item = equipment.data;
    if (!item) return;
    form.setFieldsValue({ ...item, catalogGroupId: item.catalogGroup.id, inventoryDate: item.inventoryDate ? dayjs(item.inventoryDate) : null });
  }, [equipment.data, form]);
  const save = async (values: Row) => {
    setSaving(true);
    try {
      await request(`/equipment-items/${equipmentId}`, { method: "PATCH", body: { ...values, inventoryDate: values.inventoryDate ? values.inventoryDate.format("YYYY-MM-DD") : null } });
      message.success("Đã cập nhật thông tin thiết bị");
      await equipment.load();
    } catch (error) { message.error(error instanceof Error ? error.message : "Không thể cập nhật thiết bị"); }
    finally { setSaving(false); }
  };
  const uploadPhoto = async (file: File) => {
    if (file.size > 3_000_000) throw new Error(`${file.name} vượt quá 3 MB`);
    const dataUrl = await fileAsDataUrl(file);
    await request(`/equipment-items/${equipmentId}/images`, { method: "POST", body: { fileName: file.name, dataUrl } });
  };
  const removePhoto = async (photoId: string) => { try { await request(`/equipment-items/${equipmentId}/images/${photoId}`, { method: "DELETE" }); message.success("Đã xóa ảnh"); await equipment.load(); } catch (error) { message.error(error instanceof Error ? error.message : "Không thể xóa ảnh"); } };
  const addNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try { await request(`/equipment-items/${equipmentId}/notes`, { method: "POST", body: { content: note.trim() } }); setNote(""); message.success("Đã thêm ghi chú"); await equipment.load(); }
    catch (error) { message.error(error instanceof Error ? error.message : "Không thể thêm ghi chú"); }
    finally { setAddingNote(false); }
  };
  const item = equipment.data;
  return <>
    <Heading eyebrow="THIẾT BỊ / CHI TIẾT" title={item?.name || "Chi tiết thiết bị"} subtitle="Cập nhật thông tin, hình ảnh và theo dõi lịch sử tình trạng thiết bị." extra={<Link to="/equipment"><Button icon={<ArrowLeftOutlined/>}>Danh sách thiết bị</Button></Link>}/>
    <ErrorNotice error={equipment.error}/>
    {equipment.loading && !item ? <div className="equipment-detail-loading"><Spin/></div> : item ? <div className="equipment-detail-layout">
      <Panel title="Thông tin thiết bị" description="Chỉnh sửa thông số và thông tin quản lý." extra={<Button type="primary" icon={<SaveOutlined/>} loading={saving} onClick={() => form.submit()}>Lưu thay đổi</Button>}>
        <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
          <div className="form-pair"><Form.Item name="name" label="Tên thiết bị" rules={[{ required: true, message: "Nhập tên thiết bị" }]}><Input maxLength={200}/></Form.Item><Form.Item name="model" label="Loại / Model"><Input maxLength={150}/></Form.Item></div>
          <div className="form-pair"><Form.Item name="catalogGroupId" label="Nhóm thiết bị" rules={[{ required: true }]}><Select options={groups.data.map((group) => ({ value: group.id, label: `${group.shortName || group.code} — ${group.name}` }))}/></Form.Item><Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}><InputNumber min={1} max={10000} style={{ width: "100%" }}/></Form.Item></div>
          <div className="form-pair"><Form.Item name="serialNumber" label="Mã tài sản / Serial"><Input maxLength={150}/></Form.Item><Form.Item name="managementStatus" label="Trạng thái quản lý"><Input maxLength={100}/></Form.Item></div>
          <div className="form-pair"><Form.Item name="storageLocation" label="Vị trí lưu trữ"><Input maxLength={200}/></Form.Item><Form.Item name="custodian" label="Người phụ trách"><Input maxLength={150}/></Form.Item></div>
          <div className="form-pair"><Form.Item name="inventoryDate" label="Ngày kiểm kê"><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY"/></Form.Item><Form.Item name="depreciationMonths" label="Khấu hao dự kiến (tháng)"><InputNumber min={1} max={240} placeholder="Ví dụ: 36" style={{ width: "100%" }}/></Form.Item></div>
          <Form.Item name="normalizedNote" label="Ghi chú chuẩn hóa"><Input maxLength={500}/></Form.Item>
          <Form.Item name="condition" label="Tình trạng thiết bị"><Input.TextArea rows={3} maxLength={500} showCount/></Form.Item>
          <Form.Item name="accessoryNotes" label="Phụ kiện / ghi chú"><Input.TextArea rows={3} maxLength={500} showCount/></Form.Item>
        </Form>
      </Panel>
      <div className="equipment-detail-side">
        <Panel title="Hình ảnh thiết bị" description={`${item.images.length} ảnh đã lưu`} extra={<Upload multiple accept="image/jpeg,image/png,image/webp" showUploadList={false} customRequest={({ file, onSuccess, onError }) => { setUploading((value) => value + 1); void uploadPhoto(file as File).then(async () => { onSuccess?.({}); message.success(`Đã tải lên ${(file as File).name}`); await equipment.load(); }).catch((error) => { onError?.(error as Error); message.error(error instanceof Error ? error.message : "Không thể tải ảnh"); }).finally(() => setUploading((value) => value - 1)); }}><Button icon={<UploadOutlined/>} loading={uploading > 0}>Thêm ảnh</Button></Upload>}>
          {item.images.length ? <div className="equipment-photo-grid">{item.images.map((photo) => <EquipmentPhotoCard key={photo.id} equipmentId={item.id} photo={photo} onDelete={() => void removePhoto(photo.id)}/>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có ảnh thiết bị"/>}
        </Panel>
        <Panel title="Lịch sử ghi chú" description="Ghi chú mới được lưu thành từng mốc thời gian.">
          <div className="equipment-note-compose"><Input.TextArea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} showCount placeholder="Thiết bị đang gặp vấn đề gì?"/><Button type="primary" disabled={!note.trim()} loading={addingNote} onClick={() => void addNote()}>Thêm ghi chú</Button></div>
          {item.notes.length ? <div className="equipment-note-timeline">{item.notes.map((entry) => <article key={entry.id}><i/><div><header><strong>{entry.createdBy.fullName}</strong><time>{date(entry.createdAt)}</time></header><p>{entry.content}</p></div></article>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lịch sử ghi chú"/>}
        </Panel>
      </div>
    </div> : !equipment.loading && <Empty description="Không tìm thấy thiết bị"/>}
  </>;
}

type CatalogKind = "equipment" | "material" | "service";
type CatalogGroup = { id: string; code: string; shortName?: string; name: string; description: string; examples: string[]; aliases: string[]; note?: string };
type CatalogGroups = Record<CatalogKind, CatalogGroup[]>;
const emptyCatalog: CatalogGroups = { equipment: [], material: [], service: [] };
const catalogKinds: { key: CatalogKind; label: string; singular: string }[] = [
  { key: "equipment", label: "Nhóm thiết bị", singular: "nhóm thiết bị" },
  { key: "material", label: "Nhóm vật tư", singular: "nhóm vật tư" },
  { key: "service", label: "Nhóm dịch vụ", singular: "nhóm dịch vụ" },
];
const catalogPrefixes: Record<CatalogKind, string> = { equipment: "TB", material: "VT", service: "DV" };

export function CatalogPage() {
  const catalog = useData<CatalogGroups>("/catalog/groups", emptyCatalog);
  const [kind, setKind] = useState<CatalogKind>("equipment");
  const [editing, setEditing] = useState<CatalogGroup>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [form] = Form.useForm();
  const act = useAction();
  const kindInfo = catalogKinds.find((item) => item.key === kind)!;
  const openCreate = () => { setEditing(undefined); form.resetFields(); setEditorOpen(true); };
  const openEdit = (group: CatalogGroup) => { setEditing(group); form.setFieldsValue({ ...group, examplesText: group.examples.join(", "), aliasesText: group.aliases.join(", ") }); setEditorOpen(true); };
  const save = async (values: Record<string, unknown>) => {
    const examples = String(values.examplesText || "").split(",").map((item) => item.trim()).filter(Boolean);
    const aliases = String(values.aliasesText || "").split(",").map((item) => item.trim()).filter(Boolean);
    const body = { shortName: kind === "equipment" ? values.shortName : undefined, name: values.name, description: values.description, examples, aliases, note: values.note || "" };
    const saved = await act(() => request(editing ? `/catalog/groups/${kind}/${editing.code}` : `/catalog/groups/${kind}`, { method: editing ? "PATCH" : "POST", body }), editing ? "Đã cập nhật nhóm" : "Đã thêm nhóm");
    if (saved) { setEditorOpen(false); setEditing(undefined); await catalog.load(); }
  };
  const remove = async (group: CatalogGroup) => { const removed = await act(() => request(`/catalog/groups/${kind}/${group.code}`, { method: "DELETE" }), "Đã xoá nhóm"); if (removed) await catalog.load(); };
  const columns = [
    { title: "Mã nhóm", dataIndex: "code", width: 120, render: (code: string) => <code className="catalog-code">{code}</code> },
    ...(kind === "equipment" ? [{ title: "Tên viết tắt", dataIndex: "shortName", width: 145, render: (shortName: string | undefined) => shortName ? <code className="catalog-short-name">{shortName}</code> : "—" }] : []),
    { title: "Tên nhóm", dataIndex: "name", render: (name: string, row: CatalogGroup) => <div><strong>{name}</strong><div className="subline">{row.description}</div></div> },
    { title: "Ví dụ", dataIndex: "examples", render: (examples: string[]) => examples.length ? <div className="catalog-tags">{examples.map((example) => <Tag key={example}>{example}</Tag>)}</div> : "—" },
    { title: "Alias import", dataIndex: "aliases", width: 240, render: (aliases: string[]) => aliases.length ? <div className="catalog-tags">{aliases.map((alias) => <Tag key={alias} color="blue">{alias}</Tag>)}</div> : "—" },
    { title: "", width: 104, render: (_: unknown, row: CatalogGroup) => <Space size={2}><Tooltip title="Chỉnh sửa nhóm"><Button type="text" aria-label={`Chỉnh sửa ${row.name}`} icon={<EditOutlined/>} onClick={() => openEdit(row)}/></Tooltip><Popconfirm title="Xoá nhóm này?" description={`Mã ${row.code} sẽ bị xoá khỏi danh mục.`} okText="Xoá" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => void remove(row)}><Tooltip title="Xoá nhóm"><Button type="text" danger aria-label={`Xoá ${row.name}`} icon={<DeleteOutlined/>}/></Tooltip></Popconfirm></Space> },
  ];
  return <>
    <Heading eyebrow="THIẾT BỊ / DANH MỤC" title="Quản lý nhóm" subtitle="Thêm, sửa và xoá các nhóm thiết bị, vật tư và dịch vụ dùng chung trong hệ thống." extra={<Space><Button icon={<ReloadOutlined/>} onClick={() => void catalog.load()} loading={catalog.loading}>Làm mới</Button><Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>Thêm nhóm</Button></Space>}/>
    <ErrorNotice error={catalog.error}/>
    <Panel title="Danh mục nhóm dùng chung" description="Dữ liệu được lưu trong PostgreSQL. Mã nhóm phải duy nhất trong từng loại nhóm.">
      <Tabs activeKey={kind} onChange={(key) => setKind(key as CatalogKind)} items={catalogKinds.map((item) => ({ key: item.key, label: `${item.label} (${catalog.data[item.key].length})` }))}/>
      <Table rowKey="code" loading={catalog.loading} columns={columns} dataSource={catalog.data[kind]} scroll={{ x: 760 }} pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: tablePageSizeOptions, hideOnSinglePage: true }} locale={{ emptyText: empty }}/>
    </Panel>
    <Modal title={editing ? `Chỉnh sửa ${editing.code}` : `Thêm ${kindInfo.singular}`} open={editorOpen} onCancel={() => { setEditorOpen(false); setEditing(undefined); }} onOk={() => form.submit()} okText={editing ? "Lưu thay đổi" : "Thêm nhóm"} cancelText="Hủy" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
        {!editing && <div className="catalog-code-notice"><strong>Mã nhóm được tạo tự động</strong><span>{catalogPrefixes[kind]}_001 → {catalogPrefixes[kind]}_998 · mã {catalogPrefixes[kind]}_999 dành cho nhóm chưa phân loại</span></div>}
        {kind === "equipment" && <Form.Item name="shortName" label="Tên viết tắt" extra="Tên ngắn giúp người dùng nhận biết và chọn nhóm thiết bị nhanh hơn." normalize={(value) => String(value || "").toUpperCase()} rules={[{ required: true, message: "Vui lòng nhập tên viết tắt" }, { pattern: /^[A-Z0-9_]+$/, message: "Chỉ dùng chữ in hoa, số và dấu gạch dưới" }]}><Input placeholder="Ví dụ: LIGHT, CAMERA, POWER" maxLength={20}/></Form.Item>}
        <Form.Item name="name" label="Tên nhóm" rules={[{ required: true, message: "Vui lòng nhập tên nhóm" }]}><Input maxLength={100}/></Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ required: true, message: "Vui lòng nhập mô tả" }]}><Input.TextArea rows={3} maxLength={500}/></Form.Item>
        <Form.Item name="examplesText" label="Ví dụ" extra="Ngăn cách các ví dụ bằng dấu phẩy."><Input placeholder="Ví dụ: Canon, Nikon, Lens" maxLength={500}/></Form.Item>
        <Form.Item name="aliasesText" label="Alias import" extra="Các tên khác có thể xuất hiện trong file import, ngăn cách bằng dấu phẩy."><Input.TextArea rows={2} placeholder="Ví dụ: Máy tính/màn hình, PC và màn hình" maxLength={1000}/></Form.Item>
        <Form.Item name="note" label={kind === "material" ? "Đơn vị tính mẫu / ghi chú" : "Ghi chú"}><Input maxLength={200}/></Form.Item>
      </Form>
    </Modal>
  </>;
}

export function ComingSoonPage({ type }: { type: "equipment" | "guidelines" }) {
  const isEquipment = type === "equipment";
  const title = isEquipment ? "Quản lý thiết bị" : "Hướng dẫn & checklist";
  const subject = isEquipment
    ? "thiết bị, tình trạng và lịch sử bàn giao"
    : "guidelines, checklist vận hành và xác nhận hoàn thành";
  return (
    <>
      <Heading
        eyebrow={
          isEquipment ? "THIẾT BỊ / MOCKUP" : "GUIDELINES & CHECKLIST / MOCKUP"
        }
        title={title}
        subtitle={`Không gian chuẩn bị cho việc quản lý ${subject}.`}
      />
      <Panel
        title="Đang chờ kết nối dữ liệu"
        description="Đây là bản mockup giao diện, chưa có API hoặc dữ liệu thật."
      >
        <div className="mockup-notice">
          <strong>Thông báo cho quản trị viên và nhân sự</strong>
          <p>
            Tính năng đang được chuẩn bị. Dữ liệu hiển thị ở đây sẽ chỉ được
            kích hoạt khi API hoàn tất; hệ thống sẽ thông báo trên trang quản
            trị và web app cho nhân sự khi sẵn sàng.
          </p>
        </div>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            isEquipment
              ? "Chưa có dữ liệu thiết bị để hiển thị"
              : "Chưa có guidelines hoặc checklist để hiển thị"
          }
        />
      </Panel>
    </>
  );
}
