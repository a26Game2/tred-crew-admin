export const permissionGroups = [
  { label: 'Không gian làm việc', options: [
    { value: 'DASHBOARD_VIEW', label: 'Tổng quan', path: '/' },
    { value: 'USERS_VIEW', label: 'Tài khoản', path: '/users' },
    { value: 'EMPLOYEES_VIEW', label: 'Nhân sự', path: '/employees' },
    { value: 'OFFICE_VIEW', label: 'Văn phòng', path: '/office' },
  ] },
  { label: 'Thiết bị & vật tư', options: [
    { value: 'EQUIPMENT_GROUPS_VIEW', label: 'Nhóm thiết bị', path: '/equipment/groups' },
    { value: 'EQUIPMENT_VIEW', label: 'Danh sách thiết bị', path: '/equipment' },
    { value: 'MATERIALS_VIEW', label: 'Danh sách vật tư', path: '/materials' },
    { value: 'SERVICES_VIEW', label: 'Danh sách dịch vụ', path: '/services' },
  ] },
  { label: 'Sự kiện', options: [
    { value: 'EVENTS_VIEW', label: 'Sự kiện', path: '/events' },
    { value: 'CALENDAR_VIEW', label: 'Lịch', path: '/calendar' },
    { value: 'ATTENDANCE_VIEW', label: 'Chấm công', path: '/attendance' },
    { value: 'POINTS_VIEW', label: 'Điểm & EXP', path: '/points' },
  ] },
  { label: 'Khác', options: [
    { value: 'GUIDELINES_VIEW', label: 'Hướng dẫn & checklist', path: '/guidelines' },
    { value: 'LARK_VIEW', label: 'Kết nối Lark', path: '/lark' },
    { value: 'AUDIT_VIEW', label: 'Nhật ký hoạt động', path: '/audit' },
  ] },
] as const;

export type TabPermission = typeof permissionGroups[number]['options'][number]['value'];
export const allPermissions = permissionGroups.flatMap((group) => group.options.map((option) => option.value));

export function canView(role: string | undefined, permissions: string[] | undefined, permission: string) {
  return role === 'ADMIN' || Boolean(permissions?.includes(permission));
}

export function firstAllowedPath(role: string | undefined, permissions: string[] | undefined) {
  if (role === 'ADMIN') return '/';
  for (const group of permissionGroups) {
    for (const option of group.options) if (permissions?.includes(option.value)) return option.path;
  }
  return '/login';
}
