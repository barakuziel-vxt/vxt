import React from 'react';

interface DrawerContextValue {
  openDrawer: () => void;
}

export const DrawerContext = React.createContext<DrawerContextValue>({
  openDrawer: () => {},
});
