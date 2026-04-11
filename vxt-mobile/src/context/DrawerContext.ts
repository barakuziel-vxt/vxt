import React from 'react';

interface DrawerContextValue {
  openDrawer: () => void;
  navigateTo: (screen: string) => void;
}

export const DrawerContext = React.createContext<DrawerContextValue>({
  openDrawer: () => {},
  navigateTo: () => {},
});
