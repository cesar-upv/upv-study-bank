import React from 'react';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider } from './app/theme-context';
import { AppRoutes } from './app/routes';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ThemeProvider>
  );
};
