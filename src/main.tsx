import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import 'antd/dist/reset.css';
import './styles.css';
import { Shell, LoginPage, Protected } from './shell';
import { AttendancePage, AuditPage, CalendarPage, ComingSoonPage, Dashboard, EmployeesPage, EventsPage, LarkPage, PointsPage, UsersPage } from './pages';

createRoot(document.getElementById('root')!).render(<React.StrictMode><ConfigProvider locale={viVN} theme={{ token: { colorPrimary: '#567345', colorInfo: '#567345', colorText: '#202b22', colorBgContainer: '#fff', borderRadius: 10, fontFamily: 'DM Sans, sans-serif', fontSize: 14 }, components: { Button: { controlHeight: 40, fontWeight: 600 }, Table: { headerBg: '#fafbf9', headerColor: '#758075', borderColor: '#edf0eb', cellPaddingBlock: 15 }, Input: { controlHeight: 42 }, Select: { controlHeight: 42 } } }}><AntApp><BrowserRouter><Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route element={<Shell/>}><Route index element={<Dashboard/>}/><Route path="users" element={<UsersPage/>}/><Route path="employees" element={<EmployeesPage/>}/><Route path="equipment" element={<ComingSoonPage type="equipment"/>}/><Route path="events" element={<EventsPage/>}/><Route path="calendar" element={<CalendarPage/>}/><Route path="attendance" element={<AttendancePage/>}/><Route path="points" element={<PointsPage/>}/><Route path="guidelines" element={<ComingSoonPage type="guidelines"/>}/><Route path="audit" element={<AuditPage/>}/><Route path="lark" element={<LarkPage/>}/></Route></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter></AntApp></ConfigProvider></React.StrictMode>);
