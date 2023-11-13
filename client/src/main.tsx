import '@mantine/core/styles.css';
import '@mantine/spotlight/styles.css';
import '@mantine/notifications/styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { theme } from '@/theme';
import { MantineProvider } from '@mantine/core';
import { TanstackProvider } from '@/components/providers/tanstack-provider';
import { BrowserRouter } from 'react-router-dom';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <BrowserRouter>
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <TanstackProvider>
          <Notifications />
          <App />
        </TanstackProvider>
      </ModalsProvider>
    </MantineProvider>
  </BrowserRouter>,
);




