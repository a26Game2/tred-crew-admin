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
  Tooltip,
} from "antd";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { getSession, logout, query, request } from "./api";
import { EventCalendar } from "./event-calendar";

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
  onPage?: (page: number) => void;
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
              showSizeChanger: false,
              onChange: onPage,
              hideOnSinglePage: true,
            }
          : { pageSize: 10, hideOnSinglePage: true }
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [resetting, setResetting] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const data = useData<Row[]>(
    `/users${query({ page, pageSize: 20, search, status: filter })}`,
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
    { title: "TRẠNG THÁI", dataIndex: "status", render: status },
    { title: "NGÀY TẠO", dataIndex: "createdAt", render: date },
    {
      title: "",
      render: (_: any, r: Row) => (
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
      ),
    },
  ];
  return (
    <>
      <Heading
        eyebrow="QUẢN LÝ / TÀI KHOẢN"
        title="Tài khoản"
        subtitle="Quản lý quyền truy cập và duyệt thành viên mới."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => show()}>
            Thêm tài khoản
          </Button>
        }
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
          onPage={setPage}
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
          initialValues={{ role: "EMPLOYEE" }}
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
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [typeForm] = Form.useForm();
  const data = useData<Row[]>(
    `/employees${query({ page, pageSize: 20, search })}`,
    [],
  );
  const types = useData<Row[]>("/employee-types", []);
  const users = useData<Row[]>("/users?pageSize=100&status=ACTIVE", []);
  const act = useAction();
  const show = (r?: Row) => {
    setEditing(r || null);
    form.resetFields();
    if (r) form.setFieldsValue(r);
    setOpen(true);
  };
  const columns = [
    {
      title: "NHÂN SỰ",
      render: (_: any, r: Row) => (
        <Person name={r.displayName} sub={r.employeeCode} />
      ),
    },
    {
      title: "LOẠI NHÂN SỰ",
      render: (_: any, r: Row) => r.employeeType?.name || "—",
    },
    {
      title: "SỐ ĐIỆN THOẠI",
      dataIndex: "phone",
      render: (v: string) => v || "—",
    },
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
          onPage={setPage}
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
                await request(
                  editing ? `/employees/${editing.id}` : "/employees",
                  { method: editing ? "PATCH" : "POST", body: v },
                );
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
              <Form.Item
                label="Mã nhân sự"
                name="employeeCode"
                rules={[{ required: true, min: 2 }]}
              >
                <Input />
              </Form.Item>
            </>
          )}
          <Form.Item
            label="Tên hiển thị"
            name="displayName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Loại nhân sự"
            name="employeeTypeId"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Chọn loại nhân sự"
              options={types.data
                .filter((t) => t.isActive)
                .map((t) => ({ value: t.id, label: t.name }))}
            />
          </Form.Item>
          <Form.Item label="Số điện thoại" name="phone">
            <Input />
          </Form.Item>
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
                {t.name} <small>{t.code}</small>
              </span>
              {status(t.isActive ? "ACTIVE" : "INACTIVE")}
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
          <Form.Item
            name="code"
            label="Mã (chữ hoa, số hoặc _)"
            rules={[{ required: true, min: 2 }]}
          >
            <Input placeholder="VD: CAMERA" />
          </Form.Item>
          <Form.Item name="name" label="Tên loại" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button htmlType="submit" type="primary" icon={<PlusOutlined />}>
            Thêm loại
          </Button>
        </Form>
      </Modal>
    </>
  );
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
    `/events${query({ page, pageSize: 20, search, startFrom: dateRange.startFrom, startTo: dateRange.startTo })}`,
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
                  showSizeChanger: false,
                  onChange: (next) => {
                    clearSelection();
                    setPage(next);
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
  const data = useData<Row[]>(`/attendance?page=${page}&pageSize=20`, []);
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
          onPage={setPage}
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
              label: `${e.displayName} · ${e.employeeCode}`,
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
  const [selected, setSelected] = useState<Row>();
  const data = useData<Row[]>(`/audit-logs?page=${page}&pageSize=20`, []);
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
          onPage={setPage}
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
