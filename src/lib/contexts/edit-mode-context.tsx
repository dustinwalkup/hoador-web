"use client";

import { createContext, useContext, useState } from "react";

interface EditModeContextValue {
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const EditModeContext = createContext<EditModeContextValue | undefined>(
  undefined,
);

export const EditModeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [editMode, setEditMode] = useState(false);
  return (
    <EditModeContext.Provider value={{ editMode, setEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
};

export const useEditMode = (): EditModeContextValue => {
  const context = useContext(EditModeContext);
  if (!context)
    throw new Error("useEditMode must be used within EditModeProvider");
  return context;
};
