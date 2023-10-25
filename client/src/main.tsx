import '@mantine/core/styles.css';
import '@mantine/spotlight/styles.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { theme } from '@/theme';
import { MantineProvider } from '@mantine/core';
import { TanstackProvider } from '@/components/providers/tanstack-provider';
import CustomToaster from '@/components/ui/custom-toaster';
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <BrowserRouter>
    <MantineProvider theme={theme}>
      <TanstackProvider>
        <App />
        <CustomToaster />
      </TanstackProvider>
    </MantineProvider>
  </BrowserRouter>,
);




