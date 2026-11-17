import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import 'antd/dist/reset.css';
import './styles.css';
import { Shell, LoginPage, PermissionRoute, Protected } from './shell';
import { AttendancePage, AuditPage, CalendarPage, CatalogPage, ComingSoonPage, Dashboard, EmployeesPage, EquipmentDetailPage, EquipmentListPage, EventsPage, LarkPage, MaterialListPage, OfficePage, PointsPage, ServicesPage, UsersPage } from './pages';
import { adminTheme } from './theme';

const allowed = (permission: string, page: React.ReactNode) => <PermissionRoute permission={permission}>{page}</PermissionRoute>;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={viVN} theme={adminTheme}>
      <AntApp><BrowserRouter><Routes>
        <Route path="/login" element={<LoginPage/>}/>
        <Route element={<Protected/>}><Route element={<Shell/>}>
          <Route index element={allowed('DASHBOARD_VIEW', <Dashboard/>)}/>
          <Route path="users" element={allowed('USERS_VIEW', <UsersPage/>)}/>
          <Route path="employees" element={allowed('EMPLOYEES_VIEW', <EmployeesPage/>)}/>
          <Route path="office" element={allowed('OFFICE_VIEW', <OfficePage/>)}/>
          <Route path="equipment" element={allowed('EQUIPMENT_VIEW', <EquipmentListPage/>)}/>
          <Route path="equipment/groups" element={allowed('EQUIPMENT_GROUPS_VIEW', <CatalogPage/>)}/>
          <Route path="equipment/:id" element={allowed('EQUIPMENT_VIEW', <EquipmentDetailPage/>)}/>
          <Route path="materials" element={allowed('MATERIALS_VIEW', <MaterialListPage/>)}/>
          <Route path="events" element={allowed('EVENTS_VIEW', <EventsPage/>)}/>
          <Route path="services" element={allowed('SERVICES_VIEW', <ServicesPage/>)}/>
          <Route path="services/history" element={allowed('SERVICES_VIEW', <ServicesPage/>)}/>
          <Route path="quotation" element={<Navigate to="/services?tab=requests" replace/>}/>
          <Route path="calendar" element={allowed('CALENDAR_VIEW', <CalendarPage/>)}/>
          <Route path="attendance" element={allowed('ATTENDANCE_VIEW', <AttendancePage/>)}/>
          <Route path="points" element={allowed('POINTS_VIEW', <PointsPage/>)}/>
          <Route path="guidelines" element={allowed('GUIDELINES_VIEW', <ComingSoonPage type="guidelines"/>)}/>
          <Route path="audit" element={allowed('AUDIT_VIEW', <AuditPage/>)}/>
          <Route path="lark" element={allowed('LARK_VIEW', <LarkPage/>)}/>
        </Route></Route>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes></BrowserRouter></AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
