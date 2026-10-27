import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
const HomeView = lazy(() => import('@/features/catalog/HomeView').then(module => ({ default: module.HomeView })));
const UnitView = lazy(() => import('@/features/catalog/UnitView').then(module => ({ default: module.UnitView })));
const StudyView = lazy(() => import('@/features/study/StudyView').then(module => ({ default: module.StudyView })));
const PracticeView = lazy(() => import('@/features/practice/PracticeView').then(module => ({ default: module.PracticeView })));
const ExamView = lazy(() => import('@/features/exam/ExamView').then(module => ({ default: module.ExamView })));
const LogicLabView = lazy(() => import('@/features/logic-lab/LogicLabView').then(module => ({ default: module.LogicLabView })));
const ReviewView = lazy(() => import('@/features/review/ReviewView').then(module => ({ default: module.ReviewView })));
const ImportView = lazy(() => import('@/features/content-import/ImportView').then(module => ({ default: module.ImportView })));
const BackupView = lazy(() => import('@/features/backup/BackupView').then(module => ({ default: module.BackupView })));

const SettingsView = lazy(() => import('@/features/settings/SettingsView').then(module => ({ default: module.SettingsView })));

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<p role="status" className="empty-state">Cargando…</p>}><Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomeView />} />
        <Route path="subjects/:subjectId" element={<Navigate to="/" replace />} />
        <Route path="subjects/:subjectId/units/:unitId" element={<UnitView />} />
        <Route path="subjects/:subjectId/units/:unitId/study" element={<StudyView />} />
        <Route path="subjects/:subjectId/units/:unitId/study/:topicId" element={<StudyView />} />
        <Route path="subjects/:subjectId/units/:unitId/practice" element={<PracticeView />} />
        <Route path="subjects/:subjectId/units/:unitId/exam" element={<ExamView />} />
        <Route path="subjects/:subjectId/units/:unitId/review" element={<ReviewView />} />
        <Route path="logic-lab" element={<LogicLabView />} />
        <Route path="content" element={<ImportView />} />
        <Route path="settings" element={<SettingsView />} />
        <Route path="backup" element={<BackupView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes></Suspense>
  );
};
